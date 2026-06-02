<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PlaceCache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FoursquareService
{
    private const SEARCH_URL  = 'https://places-api.foursquare.com/places/search';
    private const PHOTOS_URL  = 'https://places-api.foursquare.com/places/%s/photos';
    private const API_VERSION = '2025-06-17';
    private const CACHE_TTL   = 2592000; // 30 days

    private function headers(): array
    {
        return [
            'Authorization'        => 'Bearer ' . config('services.foursquare.key'),
            'X-Places-Api-Version' => self::API_VERSION,
            'Accept'               => 'application/json',
        ];
    }

    private const DAY_NAMES = [
        'ca' => ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'],
        'es' => ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'],
        'en' => ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    ];

    public function findPlace(string $name, float $lat, float $lng, string $lang = 'ca'): ?array
    {
        $hash = md5($name . round($lat, 4) . round($lng, 4) . $lang);
        $placeCache = PlaceCache::where('hash_key', $hash)->first();

        // 1. If we have it in DB and it's less than 30 days old, return it instantly
        if ($placeCache && $placeCache->last_fetched_at && $placeCache->last_fetched_at->diffInDays(now()) < 30) {
            return $placeCache->data;
        }

        // 2. Fetch from Foursquare API
        $result = $this->fetchPlace($name, $lat, $lng, $lang);

        if ($result !== null) {
            // 3a. Save or update the DB backup
            PlaceCache::updateOrCreate(
                ['hash_key' => $hash],
                [
                    'name' => $name,
                    'lat' => $lat,
                    'lng' => $lng,
                    'lang' => $lang,
                    'data' => $result,
                    'last_fetched_at' => now(),
                ]
            );
            return $result;
        }

        // 3b. THE SUPERPOWER: If Foursquare fails/times out, but we have an old DB backup, use it!
        if ($placeCache) {
            Log::info("Foursquare API failed for {$name}. Falling back to old database cache.");
            return $placeCache->data;
        }

        return null;
    }

    private function fetchPlace(string $name, float $lat, float $lng, string $lang = 'ca'): ?array
    {
        // Map app lang codes to locale codes Foursquare understands
        $locale = match($lang) {
            'ca' => 'ca',
            'es' => 'es',
            default => 'en',
        };

        try {
            $response = Http::withHeaders(array_merge($this->headers(), ['Accept-Language' => $locale]))
                ->timeout(5)
                ->get(self::SEARCH_URL, [
                    'll'     => "{$lat},{$lng}",
                    'query'  => $name,
                    'limit'  => 1,
                    'fields' => 'fsq_place_id,name,rating,price,hours,photos,website,tel,description,categories,stats,link',
                ]);

            if (!$response->successful()) {
                Log::warning('Foursquare search error: ' . $response->status() . ' — ' . $response->body());
                return null;
            }

            $results = $response->json('results', []);
            if (empty($results)) return null;

            $place = $results[0];
            $fsqId = $place['fsq_place_id'] ?? null;

            // Skip separate photos request if search already returned photos
            $photos = (!empty($place['photos']) || !$fsqId) ? [] : $this->fetchPhotos($fsqId);

            return $this->normalise($place, $photos, $lang);

        } catch (\Throwable $e) {
            Log::warning('FoursquareService exception: ' . $e->getMessage());
            return null;
        }
    }

    private function fetchPhotos(string $fsqId): array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(4)
                ->get(sprintf(self::PHOTOS_URL, $fsqId), [
                    'limit' => 5,
                    'sort'  => 'POPULAR',
                ]);

            if (!$response->successful()) return [];

            return $response->json() ?? [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function normalise(array $place, array $photos, string $lang = 'ca'): array
    {
        $photoUrls = [];
        foreach ($photos as $p) {
            $prefix = $p['prefix'] ?? null;
            $suffix = $p['suffix'] ?? null;
            if ($prefix && $suffix) {
                $photoUrls[] = $prefix . 'original' . $suffix;
            }
        }

        // New API: photos may also be in search result
        foreach ($place['photos'] ?? [] as $p) {
            $prefix = $p['prefix'] ?? null;
            $suffix = $p['suffix'] ?? null;
            if ($prefix && $suffix) {
                $url = $prefix . 'original' . $suffix;
                if (!in_array($url, $photoUrls)) $photoUrls[] = $url;
            }
        }

        // Rating: 0-10 → 0-5
        $rawRating = $place['rating'] ?? null;
        $rating    = $rawRating !== null ? round($rawRating / 2, 1) : null;

        // Price: integer 1-4 → €/€€/€€€/€€€€
        $price    = $place['price'] ?? null;
        $priceStr = $price ? str_repeat('€', (int) $price) : null;

        // Hours (premium field — may be absent on free tier)
        $hoursDisplay = null;
        $isOpenNow    = null;
        $hours        = $place['hours'] ?? [];
        if (!empty($hours)) {
            $isOpenNow    = $hours['open_now'] ?? null;
            // Prefer our own formatted hours over Foursquare's English display string
            $regular      = $hours['regular'] ?? [];
            $hoursDisplay = !empty($regular)
                ? $this->formatHours($regular, $lang)
                : ($hours['display'] ?? null);
        }

        $categories   = $place['categories'] ?? [];
        $category     = !empty($categories) ? ($categories[0]['name'] ?? null) : null;
        $totalRatings = $place['stats']['total_ratings'] ?? null;

        // New API uses fsq_place_id
        $id = $place['fsq_place_id'] ?? $place['fsq_id'] ?? null;

        // Build foursquare.com link for the place
        $link = $id ? 'https://foursquare.com' . ($place['link'] ?? '/places/' . $id) : null;

        return [
            'fsq_id'        => $id,
            'name'          => $place['name'] ?? null,
            'rating'        => $rating,
            'rating_raw'    => $rawRating,
            'total_ratings' => $totalRatings,
            'price'         => $priceStr,
            'is_open_now'   => $isOpenNow,
            'hours'         => $hoursDisplay,
            'category'      => $category,
            'description'   => $place['description'] ?? null,
            'website'       => $place['website'] ?? null,
            'phone'         => $place['tel'] ?? null,
            'foursquare_url'=> $link,
            'photos'        => array_values(array_slice($photoUrls, 0, 3)),
        ];
    }

    /**
     * Format Foursquare hours.regular array into a locale-aware string.
     * regular: [{ day: 1, open: "0900", close: "2200" }, ...] (1=Monday..7=Sunday)
     */
    private function formatHours(array $regular, string $lang): string
    {
        $dayNames = self::DAY_NAMES[$lang] ?? self::DAY_NAMES['en'];

        // Group consecutive days with same hours
        $byHours = [];
        foreach ($regular as $slot) {
            $dayIdx = (int)($slot['day'] ?? 0) - 1; // 0=Monday..6=Sunday
            if ($dayIdx < 0 || $dayIdx > 6) continue;
            $open  = $this->fmtTime($slot['open']  ?? '0000');
            $close = $this->fmtTime($slot['close'] ?? '2359');
            $key   = "{$open}–{$close}";
            $byHours[$key][] = $dayIdx;
        }

        $lines = [];
        foreach ($byHours as $timeRange => $dayIdxs) {
            sort($dayIdxs);
            $dayStr  = $this->consecutiveRanges($dayIdxs, $dayNames);
            $lines[] = $dayStr . ' ' . $timeRange;
        }

        return implode('; ', $lines);
    }

    private function fmtTime(string $t): string
    {
        $t = str_pad(preg_replace('/[^0-9]/', '', $t), 4, '0', STR_PAD_LEFT);
        return substr($t, 0, 2) . ':' . substr($t, 2, 2);
    }

    private function consecutiveRanges(array $dayIdxs, array $dayNames): string
    {
        if (empty($dayIdxs)) return '';
        $ranges = [];
        $start  = $dayIdxs[0];
        $prev   = $dayIdxs[0];
        for ($i = 1; $i < count($dayIdxs); $i++) {
            if ($dayIdxs[$i] === $prev + 1) {
                $prev = $dayIdxs[$i];
            } else {
                $ranges[] = $start === $prev ? $dayNames[$start] : $dayNames[$start] . '–' . $dayNames[$prev];
                $start = $prev = $dayIdxs[$i];
            }
        }
        $ranges[] = $start === $prev ? $dayNames[$start] : $dayNames[$start] . '–' . $dayNames[$prev];
        return implode(', ', $ranges);
    }
}
