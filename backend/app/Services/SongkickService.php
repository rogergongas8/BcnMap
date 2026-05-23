<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SongkickService
{
    private const API_BASE    = 'https://api.songkick.com/api/3.0';
    private const METRO_ID    = 28714; // Barcelona
    private const CACHE_KEY   = 'songkick:events:current';
    private const CACHE_TTL   = 86400; // 24h — events:refresh owns the schedule

    private const GENRE_CATEGORY = [
        'classical'   => 'cultura',
        'opera'       => 'cultura',
        'jazz'        => 'musica',
        'blues'       => 'musica',
        'folk'        => 'musica',
        'electronic'  => 'musica',
        'hip-hop'     => 'musica',
        'r&b'         => 'musica',
        'pop'         => 'musica',
        'rock'        => 'musica',
        'metal'       => 'musica',
        'indie'       => 'musica',
        'country'     => 'musica',
        'reggae'      => 'musica',
        'latin'       => 'musica',
        'world'       => 'musica',
        'comedy'      => 'cultura',
        'theatre'     => 'cultura',
        'film'        => 'cultura',
        'sport'       => 'esport',
        'family'      => 'familia',
        'food'        => 'gastronomia',
    ];

    public function fetch(): array
    {
        $apiKey = env('SONGKICK_API_KEY');
        if (!$apiKey) {
            return [];
        }

        try {
            $today  = now()->format('Y-m-d');
            $cutoff = now()->addDays(30)->format('Y-m-d');
            $events = [];
            $page   = 1;

            do {
                $response = Http::timeout(15)->get(
                    self::API_BASE . '/metro_areas/' . self::METRO_ID . '/calendar.json',
                    [
                        'apikey'   => $apiKey,
                        'min_date' => $today,
                        'max_date' => $cutoff,
                        'per_page' => 50,
                        'page'     => $page,
                    ]
                );

                if (!$response->successful()) {
                    Log::warning('SongkickService: ' . $response->status() . ' — ' . $response->body());
                    break;
                }

                $results   = $response->json('resultsPage', []);
                $raw       = $results['results']['event'] ?? [];
                $totalEntries = (int) ($results['totalEntries'] ?? 0);
                $perPage   = (int) ($results['perPage'] ?? 50);

                foreach ($raw as $e) {
                    $parsed = $this->parseEvent($e, $today);
                    if ($parsed) {
                        $events[] = $parsed;
                    }
                }

                $fetched = ($page - 1) * $perPage + count($raw);
                $page++;

            } while ($fetched < $totalEntries && $fetched < 200 && !empty($raw));

            // Deduplicate by venue+date (Songkick can list same show multiple times)
            $seen   = [];
            $unique = [];
            foreach ($events as $e) {
                $key = $this->dedupKey($e['title'], $e['place'] ?? '', $e['start'] ?? '');
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $unique[]   = $e;
                }
            }

            Cache::put(self::CACHE_KEY, $unique, self::CACHE_TTL);
            return $unique;

        } catch (\Throwable $e) {
            Log::warning('SongkickService exception: ' . $e->getMessage());
            return [];
        }
    }

    public function getCurrent(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && !empty($cached)) {
            return $cached;
        }
        return $this->fetch();
    }

    private function parseEvent(array $e, string $today): ?array
    {
        $title = trim($e['displayName'] ?? '');
        if (!$title) return null;

        $start = $e['start']['date'] ?? null;
        $end   = $e['end']['date']   ?? $start;
        $time  = isset($e['start']['time']) && $e['start']['time']
            ? substr($e['start']['time'], 0, 5)
            : null;

        if (!$start || $start < $today) return null;

        $venue   = $e['venue'] ?? [];
        $lat     = is_numeric($venue['lat'] ?? null) ? (float) $venue['lat'] : null;
        $lng     = is_numeric($venue['lng'] ?? null) ? (float) $venue['lng'] : null;
        $place   = trim($venue['displayName'] ?? '');

        // Discard coords outside Barcelona
        if ($lat !== null && ($lat < 41.25 || $lat > 41.55 || $lng < 1.95 || $lng > 2.35)) {
            $lat = null;
            $lng = null;
        }

        // Derive category from type or performance genres
        $type = strtolower($e['type'] ?? '');
        $category = $type === 'festival' ? 'musica' : 'musica'; // Songkick is music-focused

        $performances = $e['performance'] ?? [];
        if (!empty($performances)) {
            $artistName = $performances[0]['artist']['displayName'] ?? '';
            // Use as subtitle hint — keep in title if supporting act
            if (count($performances) > 1) {
                $others = array_slice($performances, 1, 2);
                $supporting = implode(', ', array_map(fn($p) => $p['artist']['displayName'] ?? '', $others));
                if ($supporting) {
                    $title .= ' + ' . $supporting;
                }
            }
        }

        $url = $e['uri'] ?? null;

        return [
            'title'    => $title,
            'category' => $category,
            'place'    => $place,
            'district' => '',
            'start'    => $start,
            'end'      => $end ?? $start,
            'time'     => $time,
            'url'      => $url,
            'lat'      => $lat,
            'lng'      => $lng,
            'source'   => 'songkick',
        ];
    }

    private function dedupKey(string $title, string $place, string $date): string
    {
        $t = iconv('UTF-8', 'ASCII//TRANSLIT', strtolower($title));
        $t = preg_replace('/[^a-z0-9]/', '', (string) $t);
        $p = iconv('UTF-8', 'ASCII//TRANSLIT', strtolower($place));
        $p = preg_replace('/[^a-z0-9]/', '', (string) $p);
        return $t . '|' . $p . '|' . $date;
    }
}
