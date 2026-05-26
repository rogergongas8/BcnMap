<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetroService
{
    private const BASE           = 'https://api.tmb.cat/v1';
    private const CACHE_STATIONS = 'metro:stations';
    private const CACHE_LINES    = 'metro:lines';
    private const CACHE_TTL      = 86400; // 24h

    private const CACHE_DISRUPTIONS = 'metro:disruptions';
    private const CACHE_DISRUPTIONS_TTL = 300; // 5 min

    // Lines covered by the TMB iMetro real-time API — only these have arrival data
    private const IMETRO_LINES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L11'];

    private const LINE_COLORS = [
        'L1'  => 'CE1126',
        'L2'  => '93248F',
        'L3'  => '1EB53A',
        'L4'  => 'F7A30E',
        'L5'  => '005A97',
        'L11' => '89B94C',
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
        return Cache::remember(self::CACHE_STATIONS, self::CACHE_TTL, fn() => $this->fetchStations());
    }

    /**
     * Fetches /transit/linies/metro/{codi}/estacions for all metro lines in parallel.
     * Returns map: [CODI_GRUP_ESTACIO(string) => [lineName => CODI_ESTACIO(int)]]
     * CODI_ESTACIO here is the per-line iMetro ID — for interchange stations each line
     * gets a different value even though they share the same CODI_GRUP_ESTACIO.
     */
    private function buildPerLineEstacioMap(): array
    {
        $lineCodes = [1, 2, 3, 4, 5, 11]; // iMetro-covered lines only

        $responses = Http::pool(fn($pool) =>
            array_map(
                fn($codi) => $pool->timeout(15)->get(
                    self::BASE . '/transit/linies/metro/' . $codi . '/estacions',
                    $this->auth()
                ),
                $lineCodes
            )
        );

        $map = [];
        foreach ($responses as $response) {
            if (!($response instanceof \Illuminate\Http\Client\Response) || !$response->successful()) continue;
            foreach ($response->json('features') ?? [] as $f) {
                $props      = $f['properties'] ?? [];
                $grupCodi   = (string) ($props['CODI_GRUP_ESTACIO'] ?? '');
                $lineName   = (string) ($props['NOM_LINIA']         ?? '');
                $codiEstacio = (int)   ($props['CODI_ESTACIO']       ?? 0);
                if (!$grupCodi || !$lineName || !$codiEstacio) continue;
                $map[$grupCodi][$lineName] = $codiEstacio;
            }
        }

        return $map;
    }

    private function fetchStations(): array
    {
        try {
            // Build accurate per-line estacio_id lookup before processing features
            $perLineMap = $this->buildPerLineEstacioMap();

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
                $codiSta = (int)   ($props['CODI_ESTACIO']       ?? 0);
                $picto   = (string) ($props['PICTO']              ?? '');
                if (!$groupId) continue;

                // Fallback estacio_id from the feature's own CODI_ESTACIO
                $fallbackEstacioId = $codiSta > 0 ? $codiSta - 6660000 : (int) $groupId - 6660000;

                if (!isset($byGroup[$groupId])) {
                    $coords = $f['geometry']['coordinates'];
                    $byGroup[$groupId] = [
                        'station_id'   => $groupId,
                        'estacio_id'   => (int) $groupId - 6660000,
                        'station_name' => $props['NOM_ESTACIO'] ?? '',
                        'lat'          => (float) $coords[1],
                        'lng'          => (float) $coords[0],
                        'type'         => 'metro',
                        'lines'        => [],
                    ];
                }

                // Only keep lines covered by iMetro real-time API
                $lineNames   = array_filter($this->parsePicto($picto), fn($l) => in_array($l, self::IMETRO_LINES, true));
                $isExclusive = count($lineNames) === 1;

                foreach ($lineNames as $lineName) {
                    // Per-line map gives the exact iMetro ID for this line at this group station
                    $accurateId = $perLineMap[$groupId][$lineName] ?? null;
                    $estacioId  = $accurateId ?? $fallbackEstacioId;

                    $existingIdx = null;
                    foreach ($byGroup[$groupId]['lines'] as $i => $entry) {
                        if ($entry['name'] === $lineName) { $existingIdx = $i; break; }
                    }

                    if ($existingIdx === null) {
                        $byGroup[$groupId]['lines'][] = [
                            'name'       => $lineName,
                            'color'      => self::LINE_COLORS[$lineName] ?? 'A855F7',
                            'estacio_id' => $estacioId,
                        ];
                    } elseif ($accurateId !== null || $isExclusive) {
                        // Prefer the accurate per-line ID; fall back to exclusive platform ID
                        $byGroup[$groupId]['lines'][$existingIdx]['estacio_id'] = $estacioId;
                    }
                }
            }

            // Drop stations that ended up with no covered lines
            return array_values(array_filter($byGroup, fn($s) => !empty($s['lines'])));

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

    private const INCLUDE_OPERATORS = ['Metro'];

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
                if (!in_array($name, self::IMETRO_LINES, true)) continue;

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
    /**
     * Fetch arrivals for all line-specific estacioIds in parallel and merge results.
     */
    public function getArrivalsForLines(array $estacioIds): array
    {
        if (count($estacioIds) === 1) {
            return $this->getArrivalsForStation($estacioIds[0]);
        }

        $responses = Http::pool(fn($pool) =>
            array_map(
                fn($id) => $pool->timeout(8)->get(self::BASE . '/imetro/estacions/' . $id . '/trens', $this->auth()),
                $estacioIds
            )
        );

        $result = [];
        foreach ($responses as $response) {
            if (!($response instanceof \Illuminate\Http\Client\Response) || !$response->successful()) continue;
            $entries = $response->json() ?? [];
            foreach ($entries as $entry) {
                $codiLinia = (int) ($entry['codi_linia'] ?? 0);
                $lineName  = $this->codiLiniaToName($codiLinia);
                $trains    = $entry['propers_trens'] ?? [];
                if (empty($trains)) continue;

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
                foreach ($byDest as $data) {
                    $result[] = [
                        'line'     => $lineName,
                        'color'    => self::LINE_COLORS[$lineName] ?? 'A855F7',
                        'dest'     => $data['dest'],
                        'arrivals' => $data['arrivals'],
                    ];
                }
            }
        }

        usort($result, fn($a, $b) => ($a['arrivals'][0] ?? 999) <=> ($b['arrivals'][0] ?? 999));
        return $result;
    }

    public function getArrivalsForStation(int $estacioId): array
    {
        try {
            $response = Http::timeout(8)->get(
                self::BASE . '/imetro/estacions/' . $estacioId . '/trens',
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
            default => 'L' . $codi,
        };
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

    // ── Disruptions ───────────────────────────────────────────────────────────

    public function getDisruptions(): array
    {
        return Cache::remember(self::CACHE_DISRUPTIONS, self::CACHE_DISRUPTIONS_TTL, fn() => $this->fetchDisruptions());
    }

    private function fetchDisruptions(): array
    {
        try {
            $response = Http::timeout(10)->get(self::BASE . '/transit/linies/metro', $this->auth());
            if (!$response->successful()) return [];

            $features = $response->json('features') ?? [];
            $disruptions = [];

            foreach ($features as $f) {
                $props = $f['properties'] ?? [];
                if (!empty($props['disrupted']) || !empty($props['DISRUPTED'])) {
                    $line = $props['NOM_LINIA'] ?? $props['nom_linia'] ?? '';
                    $desc = $props['disruption_desc'] ?? $props['DESCRIPCIO_DISRUPCIO'] ?? 'Incidencia en la línea';
                    if ($line) {
                        $disruptions[] = ['line' => $line, 'description' => $desc];
                    }
                }
            }

            return $disruptions;
        } catch (\Throwable) {
            return [];
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function parsePicto(string $picto): array
    {
        if (!$picto) return [];
        // Longer tokens MUST come before shorter ones — L10N before L1, L11 before L1, etc.
        // All known lines are listed so partial matches are never made.
        $known     = ['L10N', 'L10S', 'L9N', 'L9S', 'L11', 'L1', 'L2', 'L3', 'L4', 'L5', 'FM'];
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
        return $lines;
    }
}
