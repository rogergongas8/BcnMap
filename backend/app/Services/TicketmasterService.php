<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TicketmasterService
{
    private const API_BASE  = 'https://app.ticketmaster.com/discovery/v2';
    private const CACHE_KEY = 'ticketmaster:events:current';
    private const CACHE_TTL = 86400; // 24h — events:refresh runs once daily at 04:00

    private const SEGMENT_MAP = [
        'Music'  => 'musica',
        'Sports' => 'esport',
        'Arts & Theatre' => 'cultura',
        'Film'   => 'cultura',
        'Family' => 'familia',
        'Miscellaneous' => 'altres',
    ];

    private const GENRE_MAP = [
        'Classical' => 'cultura',
        'Opera'     => 'cultura',
        'Jazz'      => 'musica',
        'Blues'     => 'musica',
        'Electronic' => 'musica',
        'Hip-Hop'   => 'musica',
        'R&B'       => 'musica',
        'Pop'       => 'musica',
        'Rock'      => 'musica',
        'Folk'      => 'musica',
        'Food'      => 'gastronomia',
        'Culinary'  => 'gastronomia',
    ];

    public function fetch(): array
    {
        $apiKey = env('TICKETMASTER_API_KEY');
        if (!$apiKey) {
            return [];
        }

        try {
            $today  = now()->format('Y-m-d') . 'T00:00:00Z';
            $cutoff = now()->addDays(30)->format('Y-m-d') . 'T23:59:59Z';

            $response = Http::timeout(15)->get(self::API_BASE . '/events.json', [
                'apikey'      => $apiKey,
                'city'        => 'Barcelona',
                'countryCode' => 'ES',
                'startDateTime' => $today,
                'endDateTime'   => $cutoff,
                'size'        => 200,
                'sort'        => 'date,asc',
            ]);

            if (!$response->successful()) {
                Log::warning('TicketmasterService: ' . $response->status() . ' — ' . $response->body());
                return [];
            }

            $raw    = $response->json('_embedded.events', []);
            $seenVenueDate = [];   // venue|date      → index (prevents exact duplicates)
            $seenTitleVenue = [];  // normTitle|venue → index (groups multi-night runs)
            $events = [];

            foreach ($raw as $e) {
                $title = trim($e['name'] ?? '');
                if (!$title) continue;

                $startDate = $e['dates']['start']['localDate'] ?? null;
                $startTime = isset($e['dates']['start']['localTime'])
                    ? substr($e['dates']['start']['localTime'], 0, 5)
                    : null;

                if (!$startDate) continue;

                $venue  = $e['_embedded']['venues'][0] ?? [];
                $lat    = is_numeric($venue['location']['latitude'] ?? null)  ? (float) $venue['location']['latitude']  : null;
                $lng    = is_numeric($venue['location']['longitude'] ?? null) ? (float) $venue['location']['longitude'] : null;

                if ($lat !== null && ($lat < 41.25 || $lat > 41.55 || $lng < 1.95 || $lng > 2.35)) {
                    $lat = null;
                    $lng = null;
                }

                $segment   = $e['classifications'][0]['segment']['name'] ?? '';
                $genre     = $e['classifications'][0]['genre']['name']   ?? '';
                $category  = self::GENRE_MAP[$genre] ?? self::SEGMENT_MAP[$segment] ?? 'altres';
                $venueName = $venue['name'] ?? '';

                // Skip obvious package/VIP listings
                if (preg_match('/\b(VIP|Package|Hospitality|Premium|Suite)\b/i', $title)) {
                    continue;
                }

                $normalVenue = preg_replace('/[^a-z0-9]/', '', strtolower((string) iconv('UTF-8', 'ASCII//TRANSLIT', $venueName)));
                $normalTitle = preg_replace('/[^a-z0-9]/', '', strtolower((string) iconv('UTF-8', 'ASCII//TRANSLIT', $title)));

                // Exact duplicate: same venue + date → keep earliest time only
                $venueDateKey = $normalVenue . '|' . $startDate;
                if (isset($seenVenueDate[$venueDateKey])) {
                    $existing = &$events[$seenVenueDate[$venueDateKey]];
                    if ($startTime && (!$existing['time'] || $startTime < $existing['time'])) {
                        $existing['time'] = $startTime;
                    }
                    continue;
                }

                // Multi-night run: same title at same venue → extend date range, collect dates
                $titleVenueKey = $normalTitle . '|' . $normalVenue;
                if (isset($seenTitleVenue[$titleVenueKey])) {
                    $existing = &$events[$seenTitleVenue[$titleVenueKey]];
                    // Extend end date and accumulate dates for display
                    if ($startDate > ($existing['end'] ?? $startDate)) {
                        $existing['end'] = $startDate;
                    }
                    $existing['extra_dates'][] = $startDate;
                    $seenVenueDate[$venueDateKey] = $seenTitleVenue[$titleVenueKey];
                    continue;
                }

                $seenVenueDate[$venueDateKey]   = count($events);
                $seenTitleVenue[$titleVenueKey] = count($events);
                $events[] = [
                    'title'       => $title,
                    'category'    => $category,
                    'place'       => $venueName,
                    'district'    => '',
                    'start'       => $startDate,
                    'end'         => $startDate,
                    'time'        => $startTime,
                    'extra_dates' => [],
                    'url'         => $e['url'] ?? null,
                    'lat'         => $lat,
                    'lng'         => $lng,
                    'source'      => 'ticketmaster',
                ];
            }

            Cache::put(self::CACHE_KEY, $events, self::CACHE_TTL);
            return $events;

        } catch (\Throwable $e) {
            Log::warning('TicketmasterService exception: ' . $e->getMessage());
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
}
