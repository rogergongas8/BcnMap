<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Enriquece un POI con fotos, descripción e info extra usando fuentes 100% gratuitas:
 *
 *  1. Wikipedia (ES/CA/EN)  – descripción + thumbnail de alta calidad
 *  2. Wikimedia Commons      – fotos adicionales para monumentos/museos
 *  3. OpenTripMap            – info turística extra (opcional, requiere key)
 *
 * Wikipedia + Wikimedia funcionan sin ninguna key ni registro.
 * OpenTripMap se activa si OPENTRIPMAP_API_KEY está configurada en .env.
 */
class PlaceEnrichService
{
    // ── Wikipedia REST ───────────────────────────────────────────────────────
    private const WIKI_SUMMARY_URL = 'https://%s.wikipedia.org/api/rest_v1/page/summary/%s';
    private const WIKI_SEARCH_URL  = 'https://%s.wikipedia.org/w/api.php';

    // ── Wikimedia Commons ────────────────────────────────────────────────────
    private const COMMONS_URL = 'https://commons.wikimedia.org/w/api.php';

    // ── OpenTripMap (opcional) ───────────────────────────────────────────────
    private const OTM_RADIUS_URL = 'https://api.opentripmap.com/0.1/en/places/radius';
    private const OTM_DETAIL_URL = 'https://api.opentripmap.com/0.1/en/places/xid/%s';

    private const CACHE_TTL = 86400; // 24h

    // Categorías que se benefician de Wikimedia Commons
    private const VISUAL_CATEGORIES = ['museum', 'monument', 'attraction', 'hotel', 'hospital'];

    public function enrich(string $name, float $lat, float $lng, string $category = ''): ?array
    {
        $cacheKey = 'enrich:v3:' . md5($name . round($lat, 4) . round($lng, 4));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached ?: null; // false → negative cache
        }

        $result = $this->fetchAll($name, $lat, $lng, $category);

        Cache::put($cacheKey, $result ?? false, $result ? self::CACHE_TTL : 3600);

