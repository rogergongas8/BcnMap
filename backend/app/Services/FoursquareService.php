<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FoursquareService
{
    private const SEARCH_URL  = 'https://places-api.foursquare.com/places/search';
    private const PHOTOS_URL  = 'https://places-api.foursquare.com/places/%s/photos';
    private const API_VERSION = '2025-06-17';
    private const CACHE_TTL   = 86400;

    private function headers(): array
    {
        return [
            'Authorization'        => 'Bearer ' . config('services.foursquare.key'),
            'X-Places-Api-Version' => self::API_VERSION,
            'Accept'               => 'application/json',
        ];
    }

    public function findPlace(string $name, float $lat, float $lng): ?array
    {
        $cacheKey = 'fsq:place:' . md5($name . $lat . $lng);

        $cached = Cache::get($cacheKey);
        if ($cached !== null) return $cached;

        $result = $this->fetchPlace($name, $lat, $lng);
        if ($result !== null) {
            Cache::put($cacheKey, $result, self::CACHE_TTL);
        }
        return $result;
    }

    private function fetchPlace(string $name, float $lat, float $lng): ?array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(8)
                ->get(self::SEARCH_URL, [
                    'll'    => "{$lat},{$lng}",
                    'query' => $name,
                    'limit' => 1,
                    // New API: no 'radius' param, no 'fields' filter on free tier
                ]);

            if (!$response->successful()) {
                Log::warning('Foursquare search error: ' . $response->status() . ' — ' . $response->body());
                return null;
            }

            $results = $response->json('results', []);
            if (empty($results)) return null;

            $place = $results[0];
            $fsqId = $place['fsq_place_id'] ?? null; // new field name

            $photos = $fsqId ? $this->fetchPhotos($fsqId) : [];

            return $this->normalise($place, $photos);

        } catch (\Throwable $e) {
            Log::warning('FoursquareService exception: ' . $e->getMessage());
            return null;
        }
    }

    private function fetchPhotos(string $fsqId): array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(6)
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

    private function normalise(array $place, array $photos): array
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
            $hoursDisplay = $hours['display'] ?? null;
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
}
