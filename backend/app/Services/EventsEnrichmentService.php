<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class EventsEnrichmentService
{
    private const CACHE_KEY     = 'events:enriched:current';
    private const CACHE_TTL     = 86400; // 24h — refreshed by events:refresh at 04:00
    private const CENTER_LAT    = 41.3870;
    private const CENTER_LNG    = 2.1701;
    private const MAX_FUTURE_DAYS = 14;

    public function __construct(
        private EventsService       $events,
        private TicketmasterService $ticketmaster,
        private SongkickService     $songkick,
    ) {}

    public function current(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && !empty($cached)) {
            return $cached;
        }
        return $this->build();
    }

    public function today(): array
    {
        $today = now()->format('Y-m-d');
        return array_values(array_filter(
            $this->current(),
            fn (array $e): bool => ($e['start'] ?? null) === $today
                || (($e['start'] ?? null) <= $today && ($e['end'] ?? $today) >= $today),
        ));
    }

    public function nearby(float $lat, float $lng, float $radiusKm = 2.0): array
    {
        $result = [];
        foreach ($this->current() as $event) {
            if (!isset($event['lat'], $event['lng'])) continue;
            $distance = $this->haversine($lat, $lng, (float) $event['lat'], (float) $event['lng']);
            if ($distance <= $radiusKm) {
                $event['distance_km'] = round($distance, 2);
                $result[] = $event;
            }
        }
        usort($result, fn (array $a, array $b): int => ($a['distance_km'] <=> $b['distance_km']));
        return $result;
    }

    public function search(string $query, int $limit = 5): array
    {
        $events = $this->current();
        
        // Normalize query: remove accents, lowercase
        $query = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $query));
        
        // Extract words with more than 3 characters
        $terms = array_filter(str_word_count($query, 1), fn($t) => strlen($t) > 3);
        if (empty($terms)) return [];

        $matches = [];
        foreach ($events as $e) {
            $text = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', ($e['title'] ?? '') . ' ' . ($e['place'] ?? '') . ' ' . ($e['category'] ?? '')));
            $score = 0;
            foreach ($terms as $t) {
                if (str_contains($text, $t)) $score++;
            }
            if ($score > 0) {
                $e['_score'] = $score;
                $matches[] = $e;
            }
        }
        
        // Sort by highest score, then by start date
        usort($matches, function (array $a, array $b): int {
            if ($a['_score'] !== $b['_score']) return $b['_score'] <=> $a['_score'];
            return strcmp((string) ($a['start'] ?? '9999'), (string) ($b['start'] ?? '9999'));
        });
        
        return array_slice($matches, 0, $limit);
    }

    /**
     * Concise summary for the AI context — max ~15 events to keep prompt short.
     */
    public function getSummaryForContext(): string
    {
        $events = $this->current();
        if (empty($events)) return '';

        $today    = now()->format('Y-m-d');
        $todayEvs = [];
        $upcoming = [];

        foreach ($events as $e) {
            $start = $e['start'] ?? null;
            $end   = $e['end']   ?? null;
            $isToday = $start === $today || ($start && $start <= $today && $end && $end >= $today);
            if ($isToday) {
                $todayEvs[] = $e;
            } elseif ($start && $start > $today) {
                $upcoming[] = $e;
            }
        }

        // Prioritise concerts/sports/culture for AI context, limit total
        $selected = array_merge(
            array_slice($todayEvs, 0, 10),
            array_slice($upcoming, 0, 5),
        );

        $lines = [];
        foreach ($selected as $e) {
            $label = $e['title'];
            if ($e['start'] && $e['start'] > $today) {
                $label .= ' (' . $e['start'] . ')';
            }
            $meta = array_filter([$e['place'] ?? null, $e['time'] ?? null]);
            if ($meta) $label .= ' — ' . implode(', ', $meta);
            $lines[] = $label;
        }

        return implode('. ', $lines);
    }

    private function build(): array
    {
        $bcn = $this->events->getCurrent();
        if (empty($bcn)) {
            $bcn = $this->events->fetch();
        }

        $tm = $this->ticketmaster->getCurrent();
        $sk = $this->songkick->getCurrent();

        // Cross-source dedup: index BCN events by normalised title+date AND by title alone.
        // TM wins over BCN. Fallback: if TM has artist X on ANY date, remove all BCN "Concert X" entries
        // (handles BCN/TM date mismatches that break exact title+date matching).
        $bcnIndex      = [];   // title|date  → index
        $bcnTitleIndex = [];   // title-only  → [indices]
        foreach ($bcn as $i => $e) {
            $key      = $this->dedupKey($e['title'] ?? '', $e['start'] ?? '');
            $titleKey = $this->dedupKey($e['title'] ?? '', '');
            $bcnIndex[$key] = $i;
            $bcnTitleIndex[$titleKey][] = $i;
        }

        // Ticketmaster wins over BCN for same event (exact or title-only fallback)
        foreach ($tm as $e) {
            $key      = $this->dedupKey($e['title'] ?? '', $e['start'] ?? '');
            $titleKey = $this->dedupKey($e['title'] ?? '', '');
            if (isset($bcnIndex[$key])) {
                unset($bcn[$bcnIndex[$key]]);
            } elseif (isset($bcnTitleIndex[$titleKey])) {
                foreach ($bcnTitleIndex[$titleKey] as $idx) {
                    unset($bcn[$idx]);
                }
            }
        }

        // Songkick wins over BCN for same event; TM beats Songkick on same venue+date
        $tmVenueIndex = [];
        foreach ($tm as $e) {
            $vk = $this->dedupKey($e['place'] ?? '', $e['start'] ?? '', '');
            $tmVenueIndex[$vk] = true;
        }

        $skFiltered = [];
        foreach ($sk as $e) {
            $titleKey = $this->dedupKey($e['title'] ?? '', $e['start'] ?? '');
            // Remove BCN duplicate
            if (isset($bcnIndex[$titleKey])) {
                unset($bcn[$bcnIndex[$titleKey]]);
            }
            // Skip if TM already covers same venue+date
            $vk = $this->dedupKey($e['place'] ?? '', $e['start'] ?? '', '');
            if (!isset($tmVenueIndex[$vk])) {
                $skFiltered[] = $e;
            }
        }

        $raw = array_merge(array_values($bcn), $tm, $skFiltered);
        $today  = now()->format('Y-m-d');
        $cutoff = now()->addDays(self::MAX_FUTURE_DAYS)->format('Y-m-d');

        $enriched = [];
        foreach ($raw as $event) {
            $start = $event['start'] ?? null;
            $end   = $event['end']   ?? null;

            if ($start && $start > $cutoff) continue;
            if ($end   && $end   < $today)  continue;

            $lat = isset($event['lat']) && is_numeric($event['lat']) ? (float) $event['lat'] : null;
            $lng = isset($event['lng']) && is_numeric($event['lng']) ? (float) $event['lng'] : null;

            $source = $event['source'] ?? 'bcn';

            $enrichedEvent = [
                'title'    => $event['title'] ?? '',
                'category' => in_array($source, ['ticketmaster', 'eventbrite', 'songkick'], true)
                    ? ($event['category'] ?? 'altres')
                    : $this->deriveCategory($event),
                'place'    => $event['place']    ?? '',
                'district' => $event['district'] ?? '',
                'start'    => $start,
                'end'      => $end,
                'time'        => $event['time']        ?? null,
                'timetable'   => $event['timetable']   ?? null,
                'url'         => $event['url']         ?? null,
                'extra_dates' => $event['extra_dates'] ?? [],
                'source'      => $source,
                'lat'      => $lat,
                'lng'      => $lng,
                'today'    => $start === $today || ($start && $start <= $today && $end && $end >= $today),
                'distance_to_center_km' => null,
            ];

            if ($lat !== null && $lng !== null) {
                $enrichedEvent['distance_to_center_km'] = round(
                    $this->haversine(self::CENTER_LAT, self::CENTER_LNG, $lat, $lng),
                    2,
                );
            }

            $enriched[] = $enrichedEvent;
        }

        usort($enriched, function (array $a, array $b) use ($today): int {
            $aToday = $a['today'] ? 0 : 1;
            $bToday = $b['today'] ? 0 : 1;
            if ($aToday !== $bToday) return $aToday <=> $bToday;
            return strcmp((string) ($a['start'] ?? '9999'), (string) ($b['start'] ?? '9999'));
        });

        Cache::put(self::CACHE_KEY, $enriched, self::CACHE_TTL);
        return $enriched;
    }

    /**
     * Normalise title+date into a dedup key.
     * Strips accents, punctuation, "vip/package" suffixes so near-identical listings collapse.
     */
    private function dedupKey(string $a, string $b, string $c = ''): string
    {
        $norm = function (string $s): string {
            // iconv first so accented UPPERCASE (Í, Á, É...) become plain ASCII before strtolower
            $s = (string) iconv('UTF-8', 'ASCII//TRANSLIT', $s);
            $s = strtolower($s);
            // Strip leading event-type words that BCN data prepends
            $s = preg_replace('/^\s*(concert|festival|espectacle|taller|exposici[o]|cicle|fira)\s+["\'\<>]?/', '', $s);
            // Strip VIP/package suffixes
            $s = preg_replace('/\s*(vip|package|hospitality|premium|suite)\b.*/', '', $s);
            return preg_replace('/[^a-z0-9]/', '', $s);
        };
        return $norm($a) . '|' . $norm($b) . ($c !== '' ? '|' . $norm($c) : '');
    }

    private function deriveCategory(array $event): string
    {
        $title = strtolower($event['title'] ?? '');
        $text  = strtolower(implode(' ', [
            $event['title']    ?? '',
            $event['category'] ?? '',
            $event['place']    ?? '',
        ]));

        // Workshop/course prefixes take priority — avoid misclassifying
        // "Taller d'estimulació musical" as Música just because of the keyword
        $workshopPrefixes = ['taller', 'curs ', 'cursos', 'classe ', 'classes', 'xerrada', 'conferència', 'conferencia', 'seminari'];
        foreach ($workshopPrefixes as $prefix) {
            if (str_starts_with($title, $prefix) || str_contains($text, 'curs i taller') || str_contains($text, 'cursos i tallers')) {
                return 'cultura';
            }
        }

        $map = [
            'musica'      => ['música', 'musica', 'concert', 'concierto', 'jazz', 'rock', 'pop', 'opera', 'festival'],
            'esport'      => ['esport', 'deport', 'futbol', 'fútbol', 'basquet', 'bàsquet', 'marató', 'maraton', 'cursa', 'running'],
            'cultura'     => ['cultura', 'museu', 'museo', 'exposici', 'art', 'teatre', 'teatro', 'cinema', 'cine', 'literatura'],
            'gastronomia' => ['gastro', 'tast', 'cuina', 'cocina', 'food', 'vins', 'vinos', 'cervesa', 'cerveza'],
            'familia'     => ['família', 'familia', 'infants', 'niños', 'kids', 'children'],
        ];

        foreach ($map as $category => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($text, $kw)) return $category;
            }
        }

        return 'altres';
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6371.0;
        $dLat  = deg2rad($lat2 - $lat1);
        $dLng  = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