        return $result;
    }

    // ── Orquestador ──────────────────────────────────────────────────────────

    private function fetchAll(string $name, float $lat, float $lng, string $category): ?array
    {
        $useVisuals = in_array($category, self::VISUAL_CATEGORIES, true) || $category === '';
        $otmKey     = config('services.opentripmap.key');
        $useOtm     = $otmKey && $otmKey !== 'opentripmap';

        // ── 1. Buscar título Wikipedia ───────────────────────────────────────
        $wikiTitle = $this->searchWikiTitle($name, $lat, $lng);

        // ── 2. Lanzar llamadas en paralelo ───────────────────────────────────
        $poolRequests = [];

        if ($wikiTitle) {
            $encoded = urlencode(str_replace(' ', '_', $wikiTitle));
            // Intentar ES primero, luego CA, luego EN
            foreach (['es', 'ca', 'en'] as $lang) {
                $poolRequests["wiki_{$lang}"] = [
                    'url'    => sprintf(self::WIKI_SUMMARY_URL, $lang, $encoded),
                    'params' => [],
                ];
            }
        }

        if ($useVisuals) {
            $poolRequests['commons'] = [
                'url'    => self::COMMONS_URL,
                'params' => [
                    'action'       => 'query',
                    'generator'    => 'search',
                    'gsrsearch'    => 'File:' . $name . ' Barcelona',
                    'gsrnamespace' => 6,
                    'gsrlimit'     => 8,
                    'prop'         => 'imageinfo',
                    'iiprop'       => 'url|size|mime',
                    'iiurlwidth'   => 900,
                    'format'       => 'json',
                ],
            ];
        }

        if ($useOtm) {
            $poolRequests['otm'] = [
                'url'    => self::OTM_RADIUS_URL,
                'params' => [
                    'radius' => 150,
                    'lon'    => $lng,
                    'lat'    => $lat,
                    'name'   => $name,
                    'limit'  => 1,
                    'format' => 'json',
                    'apikey' => $otmKey,
                ],
            ];
        }

        if (empty($poolRequests)) {
            return null;
        }

        $responses = Http::pool(function ($pool) use ($poolRequests) {
            $built = [];
            foreach ($poolRequests as $key => $req) {
                $built[$key] = $pool->as($key)
                    ->timeout(8)
                    ->withHeaders(['User-Agent' => 'BcnMap/1.0 (personal project)'])
                    ->get($req['url'], $req['params']);
            }
            return $built;
        });

        // ── 3. Procesar Wikipedia ────────────────────────────────────────────
        $wikiExtract   = null;
        $wikiUrl       = null;
        $wikiThumbnail = null;

        foreach (['es', 'ca', 'en'] as $lang) {
            $key = "wiki_{$lang}";
            $r   = $responses[$key] ?? null;
            if (!$r || !$r->successful()) continue;

            $data = $r->json() ?? [];
            if (($data['type'] ?? '') === 'disambiguation') continue;

            $extract = $data['extract'] ?? null;
            if (!$extract) continue;

            $wikiExtract   = $extract;
            $wikiUrl       = $data['content_urls']['desktop']['page'] ?? null;
            $wikiThumbnail = $data['thumbnail']['source'] ?? null;
            break; // Usamos el primer idioma que devuelva resultado
        }

        // ── 4. Procesar Wikimedia Commons ────────────────────────────────────
        $commonsPhotos = [];

        $commonsR = $responses['commons'] ?? null;
        if ($commonsR && $commonsR->successful()) {
            $pages = $commonsR->json('query.pages') ?? [];
            foreach ($pages as $page) {
                $info = $page['imageinfo'][0] ?? [];
                $mime = $info['mime'] ?? '';
                // Solo imágenes reales, no SVG ni audio
                if (!str_starts_with($mime, 'image/') || $mime === 'image/svg+xml') continue;
                $url = $info['thumburl'] ?? null;
                if ($url) $commonsPhotos[] = $url;
            }
        }

        // ── 5. Procesar OpenTripMap (si disponible) ──────────────────────────
        $otmData   = null;
        $otmPhotos = [];

        $otmR = $responses['otm'] ?? null;
        if ($otmR && $otmR->successful()) {
            $features = $otmR->json('features') ?? [];
            if (!empty($features)) {
                $xid = $features[0]['properties']['xid'] ?? null;
                if ($xid) {
                    $otmData = $this->fetchOtmDetail($xid, $otmKey);
                    if ($otmData) {
                        $otmPhotos = $this->extractOtmPhotos($otmData);
                    }
                }
            }
        }

        // ── 6. Fusionar ──────────────────────────────────────────────────────
        // Prioridad fotos: Wikipedia thumbnail > OTM > Commons
        $photos = [];
        if ($wikiThumbnail) {
            // Pedir versión más grande del thumbnail de Wikipedia
            $bigThumb = preg_replace('/\/\d+px-/', '/800px-', $wikiThumbnail);
            $photos[] = $bigThumb ?? $wikiThumbnail;
        }
        foreach ($otmPhotos as $p) {
            if (!in_array($p, $photos, true)) $photos[] = $p;
        }
        foreach ($commonsPhotos as $p) {
            if (!in_array($p, $photos, true)) $photos[] = $p;
        }
        $photos = array_values(array_slice($photos, 0, 5));

        // Descripción: Wikipedia > OTM
        $description = $wikiExtract
            ?? $otmData['wikipedia_extracts']['text']
            ?? $otmData['info']['descr']
            ?? null;

        if ($description) {
            $description = strip_tags($description);
            $description = mb_substr(trim($description), 0, 450);
            if (mb_strlen($description) === 450) {
                $lastSpace   = mb_strrpos($description, ' ');
                $description = mb_substr($description, 0, $lastSpace ?: 450) . '…';
            }
        }

        // Info extra de OTM
        $address = $this->buildOtmAddress($otmData);
        $website = $otmData['url'] ?? null;
        $phone   = $otmData['contacts']['phone'] ?? null;
        $hours   = $otmData['opening_hours'] ?? null;
        $rating  = isset($otmData['rate']) ? $this->normaliseRate((string) $otmData['rate']) : null;

        // Sources para atribución
        $sources = array_values(array_filter([
            $wikiExtract   ? 'Wikipedia'         : null,
            !empty($commonsPhotos) ? 'Wikimedia Commons' : null,
            $otmData       ? 'OpenTripMap'        : null,
        ]));

        // Si no tenemos nada útil, devolvemos null
        if (empty($photos) && !$description && !$website && !$phone && !$hours) {
            return null;
        }

        return [
            'photos'      => $photos,
            'description' => $description,
            'rating'      => $rating,
            'address'     => $address,
            'website'     => $website,
            'phone'       => $phone,
            'hours'       => $hours,
            'wiki_url'    => $wikiUrl,
            'sources'     => $sources,
        ];
    }

    // ── Wikipedia: buscar título más relevante ───────────────────────────────

    private function searchWikiTitle(string $name, float $lat, float $lng): ?string
    {
        // Normalizar: quitar acentos/diéresis para mejor matching en Wikipedia
        $nameNorm = $this->normaliseForSearch($name);

        // Intentar primero con contexto Barcelona, luego solo el nombre
        $queries = [
            $nameNorm . ' Barcelona',
            $nameNorm,
        ];

        foreach ($queries as $query) {
            $title = $this->runWikiSearch($query, $name);
            if ($title !== null) return $title;
        }

        return null;
    }

    private function runWikiSearch(string $query, string $originalName): ?string
    {
        try {
            $response = Http::timeout(6)
                ->withHeaders(['User-Agent' => 'BcnMap/1.0 (personal project)'])
                ->get(sprintf(self::WIKI_SEARCH_URL, 'es'), [
                    'action'   => 'query',
                    'list'     => 'search',
                    'srsearch' => $query,
                    'srlimit'  => 5,
                    'format'   => 'json',
                    'utf8'     => 1,
                ]);

            if (!$response->successful()) return null;

            $hits = $response->json('query.search') ?? [];
            if (empty($hits)) return null;

            $nameNormLower = mb_strtolower($this->normaliseForSearch($originalName));

            // Palabras a evitar: páginas de barrio, estación, plaza, desambiguación
            $skipPatterns = ['barrio', 'estación', 'estacion', 'plaza', 'desambiguación',
                             'desambiguacion', 'distrito', 'calle', 'avenida'];

            $candidates = [];
            foreach ($hits as $hit) {
                $title      = $hit['title'] ?? '';
                $titleLower = mb_strtolower($title);
                $titleNorm  = mb_strtolower($this->normaliseForSearch($title));
                $snippet    = mb_strtolower(strip_tags($hit['snippet'] ?? ''));

                // Descartar páginas de desambiguación y contextos no-POI
                $skip = false;
                foreach ($skipPatterns as $pattern) {
                    if (str_contains($titleLower, $pattern)) { $skip = true; break; }
                }
                if ($skip) continue;

                $score = 0;

                // El título normalizado contiene el nombre buscado (o viceversa)
                if (str_contains($titleNorm, $nameNormLower) || str_contains($nameNormLower, $titleNorm)) {
                    $score += 4;
                }

                // Coincidencia parcial: alguna palabra del nombre aparece en el título
                foreach (explode(' ', $nameNormLower) as $word) {
                    if (mb_strlen($word) > 3 && str_contains($titleNorm, $word)) {
                        $score += 1;
                    }
                }

                // El snippet menciona Barcelona
                if (str_contains($snippet, 'barcelona')) $score += 2;

                // Palabras clave de POI físico
                foreach (['basílica', 'basilica', 'iglesia', 'museo', 'edificio', 'monumento',
                          'hospital', 'hotel', 'restaurante', 'parque', 'mercado', 'teatro',
                          'palacio', 'mercat', 'parc', 'casa', 'temple', 'catedral', 'market'] as $kw) {
                    if (str_contains($snippet, $kw) || str_contains($titleLower, $kw)) {
                        $score += 2;
                        break;
                    }
                }

                if ($score > 0) {
                    $candidates[] = ['title' => $title, 'score' => $score];
                }
            }

            if (empty($candidates)) return null;

            usort($candidates, fn ($a, $b) => $b['score'] <=> $a['score']);
            return $candidates[0]['title'];

        } catch (\Throwable $e) {
            Log::debug('PlaceEnrichService wiki search error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Quita acentos y caracteres especiales para mejorar el matching en Wikipedia.
     */
    private function normaliseForSearch(string $text): string
    {
        $result = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        return $result !== false ? $result : $text;
    }

    // ── OpenTripMap helpers ──────────────────────────────────────────────────

    private function fetchOtmDetail(string $xid, string $apiKey): ?array
    {
        try {
            $response = Http::timeout(8)
                ->get(sprintf(self::OTM_DETAIL_URL, $xid), ['apikey' => $apiKey]);

            return $response->successful() ? ($response->json() ?? null) : null;
        } catch (\Throwable $e) {
            Log::debug('PlaceEnrichService OTM detail error: ' . $e->getMessage());
            return null;
        }
    }

    private function extractOtmPhotos(array $data): array
    {
        $photos = [];
        foreach (['preview.source', 'image'] as $path) {
            $parts = explode('.', $path);
            $val   = $data;
            foreach ($parts as $p) {
                $val = $val[$p] ?? null;
                if ($val === null) break;
            }
            if (is_string($val) && $val && !in_array($val, $photos, true)) {
                $photos[] = $val;
            }
        }
        return $photos;
    }

    private function buildOtmAddress(?array $data): ?string
    {
        if (!$data) return null;
        $addr = $data['address'] ?? [];
        $road = $addr['road'] ?? $addr['pedestrian'] ?? '';
        $num  = $addr['house_number'] ?? '';
        if ($road && $num) return $road . ', ' . $num;
        return $road ?: null;
    }

    private function normaliseRate(string $rate): ?float
    {
        $clean = preg_replace('/[^0-9]/', '', $rate);
        if ($clean === '' || $clean === '0') return null;
        return match ((int) $clean) {
            3       => 4.5,
            2       => 3.5,
            default => 2.5,
        };
    }
}
