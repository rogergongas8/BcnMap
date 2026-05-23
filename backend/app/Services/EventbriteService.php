<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EventbriteService
{
    private const API_BASE   = 'https://www.eventbriteapi.com/v3';
    private const BCN_LAT    = 41.3851;
    private const BCN_LNG    = 2.1734;
    private const RADIUS     = '15km';
    private const CACHE_KEY  = 'eventbrite:events:current';
    private const CACHE_TTL  = 3600;

    // Eventbrite category_id → our internal category
    private const CATEGORY_MAP = [
        '103' => 'musica',      // Music
        '104' => 'cultura',     // Film, Media & Entertainment
        '105' => 'cultura',     // Performing & Visual Arts
        '107' => 'altres',      // Health & Wellness
        '109' => 'esport',      // Sports & Fitness
        '110' => 'gastronomia', // Food & Drink
        '113' => 'cultura',     // Community & Culture
        '115' => 'familia',     // Family & Education
        '116' => 'cultura',     // Fashion & Beauty
    ];

    public function fetch(): array
    {
        $token = env('EVENTBRITE_TOKEN');
        if (!$token) {
            return [];
        }

        try {
            $start = now()->startOfDay()->format('Y-m-d\TH:i:s');
            $end   = now()->addDays(14)->endOfDay()->format('Y-m-d\TH:i:s');

            $response = Http::timeout(15)
                ->withToken($token)
                ->get(self::API_BASE . '/events/search/', [
                    'location.latitude'      => self::BCN_LAT,
                    'location.longitude'     => self::BCN_LNG,
                    'location.within'        => self::RADIUS,
                    'start_date.range_start' => $start,
                    'start_date.range_end'   => $end,
                    'sort_by'                => 'date',
                    'expand'                 => 'venue',
                    'page_size'              => 100,
                    'locale'                 => 'ca_ES',
                ]);

            if (!$response->successful()) {
                Log::warning('EventbriteService: ' . $response->status() . ' — ' . $response->body());
                return [];
            }

            $today  = now()->format('Y-m-d');
            $events = [];

            foreach ($response->json('events', []) as $e) {
                $title = trim($e['name']['text'] ?? '');
                if (!$title) continue;

                $startLocal = $e['start']['local'] ?? null;
                $endLocal   = $e['end']['local']   ?? null;
                $startDate  = $startLocal ? substr($startLocal, 0, 10) : null;
                $startTime  = $startLocal ? substr($startLocal, 11, 5) : null;
                $endDate    = $endLocal   ? substr($endLocal,   0, 10) : $startDate;

                if ($endDate && $endDate < $today) continue;

                $lat = null;
                $lng = null;
                $venueName = $e['venue']['name'] ?? '';

                $addrLat = $e['venue']['address']['latitude']  ?? null;
                $addrLng = $e['venue']['address']['longitude'] ?? null;

                if (is_numeric($addrLat) && is_numeric($addrLng)) {
                    $lat = (float) $addrLat;
                    $lng = (float) $addrLng;

                    // Discard coords outside the Barcelona area
                    if ($lat < 41.25 || $lat > 41.55 || $lng < 1.95 || $lng > 2.35) {
                        $lat = null;
                        $lng = null;
                    }
                }

                $categoryId = (string) ($e['category_id'] ?? '');
                $category   = self::CATEGORY_MAP[$categoryId] ?? 'altres';

                $events[] = [
                    'title'    => $title,
                    'category' => $category,
                    'place'    => $venueName,
                    'district' => '',
                    'start'    => $startDate,
                    'end'      => $endDate,
                    'time'     => $startTime,
                    'url'      => $e['url'] ?? null,
                    'lat'      => $lat,
                    'lng'      => $lng,
                    'today'    => $startDate === $today,
                    'source'   => 'eventbrite',
                ];
            }

            Cache::put(self::CACHE_KEY, $events, self::CACHE_TTL);
            return $events;

        } catch (\Throwable $e) {
            Log::warning('EventbriteService exception: ' . $e->getMessage());
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
