<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FoursquareService;
use App\Services\PlaceEnrichService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PlaceEnrichController extends Controller
{
    public function __construct(
        private PlaceEnrichService $enrichService,
        private FoursquareService  $foursquareService,
    ) {}

    public function enrich(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:200',
            'lat'      => 'required|numeric|between:-90,90',
            'lng'      => 'required|numeric|between:-180,180',
            'category' => 'nullable|string|max:50',
            'lang'     => 'nullable|string|in:ca,es,en',
        ]);

        $name     = (string) $request->query('name');
        $lat      = (float)  $request->query('lat');
        $lng      = (float)  $request->query('lng');
        $category = (string) ($request->query('category') ?? '');
        $lang     = (string) ($request->query('lang') ?? 'ca');

        $cacheKey = 'enrich:ctrl:v1:' . md5($name . round($lat, 4) . round($lng, 4) . $category . $lang);
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return response()->json(['data' => $cached]);
        }

        // Foursquare: fotos + rating + horarios localizados
        $fsq  = config('services.foursquare.key')
            ? $this->foursquareService->findPlace($name, $lat, $lng, $lang)
            : null;

        // Wikipedia/Wikimedia: descripción + fotos para landmarks (skipped for commercial POIs)
        $wiki = $this->enrichService->enrich($name, $lat, $lng, $category);

        $data = $this->merge($fsq, $wiki);

        Cache::put($cacheKey, $data, 86400); // 24h — same as individual service caches

        return response()->json(['data' => $data]);
    }

    private function merge(?array $fsq, ?array $wiki): ?array
    {
        if (!$fsq && !$wiki) return null;

        // Foursquare primero (mayor calidad para lugares comerciales), Wikipedia como fallback
        $photos = [];
        foreach (array_merge($fsq['photos'] ?? [], $wiki['photos'] ?? []) as $url) {
            if ($url && !in_array($url, $photos, true)) {
                $photos[] = $url;
            }
        }

        $sources = array_values(array_filter([
            $fsq  ? 'Foursquare' : null,
            !empty($wiki['sources']) ? implode(' · ', $wiki['sources']) : null,
        ]));

        return [
            'photos'      => array_values(array_slice($photos, 0, 5)),
            'description' => $fsq['description'] ?? $wiki['description'] ?? null,
            'rating'      => $fsq['rating']   ?? $wiki['rating']   ?? null,
            'price'       => $fsq['price']    ?? null,
            'is_open_now' => $fsq['is_open_now'] ?? null,
            'website'     => $fsq['website']  ?? $wiki['website']  ?? null,
            'phone'       => $fsq['phone']    ?? $wiki['phone']    ?? null,
            'hours'       => $fsq['hours']    ?? $wiki['hours']    ?? null,
            'wiki_url'    => $wiki['wiki_url'] ?? null,
            'sources'     => $sources,
        ];
    }
}
