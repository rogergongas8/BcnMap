<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FoursquareService
{
    private const SEARCH_URL  = 'https://api.foursquare.com/v3/places/search';
    private const PHOTOS_URL  = 'https://api.foursquare.com/v3/places/%s/photos';
    private const CACHE_TTL   = 86400; // 24h — saves API quota

    private function headers(): array
    {
        return [
            'Authorization' => config('services.foursquare.key'),
            'Accept'        => 'application/json',
        ];
    }

    /**
     * Find a place by name + coordinates and return enriched data.
     * Returns null if not found or API unavailable.
     */
    public function findPlace(string $name, float $lat, float $lng): ?array
    {
        $cacheKey = 'fsq:place:' . md5($name . $lat . $lng);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($name, $lat, $lng) {
            return $this->fetchPlace($name, $lat, $lng);
        });
    }

    private function fetchPlace(string $name, float $lat, float $lng): ?array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(8)
                ->get(self::SEARCH_URL, [
                    'll'     => "{$lat},{$lng}",
                    'query'  => $name,
                    'limit'  => 1,
                    'radius' => 200, // tight radius — we want the exact place
                    'fields' => 'fsq_id,name,rating,stats,price,hours,categories,location,photos,description,website,tel',
                ]);

            if (!$response->successful()) {
                Log::warning('Foursquare search error: ' . $response->status());
                return null;
            }

            $results = $response->json('results', []);
            if (empty($results)) return null;

            $place = $results[0];
            $fsqId = $place['fsq_id'] ?? null;

            // Fetch photos separately (search endpoint returns limited photo data)
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
                    'limit'      => 3,
                    'sort'       => 'POPULAR',
                    'classifications' => 'outdoor,indoor',
                ]);

            if (!$response->successful()) return [];

            return $response->json() ?? [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function normalise(array $place, array $photos): array
    {
        // Build photo URLs: prefix + original size + suffix
        $photoUrls = [];
        foreach ($photos as $p) {
            $prefix = $p['prefix'] ?? null;
            $suffix = $p['suffix'] ?? null;
            if ($prefix && $suffix) {
                $photoUrls[] = $prefix . 'original' . $suffix;
            }
        }

        // Also grab any photo from the search result itself
        foreach ($place['photos'] ?? [] as $p) {
            $prefix = $p['prefix'] ?? null;
            $suffix = $p['suffix'] ?? null;
            if ($prefix && $suffix) {
                $url = $prefix . 'original' . $suffix;
                if (!in_array($url, $photoUrls)) {
                    $photoUrls[] = $url;
                }
            }
        }

        // Rating is 0-10 in Foursquare, convert to 0-5 for display
        $rawRating = $place['rating'] ?? null;
        $rating    = $rawRating !== null ? round($rawRating / 2, 1) : null;

        // Price: 1=€, 2=€€, 3=€€€, 4=€€€€
        $price     = $place['price'] ?? null;
        $priceStr  = $price ? str_repeat('€', (int) $price) : null;

        // Hours
        $hoursDisplay = null;
        $isOpenNow    = null;
        $hours        = $place['hours'] ?? [];
        if (!empty($hours)) {
            $isOpenNow    = $hours['open_now'] ?? null;
            $hoursDisplay = $hours['display'] ?? null;
        }

        // Category label
        $categories = $place['categories'] ?? [];
        $category   = !empty($categories) ? ($categories[0]['name'] ?? null) : null;

        // Total ratings count
        $totalRatings = $place['stats']['total_ratings'] ?? null;

        return [
            'fsq_id'       => $place['fsq_id'] ?? null,
            'name'         => $place['name'] ?? null,
            'rating'       => $rating,
            'rating_raw'   => $rawRating,
            'total_ratings'=> $totalRatings,
            'price'        => $priceStr,
            'is_open_now'  => $isOpenNow,
            'hours'        => $hoursDisplay,
            'category'     => $category,
            'description'  => $place['description'] ?? null,
            'website'      => $place['website'] ?? null,
            'phone'        => $place['tel'] ?? null,
            'photos'       => array_values(array_slice($photoUrls, 0, 3)),
        ];
    }
}
