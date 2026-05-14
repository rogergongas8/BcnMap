<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetroService
{
    private const BASE           = 'https://api.tmb.cat/v1';
    private const OVERPASS       = 'https://overpass-api.de/api/interpreter';
    private const CACHE_STATIONS = 'metro:stations';
    private const CACHE_LINES    = 'metro:lines';
    private const CACHE_TTL      = 86400; // 24h

    // BCN bbox para Overpass
    private const BBOX = '41.30,1.95,41.50,2.30';

    private const LINE_COLORS = [
        'L1'   => 'CE1126',
        'L2'   => '93248F',
        'L3'   => '1EB53A',
        'L4'   => 'F7A30E',
        'L5'   => '005A97',
        'L9N'  => 'FB712B',
        'L9S'  => 'FB712B',
        'L10N' => '00A6D6',
        'L10S' => '00A6D6',
        'L11'  => '89B94C',
        'FM'   => '004C38',
        'TM'   => '6D9B3A',
    ];

    private function auth(): array
    {
        return [
            'app_id'  => config('services.tmb.app_id'),
            'app_key' => config('services.tmb.app_key'),
        ];
    }

    // ── Estaciones ────────────────────────────────────────────────────────────

    public function fetch(): array
    {
        Cache::forget(self::CACHE_STATIONS);
        return Cache::remember(self::CACHE_STATIONS, self::CACHE_TTL, function () {
            // Asegurar que líneas están cacheadas — necesarias para el proximity matching
            $lines = Cache::remember(self::CACHE_LINES, self::CACHE_TTL, fn() => $this->fetchLinesFromApi());

            $metro = $this->fetchStations();
            $tram  = $this->fetchTramStops($lines);
            $fgc   = $this->fetchFgcStations($lines);
            return array_merge($metro, $tram, $fgc);
        });
    }

    private function fetchStations(): array
    {
        try {
            $response = Http::timeout(20)->get(self::BASE . '/transit/estacions/', $this->auth());
            if (!$response->successful()) {
                Log::warning('TMB estacions error: ' . $response->status());
                return [];
            }

            $features = $response->json('features') ?? [];
            $byGroup  = [];

            foreach ($features as $f) {
                if (!isset($f['geometry']['coordinates'])) continue;
                $props   = $f['properties'] ?? [];
                $groupId = (string) ($props['CODI_GRUP_ESTACIO'] ?? '');
                $picto   = (string) ($props['PICTO'] ?? '');
                if (!$groupId) continue;

                // codi_estacio para imetro = CODI_GRUP_ESTACIO - 6660000
                $estacioId = (int) $groupId - 6660000;

                if (!isset($byGroup[$groupId])) {
                    $coords = $f['geometry']['coordinates'];
                    $byGroup[$groupId] = [
                        'station_id'   => $groupId,
                        'estacio_id'   => $estacioId,
                        'station_name' => $props['NOM_ESTACIO'] ?? '',
                        'lat'          => (float) $coords[1],
                        'lng'          => (float) $coords[0],
                        'type'         => 'metro',
                        'lines'        => [],
                    ];
                }

                foreach ($this->parsePicto($picto) as $lineName) {
                    $already = array_column($byGroup[$groupId]['lines'], 'name');
                    if (!in_array($lineName, $already, true)) {
                        $byGroup[$groupId]['lines'][] = [
                            'name'  => $lineName,
                            'color' => self::LINE_COLORS[$lineName] ?? 'A855F7',
                        ];
                    }
                }
            }

            return array_values($byGroup);

        } catch (\Throwable $e) {
            Log::error('MetroService::fetchStations error: ' . $e->getMessage());
            return [];
        }
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_STATIONS, []);
    }

    // ── Líneas (shapes) ───────────────────────────────────────────────────────

    public function fetchLines(): array
    {
        Cache::forget(self::CACHE_LINES);
        return Cache::remember(self::CACHE_LINES, self::CACHE_TTL, fn() => $this->fetchLinesFromApi());
    }

    // Operadores a incluir (excluye Rodalies de largo recorrido)
    private const INCLUDE_OPERATORS = ['Metro', 'FGC', 'TRAM'];

    // Bbox de recorte para geometrías de línea — cubre el área metropolitana de BCN
    private const CLIP_BBOX = [1.97, 41.27, 2.27, 41.50]; // [minLng, minLat, maxLng, maxLat]

    private function fetchLinesFromApi(): array
    {
        try {
            $response = Http::timeout(20)->get(self::BASE . '/transit/linies', $this->auth());
            if (!$response->successful()) {
                Log::warning('TMB linies error: ' . $response->status());
                return [];
            }

            $features = $response->json('features') ?? [];
            $lines    = [];

            foreach ($features as $f) {
                if (!isset($f['geometry'])) continue;
                $props    = $f['properties'] ?? [];
                $name     = $props['NOM_LINIA']     ?? '';
                $operator = $props['NOM_OPERADOR']  ?? '';

                if (!$name || !in_array($operator, self::INCLUDE_OPERATORS, true)) continue;

                $color = $props['COLOR_LINIA'] ?? (self::LINE_COLORS[$name] ?? null);
                if (!$color) continue;

                $geometry = $this->clipGeometry($f['geometry'], self::CLIP_BBOX);
                if (!$geometry) continue; // línea completamente fuera del bbox

                $lines[] = [
                    'name'        => $name,
                    'operator'    => $operator,
                    'description' => $props['DESC_LINIA'] ?? '',
                    'color'       => $color,
                    'geometry'    => $geometry,
                ];
            }

            usort($lines, fn($a, $b) => strcmp($a['operator'] . $a['name'], $b['operator'] . $b['name']));
            return $lines;

        } catch (\Throwable $e) {
            Log::error('MetroService::fetchLines error: ' . $e->getMessage());
            return [];
        }
    }

    public function getLines(): array
    {
        return Cache::get(self::CACHE_LINES, []);
    }

    // ── Llegadas en tiempo real ───────────────────────────────────────────────

    /**
     * Próximos trenes para una estación via /imetro/estacions/{estacioId}
     * Devuelve array de { line, color, dest, arrivals: [min, min, ...] }
     */
    public function getArrivalsForStation(int $estacioId): array
    {
        try {
            $response = Http::timeout(8)->get(
                self::BASE . '/imetro/estacions/' . $estacioId,
                $this->auth()
            );

            if (!$response->successful()) return [];

            $entries = $response->json() ?? [];
            $result  = [];

            foreach ($entries as $entry) {
                $codiLinia = (int) ($entry['codi_linia'] ?? 0);
                $lineName  = $this->codiLiniaToName($codiLinia);
                $trains    = $entry['propers_trens'] ?? [];

                if (empty($trains)) continue;

                // Agrupar por destino (codi_trajecte define la dirección)
                $byDest = [];
                foreach ($trains as $t) {
                    $dest = $t['desti_trajecte'] ?? '';
                    if (!$dest) continue;
                    $secs = (int) ($t['temps_restant'] ?? 0);
                    $mins = $secs < 60 ? 0 : (int) ceil($secs / 60);
                    if (!isset($byDest[$dest])) {
                        $byDest[$dest] = ['dest' => $dest, 'arrivals' => []];
                    }
                    $byDest[$dest]['arrivals'][] = $mins;
                }

                foreach ($byDest as $dest => $data) {
                    $result[] = [
                        'line'     => $lineName,
                        'color'    => self::LINE_COLORS[$lineName] ?? 'A855F7',
                        'dest'     => $data['dest'],
                        'arrivals' => $data['arrivals'],
                    ];
                }
            }

            // Ordenar por primer tiempo de llegada
            usort($result, fn($a, $b) => ($a['arrivals'][0] ?? 999) <=> ($b['arrivals'][0] ?? 999));
            return $result;

        } catch (\Throwable $e) {
            Log::warning("MetroService imetro {$estacioId}: " . $e->getMessage());
            return [];
        }
    }

    private function codiLiniaToName(int $codi): string
    {
        return match($codi) {
            1  => 'L1',
            2  => 'L2',
            3  => 'L3',
            4  => 'L4',
            5  => 'L5',
            11 => 'L11',
            91 => 'L9S',
            94 => 'L9N',
            99 => 'FM',
            101 => 'L10S',
            104 => 'L10N',
            default => 'L' . $codi,
        };
    }

    // ── Paradas Tram + Estaciones FGC (Overpass/OSM) ─────────────────────────

    private function fetchTramStops(array $lines): array
    {
        try {
            $query = '[out:json][timeout:25];'
                   . 'node["railway"="tram_stop"](' . self::BBOX . ');'
                   . 'out body;';

            $response = Http::timeout(30)
                ->withHeaders(['User-Agent' => 'BcnMap/1.0', 'Accept' => 'application/json'])
                ->get(self::OVERPASS, ['data' => $query]);

            if (!$response->successful()) return [];

            $elements = $response->json('elements') ?? [];

            // Deduplicar por nombre (misma parada, dos nodos por sentido)
            $byName = [];
            foreach ($elements as $el) {
                $name = trim($el['tags']['name'] ?? $el['tags']['name:ca'] ?? '');
                if (!$name) continue;
                $byName[$name]['lats'][] = (float) $el['lat'];
                $byName[$name]['lngs'][] = (float) $el['lon'];
            }

            $tramLines = array_filter($lines, fn($l) => ($l['operator'] ?? '') === 'TRAM');

            $stops = [];
            foreach ($byName as $name => $coords) {
                $lat = round(array_sum($coords['lats']) / count($coords['lats']), 7);
                $lng = round(array_sum($coords['lngs']) / count($coords['lngs']), 7);

                $matched = $this->matchStopToLines($lat, $lng, $tramLines, 0.20);
                // Fallback si no hay match (parada fuera del bbox exacto de la línea)
                if (empty($matched)) {
                    $matched = [['name' => 'Tram', 'color' => '008272']];
                }

                $stops[] = [
                    'station_id'   => 'tram_' . md5($name),
                    'estacio_id'   => null,
                    'station_name' => $name,
                    'lat'          => $lat,
                    'lng'          => $lng,
                    'type'         => 'tram',
                    'lines'        => $matched,
                ];
            }

            return $stops;

        } catch (\Throwable $e) {
            Log::warning('MetroService tram stops error: ' . $e->getMessage());
            return [];
        }
    }

    private function fetchFgcStations(array $lines): array
    {
        try {
            $query = '[out:json][timeout:25];'
                   . 'node["railway"="station"]["operator:short"="FGC"](' . self::BBOX . ');'
                   . 'out body;';

            $response = Http::timeout(30)
                ->withHeaders(['User-Agent' => 'BcnMap/1.0', 'Accept' => 'application/json'])
                ->get(self::OVERPASS, ['data' => $query]);

            if (!$response->successful()) return [];

            $elements = $response->json('elements') ?? [];
            $fgcLines  = array_filter($lines, fn($l) => ($l['operator'] ?? '') === 'FGC');

            $stations = [];
            foreach ($elements as $el) {
                $name = trim($el['tags']['name'] ?? $el['tags']['name:ca'] ?? '');
                if (!$name) continue;

                $lat = (float) $el['lat'];
                $lng = (float) $el['lon'];

                $matched = $this->matchStopToLines($lat, $lng, $fgcLines, 0.25);
                if (empty($matched)) {
                    $matched = [['name' => 'FGC', 'color' => '797FBC']];
                }

                $stations[] = [
                    'station_id'   => 'fgc_' . $el['id'],
                    'estacio_id'   => null,
                    'station_name' => $name,
                    'lat'          => $lat,
                    'lng'          => $lng,
                    'type'         => 'fgc',
                    'lines'        => $matched,
                ];
            }

            return $stations;

        } catch (\Throwable $e) {
            Log::warning('MetroService FGC stations error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Para cada línea del array, comprueba si algún vértice de su geometría
     * está a menos de $thresholdKm del punto dado. Devuelve las líneas que hacen match.
     */
    private function matchStopToLines(float $lat, float $lng, array $lines, float $thresholdKm): array
    {
        $matched = [];
        foreach ($lines as $line) {
            $geometry = $line['geometry'] ?? null;
            if (!$geometry) continue;

            $linestrings = $geometry['type'] === 'MultiLineString'
                ? $geometry['coordinates']
                : [$geometry['coordinates']];

            $found = false;
            foreach ($linestrings as $linestring) {
                if ($found) break;
                foreach ($linestring as $coord) {
                    if ($this->haversineKm($lat, $lng, (float)$coord[1], (float)$coord[0]) < $thresholdKm) {
                        $matched[] = ['name' => $line['name'], 'color' => $line['color']];
                        $found = true;
                        break;
                    }
                }
            }
        }
        return $matched;
    }

    /**
     * Recorta una geometría LineString/MultiLineString al bbox dado.
     * Divide en sub-linestrings allá donde los puntos salen del bbox.
     * Descarta segmentos con menos de 2 puntos.
     */
    private function clipGeometry(array $geometry, array $bbox): ?array
    {
        [$minLng, $minLat, $maxLng, $maxLat] = $bbox;

        $inBbox = fn(array $c): bool =>
            $c[0] >= $minLng && $c[0] <= $maxLng &&
            $c[1] >= $minLat && $c[1] <= $maxLat;

        $clipLinestring = function (array $coords) use ($inBbox): array {
            $segments = [];
            $current  = [];
            foreach ($coords as $coord) {
                if ($inBbox($coord)) {
                    $current[] = $coord;
                } else {
                    if (count($current) >= 2) $segments[] = $current;
                    $current = [];
                }
            }
            if (count($current) >= 2) $segments[] = $current;
            return $segments;
        };

        if ($geometry['type'] === 'LineString') {
            $segs = $clipLinestring($geometry['coordinates']);
            if (empty($segs)) return null;
            return ['type' => 'MultiLineString', 'coordinates' => $segs];
        }

        if ($geometry['type'] === 'MultiLineString') {
            $all = [];
            foreach ($geometry['coordinates'] as $ls) {
                $all = array_merge($all, $clipLinestring($ls));
            }
            if (empty($all)) return null;
            return ['type' => 'MultiLineString', 'coordinates' => $all];
        }

        return $geometry;
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a    = sin($dLat / 2) ** 2
              + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 6371 * 2 * asin(sqrt($a));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function parsePicto(string $picto): array
    {
        if (!$picto) return [];
        $known     = ['L10N', 'L10S', 'L9N', 'L9S', 'L11', 'L1', 'L2', 'L3', 'L4', 'L5', 'FM', 'TM'];
        $lines     = [];
        $remaining = $picto;
        while ($remaining !== '') {
            $matched = false;
            foreach ($known as $line) {
                if (str_starts_with($remaining, $line)) {
                    $lines[]   = $line;
                    $remaining = substr($remaining, strlen($line));
                    $matched   = true;
                    break;
                }
            }
            if (!$matched) break;
        }
        return $lines ?: [$picto];
    }
}
