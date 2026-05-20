<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PoiService
{
    private const OVERPASS   = 'https://overpass-api.de/api/interpreter';
    private const NOMINATIM  = 'https://nominatim.openstreetmap.org/search';
    private const USER_AGENT = 'BCN-Live/1.0';
    private const CACHE_TTL  = 1800; // 30 min

    // BCN bbox para Nominatim (minLng,minLat,maxLng,maxLat)
    private const BCN_VIEWBOX = '2.05,41.32,2.23,41.47';

    // Categoría → lista de cláusulas Overpass. Cada cláusula es [key, value].
    private const CATEGORY_TAGS = [
        'restaurant'  => [['amenity',  'restaurant']],
        'cafe'        => [['amenity',  'cafe']],
        'bar'         => [['amenity',  'bar']],
        'museum'      => [['tourism',  'museum']],
        'pharmacy'    => [['amenity',  'pharmacy']],
        'supermarket' => [['shop',     'supermarket']],
        'hotel'       => [['tourism',  'hotel']],
        'monument'    => [['historic', 'monument']],
        'bakery'      => [['shop',     'bakery']],
        'bank'        => [['amenity',  'bank']],
        'hospital'    => [['amenity',  'hospital']],
        'attraction'  => [['tourism',  'attraction']],
    ];

    /**
     * Lista de categorías soportadas. Útil para comandos/UI.
     *
     * @return string[]
     */
    public static function categories(): array
    {
        return array_keys(self::CATEGORY_TAGS);
    }

    /**
     * POIs alrededor de un punto, filtrados por categoría.
     *
     * @param string[] $categories  Categorías a buscar. Vacío → []
     * @return array<int, array<string, mixed>>
     */
    public function nearby(float $lat, float $lng, int $radiusM, array $categories): array
    {
        $categories = array_values(array_unique(array_filter(
            $categories,
            fn ($c) => is_string($c) && isset(self::CATEGORY_TAGS[$c])
        )));

        if (empty($categories)) {
            return [];
        }

        sort($categories);

        // Redondea para que pequeños pan no invaliden caché. ~11m en BCN.
        $cacheKey = sprintf(
            'pois:%s:%s:%d:%s',
            number_format($lat, 4, '.', ''),
            number_format($lng, 4, '.', ''),
            $radiusM,
            implode(',', $categories)
        );

        return Cache::remember(
            $cacheKey,
            self::CACHE_TTL,
            fn () => $this->fetchFromOverpass($lat, $lng, $radiusM, $categories)
        );
    }

    /**
     * Busca POIs por nombre vía Nominatim, restringido al área de Barcelona.
     */
    public function searchByName(string $query, ?float $lat = null, ?float $lng = null): array
    {
        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return [];
        }

        try {
            $params = [
                'q'              => $query,
                'format'         => 'json',
                'limit'          => 12,
                'viewbox'        => self::BCN_VIEWBOX,
                'bounded'        => 1,
                'countrycodes'   => 'es',
                'addressdetails' => 1,
                'namedetails'    => 1,
                'extratags'      => 1,
            ];

            $response = Http::timeout(15)
                ->withHeaders([
                    'User-Agent'      => self::USER_AGENT,
                    'Accept-Language' => 'ca,es',
                ])
                ->get(self::NOMINATIM, $params);

            if (!$response->successful()) {
                Log::warning('PoiService Nominatim error: ' . $response->status());
                return [];
            }

            $records = $response->json() ?? [];
            $results = [];

            foreach ($records as $r) {
                $name = trim((string) ($r['namedetails']['name'] ?? ''));
                if ($name === '' && !empty($r['display_name'])) {
                    $name = trim((string) explode(',', (string) $r['display_name'])[0]);
                }
                if ($name === '') continue;

                $pLat = isset($r['lat']) ? (float) $r['lat'] : null;
                $pLng = isset($r['lon']) ? (float) $r['lon'] : null;
                if ($pLat === null || $pLng === null) continue;

                $category = $this->inferCategory((string) ($r['class'] ?? ''), (string) ($r['type'] ?? ''));
                $address  = $this->buildNominatimAddress($r['address'] ?? []);
                $extra    = $r['extratags'] ?? [];

                $results[] = [
                    'id'            => 'nom_' . ($r['osm_type'] ?? 'x') . '_' . ($r['osm_id'] ?? uniqid()),
                    'category'      => $category,
                    'name'          => $name,
                    'lat'           => $pLat,
                    'lng'           => $pLng,
                    'address'       => $address,
                    'phone'         => $extra['phone']         ?? $extra['contact:phone']   ?? null,
                    'website'       => $extra['website']       ?? $extra['contact:website'] ?? null,
                    'opening_hours' => $extra['opening_hours'] ?? null,
                    'cuisine'       => $extra['cuisine']       ?? null,
                    'wheelchair'    => $extra['wheelchair']    ?? null,
                    'distance_m'    => ($lat !== null && $lng !== null)
                        ? (int) round($this->haversineM($lat, $lng, $pLat, $pLng))
                        : null,
                ];
            }

            if ($lat !== null && $lng !== null) {
                usort(
                    $results,
                    fn ($a, $b) => ($a['distance_m'] ?? PHP_INT_MAX) <=> ($b['distance_m'] ?? PHP_INT_MAX)
                );
            }

            return $results;
        } catch (\Throwable $e) {
            Log::warning('PoiService searchByName exception: ' . $e->getMessage());
            return [];
        }
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private function fetchFromOverpass(float $lat, float $lng, int $radiusM, array $categories): array
    {
        try {
            // number_format forces period as decimal separator regardless of server locale.
            // sprintf('%F') is locale-aware on some PHP/OS combinations and can output
            // commas, which breaks the Overpass around: filter and returns global results.
            $latStr = number_format($lat, 6, '.', '');
            $lngStr = number_format($lng, 6, '.', '');

            $clauses = [];
            foreach ($categories as $cat) {
                foreach (self::CATEGORY_TAGS[$cat] as [$k, $v]) {
                    $clauses[] = sprintf('node["%s"="%s"](around:%d,%s,%s);',     $k, $v, $radiusM, $latStr, $lngStr);
                    $clauses[] = sprintf('way["%s"="%s"](around:%d,%s,%s);',      $k, $v, $radiusM, $latStr, $lngStr);
                    $clauses[] = sprintf('relation["%s"="%s"](around:%d,%s,%s);', $k, $v, $radiusM, $latStr, $lngStr);
                }
            }

            $query = '[out:json][timeout:20];('
                   . implode('', $clauses)
                   . ');out center tags;';

            $response = Http::timeout(25)
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                    'Accept'     => 'application/json',
                ])
                ->asForm()
                ->post(self::OVERPASS, ['data' => $query]);

            if (!$response->successful()) {
                Log::warning('PoiService Overpass error: ' . $response->status());
                return [];
            }

            $elements = $response->json('elements') ?? [];
            $results  = [];
            $seen     = [];

            foreach ($elements as $el) {
                $tags = $el['tags'] ?? [];
                $name = trim((string) ($tags['name'] ?? $tags['name:ca'] ?? $tags['name:es'] ?? ''));
                if ($name === '') continue;

                $pLat = $el['lat'] ?? $el['center']['lat'] ?? null;
                $pLng = $el['lon'] ?? $el['center']['lon'] ?? null;
                if ($pLat === null || $pLng === null) continue;
                $pLat = (float) $pLat;
                $pLng = (float) $pLng;

                $category = $this->categoryFromTags($tags, $categories);
                if (!$category) continue;

                // Overpass devuelve un node y un way para el mismo lugar a veces.
                // Dedupe por categoría+nombre+coords redondeadas (~11m).
                $dedupeKey = $category . '|' . mb_strtolower($name)
                           . '|' . round($pLat, 4) . ',' . round($pLng, 4);
                if (isset($seen[$dedupeKey])) continue;
                $seen[$dedupeKey] = true;

                $results[] = [
                    'id'            => ($el['type'] ?? 'n') . '_' . ($el['id'] ?? uniqid()),
                    'category'      => $category,
                    'name'          => $name,
                    'lat'           => $pLat,
                    'lng'           => $pLng,
                    'address'       => $this->buildOsmAddress($tags),
                    'phone'         => $tags['phone']         ?? $tags['contact:phone']   ?? null,
                    'website'       => $tags['website']       ?? $tags['contact:website'] ?? null,
                    'opening_hours' => $tags['opening_hours'] ?? null,
                    'cuisine'       => in_array($category, ['restaurant', 'cafe', 'bar'], true)
                        ? ($tags['cuisine'] ?? null)
                        : null,
                    'wheelchair'    => $tags['wheelchair'] ?? null,
                    'distance_m'    => (int) round($this->haversineM($lat, $lng, $pLat, $pLng)),
                ];
            }

            usort($results, fn ($a, $b) => ($a['distance_m'] ?? 0) <=> ($b['distance_m'] ?? 0));
            return $results;
        } catch (\Throwable $e) {
            Log::warning('PoiService Overpass exception: ' . $e->getMessage());
            return [];
        }
    }

    private function categoryFromTags(array $tags, array $requestedCategories): ?string
    {
        foreach ($requestedCategories as $cat) {
            foreach (self::CATEGORY_TAGS[$cat] ?? [] as [$k, $v]) {
                if (($tags[$k] ?? null) === $v) {
                    return $cat;
                }
            }
        }
        return null;
    }

    private function buildOsmAddress(array $tags): ?string
    {
        $street = isset($tags['addr:street']) ? trim((string) $tags['addr:street']) : '';
        $hnum   = isset($tags['addr:housenumber']) ? trim((string) $tags['addr:housenumber']) : '';
        if ($street !== '' && $hnum !== '') return $street . ', ' . $hnum;
        if ($street !== '') return $street;
        return null;
    }

    private function buildNominatimAddress(array $address): ?string
    {
        $street = isset($address['road']) ? trim((string) $address['road']) : '';
        $hnum   = isset($address['house_number']) ? trim((string) $address['house_number']) : '';
        if ($street !== '' && $hnum !== '') return $street . ', ' . $hnum;
        if ($street !== '') return $street;
        return null;
    }

    private function inferCategory(string $class, string $type): string
    {
        if ($class === 'amenity') {
            return match ($type) {
                'restaurant', 'fast_food', 'pub' => 'restaurant',
                'cafe'                            => 'cafe',
                'bar'                             => 'bar',
                'pharmacy'                        => 'pharmacy',
                'hospital', 'clinic'              => 'hospital',
                'bank'                            => 'bank',
                default                           => 'attraction',
            };
        }
        if ($class === 'tourism') {
            return match ($type) {
                'museum'     => 'museum',
                'hotel'      => 'hotel',
                'attraction' => 'attraction',
                default      => 'attraction',
            };
        }
        if ($class === 'shop') {
            return match ($type) {
                'supermarket' => 'supermarket',
                'bakery'      => 'bakery',
                default       => 'attraction',
            };
        }
        if ($class === 'historic') {
            return 'monument';
        }
        return 'attraction';
    }

    private function haversineM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a    = sin($dLat / 2) ** 2
              + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 6371000.0 * 2 * asin(min(1.0, sqrt($a)));
    }
}
