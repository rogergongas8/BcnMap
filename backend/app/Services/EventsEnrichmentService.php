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

        // Cross-source dedup: index BCN events by normalised title+date.
        // If Ticketmaster has the same concert, prefer TM (has time, url, precise coords).
        $bcnIndex = [];
        foreach ($bcn as $i => $e) {
            $key = $this->dedupKey($e['title'] ?? '', $e['start'] ?? '');
            $bcnIndex[$key] = $i;
        }

        $tmKeys = [];
        foreach ($tm as $e) {
            $key = $this->dedupKey($e['title'] ?? '', $e['start'] ?? '');
            $tmKeys[$key] = true;
            // Remove matching BCN event so TM version wins
            if (isset($bcnIndex[$key])) {
                unset($bcn[$bcnIndex[$key]]);
            }
        }

        $raw    = array_merge(array_values($bcn), $tm);
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
                'category' => in_array($source, ['ticketmaster', 'eventbrite'], true)
                    ? ($event['category'] ?? 'altres')
                    : $this->deriveCategory($event),
                'place'    => $event['place']    ?? '',
                'district' => $event['district'] ?? '',
                'start'    => $start,
                'end'      => $end,
                'time'      => $event['time']      ?? null,
                'timetable' => $event['timetable'] ?? null,
                'url'       => $event['url']       ?? null,
                'source'   => $source,
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
    private function dedupKey(string $title, string $date): string
    {
        $t = iconv('UTF-8', 'ASCII//TRANSLIT', strtolower($title));
        $t = preg_replace('/\s*(vip|package|hospitality|premium|suite)[^$]*/i', '', $t);
        $t = preg_replace('/[^a-z0-9]/', '', (string) $t);
        return $t . '|' . $date;
    }

    private function deriveCategory(array $event): string
    {
        $text = strtolower(implode(' ', [
            $event['title']    ?? '',
            $event['category'] ?? '',
            $event['place']    ?? '',
        ]));

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
