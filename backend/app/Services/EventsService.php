<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EventsService
{
    private const RESOURCE_ID     = '3abb2414-1ee0-446e-9c25-380e938adb73';
    private const API_URL         = 'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search';
    private const SQL_URL         = 'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search_sql';
    private const CACHE_KEY       = 'bcn:events:current';
    private const CACHE_TTL       = 86400; // 24h — events:refresh runs once daily at 04:00
    private const MAX_FUTURE_DAYS = 30;
    private const FETCH_LIMIT     = 1000;

    // Fallback coordinates for events that have no lat/lon in the API
    // Keyed by lowercase substring of institution_name
    private const VENUE_COORDS = [
        'auditori'              => [41.3907, 2.1726],
        'palau de la música'    => [41.3875, 2.1753],
        'palau de la musica'    => [41.3875, 2.1753],
        'gran teatre del liceu' => [41.3797, 2.1733],
        'liceu'                 => [41.3797, 2.1733],
        'palau sant jordi'      => [41.3641, 2.1505],
        'estadi olímpic'        => [41.3642, 2.1535],
        'estadi olimpic'        => [41.3642, 2.1535],
        'camp nou'              => [41.3809, 2.1228],
        'macba'                 => [41.3826, 2.1664],
        'mnac'                  => [41.3688, 2.1527],
        'cccb'                  => [41.3821, 2.1659],
        'museu picasso'         => [41.3851, 2.1808],
        'fundació joan miró'    => [41.3685, 2.1599],
        'fundacio joan miro'    => [41.3685, 2.1599],
        'teatre nacional'       => [41.3920, 2.1759],
        'tnc'                   => [41.3920, 2.1759],
        'mercat de les flors'   => [41.3706, 2.1574],
        'sala apolo'            => [41.3750, 2.1660],
        'razzmatazz'            => [41.3999, 2.1917],
        'parc de la ciutadella' => [41.3854, 2.1867],
        'zoo de barcelona'      => [41.3837, 2.1867],
        'parc güell'            => [41.4145, 2.1527],
        'parc guell'            => [41.4145, 2.1527],
        'velòdrom'              => [41.4248, 2.1636],
        'velodrom'              => [41.4248, 2.1636],
        'tibidabo'              => [41.4219, 2.1189],
        'pavelló olímpic'       => [41.3815, 2.1224],
    ];

    public function fetch(): array
    {
        try {
            $today  = now()->format('Y-m-d');
            $cutoff = now()->addDays(self::MAX_FUTURE_DAYS)->format('Y-m-d');

            // Use SQL endpoint to filter server-side — avoids fetching old/past events
            $floor = now()->subDays(1)->format('Y-m-d');

            $sql = sprintf(
                'SELECT * FROM "%s" WHERE start_date >= \'%s\' AND start_date <= \'%s\' AND (end_date >= \'%s\' OR end_date IS NULL) ORDER BY start_date ASC LIMIT %d',
                self::RESOURCE_ID,
                $floor,
                $cutoff,
                $today,
                self::FETCH_LIMIT,
            );

            $response = Http::timeout(20)->get(self::SQL_URL, ['sql' => $sql]);

            if (!$response->successful()) {
                Log::warning('EventsService: API returned ' . $response->status());
                return [];
            }

            $records = $response->json('result.records', []);
            $events  = [];

            foreach ($records as $r) {
                $name = $this->cleanText($r['name'] ?? '');
                if (!$name) continue;

                $start = $r['start_date'] ? substr((string) $r['start_date'], 0, 10) : null;
                $end   = $r['end_date']   ? substr((string) $r['end_date'],   0, 10) : null;

                $category = $this->cleanText($r['secondary_filters_name'] ?? '');
                $place    = $this->cleanText($r['institution_name']        ?? '');
                $district = $this->cleanText($r['addresses_district_name'] ?? '');

                // Coordinates — API field names are geo_epgs_4326_lat / geo_epgs_4326_lon
                $lat = is_numeric($r['geo_epgs_4326_lat'] ?? null) ? (float) $r['geo_epgs_4326_lat'] : null;
                $lng = is_numeric($r['geo_epgs_4326_lon'] ?? null) ? (float) $r['geo_epgs_4326_lon'] : null;

                // Validate: coords must be inside the Greater Barcelona bounding box
                if ($lat !== null && ($lat < 41.25 || $lat > 41.55 || $lng < 1.95 || $lng > 2.35)) {
                    $lat = null;
                    $lng = null;
                }

                // Fallback: look up venue by name
                if ($lat === null && $place !== '') {
                    [$lat, $lng] = $this->lookupVenueCoords($place);
                }

                $timetable = $this->cleanText($r['timetable'] ?? '');

                $events[] = [
                    'title'     => $name,
                    'category'  => $category,
                    'place'     => $place,
                    'district'  => $district,
                    'start'     => $start,
                    'end'       => $end,
                    'timetable' => $timetable ?: null,
                    'lat'       => $lat,
                    'lng'       => $lng,
                ];
            }

            Cache::put(self::CACHE_KEY, $events, self::CACHE_TTL);
            Cache::forget('events:enriched:current');
            return $events;

        } catch (\Throwable $e) {
            Log::warning('EventsService exception: ' . $e->getMessage());
            return [];
        }
    }

    private function lookupVenueCoords(string $place): array
    {
        $lower = mb_strtolower($place);
        foreach (self::VENUE_COORDS as $key => [$lat, $lng]) {
            if (str_contains($lower, $key)) {
                return [$lat, $lng];
            }
        }
        return [null, null];
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    public function getSummaryForContext(): string
    {
        $events = $this->getCurrent();
        if (empty($events)) return '';

        $today = now()->format('Y-m-d');

        // Separate today's events from upcoming, prioritise today's
        $todayEvents    = [];
        $upcomingEvents = [];
        foreach ($events as $e) {
            $start   = $e['start'] ?? null;
            $end     = $e['end']   ?? null;
            $isToday = $start === $today
                || ($start && $start <= $today && $end && $end >= $today);
            if ($isToday) {
                $todayEvents[] = $e;
            } else {
                $upcomingEvents[] = $e;
            }
        }

        // Up to 15 today + 5 upcoming = 20 total sent to the AI
        $selected = array_merge(
            array_slice($todayEvents, 0, 15),
            array_slice($upcomingEvents, 0, 5),
        );

        $lines = [];
        foreach ($selected as $e) {
            $line = $e['title'];

            if ($e['start'] && $e['start'] > $today) {
                $line .= ' (a partir del ' . $e['start'] . ')';
            } elseif ($e['end']) {
                $line .= ' (hasta el ' . $e['end'] . ')';
            }

            $loc = array_filter([$e['place'], $e['district']]);
            if ($loc) $line .= ' — ' . implode(', ', $loc);

            $lines[] = $line;
        }

        return implode('. ', $lines);
    }

    private function cleanText(string $text): string
    {
        $text = trim($text);
        // Remove only surrounding double-quotes (CSV artefact); single quotes are part of BCN event title format
        $text = preg_replace('/^"+|"+$/', '', $text);
        $text = str_replace('""', '', $text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Skip values that are just a numeric district code
        if (preg_match('/^\d+$/', trim($text))) return '';
        return trim(preg_replace('/\s+/', ' ', $text));
    }
}
