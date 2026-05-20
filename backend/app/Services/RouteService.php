<?php
declare(strict_types=1);
namespace App\Services;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class RouteService
{
    private const VALHALLA_TIMEOUT = 15;

    private const COLORS = [
        'walk'  => '#a78bfa',
        'bike'  => '#00ff88',
        'drive' => '#ffaa00',
        'metro' => '#ff6b35',
        'bus'   => '#00b4ff',
    ];

    private function valhallaBase(): string
    {
        return rtrim(env('VALHALLA_URL', 'http://valhalla:8002'), '/');
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public function planMultimodal(float $fromLat, float $fromLng, float $toLat, float $toLng, ?string $constraint = null): array
    {
        $options = [];
        foreach (['foot', 'bicing', 'bus', 'car'] as $mode) {
            try {
                $result = $this->calculate($fromLat, $fromLng, $toLat, $toLng, $mode);
                $options[$mode] = isset($result['error']) ? null : $result;
            } catch (\Throwable) {
                $options[$mode] = null;
            }
        }

        return [
            'recommended' => $this->scoreRoutes($options, $constraint),
            'options'     => $options,
        ];
    }

    private function scoreRoutes(array $options, ?string $constraint): string
    {
        $weather    = Cache::get('weather_current');
        $isRainy    = $weather && preg_match('/rain|lluvio|lluvia|shower/i', $weather['description'] ?? '');
        $congestion = $this->currentCongestion();
        $noMetro    = $constraint && preg_match('/sin metro|no metro/i', $constraint);
        $noBici     = $constraint && preg_match('/sin bici|no bici/i', $constraint);

        $scores = [];
        foreach ($options as $mode => $route) {
            if (!$route) { $scores[$mode] = PHP_INT_MAX; continue; }
            $score    = (float)($route['duration'] ?? PHP_INT_MAX);
            $distance = (float)($route['distance'] ?? 0);
            if ($mode === 'car'    && $congestion > 60) $score *= 1.5;
            if ($mode === 'bicing' && $isRainy)         $score *= 3.0;
            if ($mode === 'foot'   && $distance > 3000) $score *= 1.8;
            if ($mode === 'bicing' && $noBici)          $score  = PHP_INT_MAX;
            if ($mode === 'bus'    && $noMetro)         $score  = PHP_INT_MAX;
            $scores[$mode] = $score;
        }

        $min  = min($scores);
        $best = array_keys(array_filter($scores, fn($s) => $s === $min));
        return $best[0] ?? 'foot';
    }

    public function calculate(float $fromLat, float $fromLng, float $toLat, float $toLng, string $mode): array
    {
        return match ($mode) {
            'foot'   => $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk'),
            'car'    => $this->carRoute($fromLat, $fromLng, $toLat, $toLng),
            'bike'   => $this->singleSegment('bicycle',   $fromLat, $fromLng, $toLat, $toLng, 'bike'),
            'bicing' => $this->bicingRoute($fromLat, $fromLng, $toLat, $toLng),
            'bus'    => $this->transitRoute($fromLat, $fromLng, $toLat, $toLng),
            default  => ['error' => 'Modo de transporte no soportado'],
        };
    }

    // ── Route builders ────────────────────────────────────────────────────────

    private function carRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        try {
            $body = $this->autoBody($fromLat, $fromLng, $toLat, $toLng, alternates: 2);
            $r    = Http::timeout(self::VALHALLA_TIMEOUT)
                ->post($this->valhallaBase() . '/route', $body);

            if (!$r->successful()) {
                return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'drive');
            }

            $data = $r->json();
            $congestion = $this->currentCongestion();
            $penalty    = 1.0 + max(0, min(0.8, ($congestion - 20) / 100));

            // Collect primary + alternates
            $routes = [$data['trip'] ?? null];
            foreach ($data['alternates'] ?? [] as $alt) {
                $routes[] = $alt['trip'] ?? null;
            }
            $routes = array_filter($routes);

            $candidates = [];
            foreach ($routes as $trip) {
                $seg = $this->parseTripSummary($trip);
                if (!$seg) continue;
                $candidates[] = [
                    'geometry' => $seg['geometry'],
                    'distance' => $seg['distance'],
                    'duration' => $seg['duration'] * $penalty,
                ];
            }

            if (empty($candidates)) {
                return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'drive');
            }

            usort($candidates, fn($a, $b) => $a['duration'] <=> $b['duration']);
            $best = $candidates[0];

            $trafficNote = $congestion >= 60
                ? ($congestion >= 80 ? 'Tráfico muy denso' : 'Tráfico denso')
                : ($congestion >= 40 ? 'Tráfico moderado' : null);

            return [
                'segments' => [[
                    'type'     => 'drive',
                    'geometry' => $best['geometry'],
                    'distance' => $best['distance'],
                    'duration' => $best['duration'],
                    'color'    => self::COLORS['drive'],
                    'label'    => 'En coche',
                    'meta'     => [
                        'congestion'   => $congestion,
                        'traffic_note' => $trafficNote,
                        'alternatives' => count($candidates),
                    ],
                ]],
                'distance' => $best['distance'],
                'duration' => $best['duration'],
                'traffic'  => ['congestion' => $congestion, 'note' => $trafficNote],
            ];
        } catch (\Throwable) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'drive');
        }
    }

    private function singleSegment(string $costing, float $fromLat, float $fromLng, float $toLat, float $toLng, string $type): array
    {
        $seg = $this->valhallaRoute($fromLat, $fromLng, $toLat, $toLng, $costing);
        if (!$seg) return ['error' => 'No se encontró ruta'];
        return [
            'segments' => [[
                'type'     => $type,
                'geometry' => $seg['geometry'],
                'distance' => $seg['distance'],
                'duration' => $seg['duration'],
                'color'    => self::COLORS[$type] ?? self::COLORS['walk'],
                'label'    => match($type) {
                    'walk'  => 'A pie',
                    'drive' => 'En coche',
                    'bike'  => 'En bici',
                    default => ucfirst($type)
                },
                'steps'    => $seg['steps'] ?? [],
            ]],
            'distance' => $seg['distance'],
            'duration' => $seg['duration'],
        ];
    }

    private function bicingRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $stations = Cache::get('bicing_current', []);
        if (empty($stations)) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'bike');
        }

        $originStation = $this->nearestStation($stations, $fromLat, $fromLng, 'bikes');
        $destStation   = $this->nearestStation($stations, $toLat, $toLng, 'docks');

        if (!$originStation || !$destStation || $originStation['station_id'] === $destStation['station_id']) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $oLat = (float)$originStation['lat']; $oLng = (float)$originStation['lng'];
        $dLat = (float)$destStation['lat'];   $dLng = (float)$destStation['lng'];

        $responses = Http::pool(fn($pool) => [
            $pool->as('walk1')->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($fromLat, $fromLng, $oLat, $oLng)),
            $pool->as('bike') ->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->bikeBody($oLat, $oLng, $dLat, $dLng)),
            $pool->as('walk2')->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($dLat, $dLng, $toLat, $toLng)),
        ]);

        $walk1 = $this->parseValhalla($responses['walk1'], 'walk');
        $bike  = $this->parseValhalla($responses['bike'],  'bike');
        $walk2 = $this->parseValhalla($responses['walk2'], 'walk');

        if (!$bike) {
            return $this->singleSegment('bicycle', $fromLat, $fromLng, $toLat, $toLng, 'bike');
        }

        $segments = [];

        if ($walk1 && $walk1['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk1['geometry'],
                'distance' => $walk1['distance'], 'duration' => $walk1['duration'],
                'color' => self::COLORS['walk'], 'label' => 'Caminar a estación Bicing',
                'meta' => [
                    'station_id'       => $originStation['station_id'],
                    'station_name'     => $originStation['station_name'],
                    'station_lat'      => $oLat,
                    'station_lng'      => $oLng,
                    'bikes_available'  => $originStation['bikes_available'],
                    'ebikes_available' => $originStation['ebikes_available'],
                ],
            ];
        }

        $segments[] = [
            'type' => 'bike', 'geometry' => $bike['geometry'],
            'distance' => $bike['distance'], 'duration' => $bike['duration'],
            'color' => self::COLORS['bike'], 'label' => 'Bicing',
            'meta' => [
                'from_station_id'   => $originStation['station_id'],
                'from_station'      => $originStation['station_name'],
                'from_lat'          => $oLat, 'from_lng' => $oLng,
                'to_station_id'     => $destStation['station_id'],
                'to_station'        => $destStation['station_name'],
                'to_lat'            => $dLat, 'to_lng' => $dLng,
                'bikes_available'   => $originStation['bikes_available'],
                'ebikes_available'  => $originStation['ebikes_available'],
                'docks_available'   => $destStation['docks_available'],
            ],
        ];

        if ($walk2 && $walk2['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk2['geometry'],
                'distance' => $walk2['distance'], 'duration' => $walk2['duration'],
                'color' => self::COLORS['walk'], 'label' => 'Caminar al destino',
                'meta' => [
                    'station_id'      => $destStation['station_id'],
                    'station_name'    => $destStation['station_name'],
                    'station_lat'     => $dLat, 'station_lng' => $dLng,
                    'docks_available' => $destStation['docks_available'],
                ],
            ];
        }

        return [
            'segments' => $segments,
            'distance' => array_sum(array_column($segments, 'distance')),
            'duration' => array_sum(array_column($segments, 'duration')),
            'mode'     => 'bicing',
        ];
    }

    private function transitRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $allStations   = Cache::get('metro:stations', []);
        $metroStations = array_values(array_filter($allStations, fn($s) => ($s['type'] ?? '') === 'metro'));

        if (empty($metroStations)) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $originStation  = $this->nearestPoint($metroStations, $fromLat, $fromLng);
        $destCandidates = array_values(array_filter($metroStations, fn($s) => $s['station_id'] !== ($originStation['station_id'] ?? null)));
        $destStation    = $this->nearestPoint($destCandidates ?: $metroStations, $toLat, $toLng);

        if (!$originStation || !$destStation) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $router = new MetroRouter();
        $legs   = $router->route($originStation, $destStation);

        if (!$legs) {
            $legs = [[
                'line'         => ($originStation['lines'][0]['name'] ?? 'M'),
                'from_station' => $originStation,
                'to_station'   => $destStation,
            ]];
        }

        $firstFrom = $legs[0]['from_station'];
        $lastTo    = $legs[count($legs) - 1]['to_station'];
        $oLat = (float)$firstFrom['lat']; $oLng = (float)$firstFrom['lng'];
        $dLat = (float)$lastTo['lat'];    $dLng = (float)$lastTo['lng'];

        $responses = Http::pool(fn($pool) => [
            $pool->as('walk1')->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($fromLat, $fromLng, $oLat, $oLng)),
            $pool->as('walk2')->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($dLat, $dLng, $toLat, $toLng)),
        ]);

        $walk1 = $this->parseValhalla($responses['walk1'], 'walk');
        $walk2 = $this->parseValhalla($responses['walk2'], 'walk');

        $segments = [];

        if ($walk1 && $walk1['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk1['geometry'],
                'distance' => $walk1['distance'], 'duration' => $walk1['duration'],
                'color' => self::COLORS['walk'],
                'label' => 'Caminar a ' . ($firstFrom['station_name'] ?? 'estación'),
                'meta'  => [
                    'station_id'   => $firstFrom['station_id'],
                    'station_name' => $firstFrom['station_name'],
                    'station_lat'  => $oLat, 'station_lng' => $oLng,
                ],
            ];
        }

        foreach ($legs as $leg) {
            $lineName = $leg['line'];
            $from     = $leg['from_station'];
            $to       = $leg['to_station'];
            $geometry = $router->legGeometry($lineName, $from, $to);
            $color    = $router->lineColor($lineName);
            $dist     = $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
            $dur      = ($dist / 25000) * 3600 + 120;
            $isFirst  = ($leg === $legs[0]);

            $segments[] = [
                'type'     => 'metro',
                'geometry' => $geometry,
                'distance' => $dist,
                'duration' => $isFirst ? $dur : $dur + 120,
                'color'    => $color,
                'label'    => 'Metro ' . $lineName,
                'meta'     => [
                    'from_station_id' => $from['station_id'],
                    'from_station'    => $from['station_name'],
                    'from_lat'        => (float)$from['lat'], 'from_lng' => (float)$from['lng'],
                    'to_station_id'   => $to['station_id'],
                    'to_station'      => $to['station_name'],
                    'to_lat'          => (float)$to['lat'], 'to_lng' => (float)$to['lng'],
                    'lines'           => [$lineName],
                    'line_colors'     => [$lineName => $color],
                    'direction'       => $router->terminus($lineName, $from, $to),
                ],
            ];
        }

        if ($walk2 && $walk2['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk2['geometry'],
                'distance' => $walk2['distance'], 'duration' => $walk2['duration'],
                'color' => self::COLORS['walk'], 'label' => 'Caminar al destino',
            ];
        }

        $totalDistance = array_sum(array_column($segments, 'distance'));
        $totalDuration = array_sum(array_column($segments, 'duration'));

        // Efficiency guard: compare against estimated walking time for the same crow-flies distance
        $straightLine   = $this->haversine($fromLat, $fromLng, $toLat, $toLng);
        $walkEstimateSec = $straightLine / 1.25; // 4.5 km/h walking speed
        $transfers       = count(array_filter($segments, fn($s) => $s['type'] === 'metro')) - 1;

        // Flag as inefficient when metro doesn't save meaningful time over walking,
        // or when the routed distance is >2.5× the straight-line distance (backtracking)
        $inefficient = $totalDuration > $walkEstimateSec * 0.85
            || $totalDistance > $straightLine * 2.5
            || $transfers >= 2;

        $inefficientReason = null;
        if ($inefficient) {
            if ($transfers >= 2) $inefficientReason = 'Muchos transbordos';
            elseif ($totalDistance > $straightLine * 2.5) $inefficientReason = 'Ruta más larga que a pie';
            else $inefficientReason = 'Similar tiempo que ir a pie';
        }

        return [
            'segments'          => $segments,
            'distance'          => $totalDistance,
            'duration'          => $totalDuration,
            'mode'              => 'transit',
            'inefficient'       => $inefficient,
            'inefficient_reason'=> $inefficientReason,
        ];
    }

    // ── Valhalla request bodies ───────────────────────────────────────────────

    private function walkBody(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $body = [
            'locations' => [
                ['lon' => $fromLng, 'lat' => $fromLat, 'type' => 'break'],
                ['lon' => $toLng,   'lat' => $toLat,   'type' => 'break'],
            ],
            'costing' => 'pedestrian',
            'costing_options' => [
                'pedestrian' => [
                    'walking_speed'  => 4.8,
                    'walkway_factor' => 0.9,
                    'sidewalk_factor'=> 1.0,
                    'alley_factor'   => 1.0,
                    'driveway_factor'=> 5.0,
                    'step_penalty'   => 30,
                ],
            ],
            'directions_options' => ['units' => 'kilometers', 'language' => 'es'],
        ];

        // Cortado segments also block pedestrians (construction, accidents).
        $closures = $this->closedSegmentMidpoints();
        if (!empty($closures)) {
            $body['exclude_locations'] = $closures;
        }

        return $body;
    }

    private function bikeBody(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $body = [
            'locations' => [
                ['lon' => $fromLng, 'lat' => $fromLat, 'type' => 'break'],
                ['lon' => $toLng,   'lat' => $toLat,   'type' => 'break'],
            ],
            'costing' => 'bicycle',
            'costing_options' => [
                'bicycle' => [
                    'bicycle_type'        => 'Hybrid',
                    'cycling_speed'       => 17.0,
                    'use_roads'           => 0.5,
                    'use_hills'           => 0.3,
                    'avoid_bad_surfaces'  => 0.25,
                ],
            ],
            'directions_options' => ['units' => 'kilometers', 'language' => 'es'],
        ];

        $closures = $this->closedSegmentMidpoints();
        if (!empty($closures)) {
            $body['exclude_locations'] = $closures;
        }

        return $body;
    }

    private function autoBody(float $fromLat, float $fromLng, float $toLat, float $toLng, int $alternates = 0): array
    {
        $body = [
            'locations' => [
                ['lon' => $fromLng, 'lat' => $fromLat, 'type' => 'break'],
                ['lon' => $toLng,   'lat' => $toLat,   'type' => 'break'],
            ],
            'costing' => 'auto',
            'costing_options' => [
                'auto' => [
                    'use_highways' => 0.5,
                    'use_tolls'    => 0.0,
                ],
            ],
            'directions_options' => ['units' => 'kilometers', 'language' => 'es'],
        ];

        // Always exclude cortado (closed streets).
        $exclude = $this->closedSegmentMidpoints(['cortado']);

        // When global congestion is high, also route around congested segments.
        $congestion = $this->currentCongestion();
        if ($congestion >= 50) {
            $extra = $this->closedSegmentMidpoints(['congestionado']);
            $exclude = array_merge($exclude, $extra);
        }

        if (!empty($exclude)) {
            $body['exclude_locations'] = $exclude;
        }

        if ($alternates > 0) $body['alternates'] = $alternates;
        return $body;
    }

    /**
     * Midpoints (+ endpoints) of all segments in the given estados.
     * Passed to Valhalla as exclude_locations to avoid those road edges.
     */
    private function closedSegmentMidpoints(array $estados = ['cortado']): array
    {
        $traffic = Cache::get('traffic_current', []);
        $result  = [];

        foreach ($traffic as $t) {
            if (!in_array($t['estado'] ?? '', $estados, true)) continue;

            $latS = (float)($t['lat_start'] ?? 0);
            $lngS = (float)($t['lng_start'] ?? 0);
            $latE = (float)($t['lat_end']   ?? 0);
            $lngE = (float)($t['lng_end']   ?? 0);

            if ($latS === 0.0 || $lngS === 0.0) continue;

            // Valhalla caps exclude_locations at 50 — one midpoint per segment is enough
            $result[] = ['lon' => ($lngS + $lngE) / 2, 'lat' => ($latS + $latE) / 2];
        }

        // Hard cap at 48 to stay safely under Valhalla's limit of 50
        return array_slice($result, 0, 48);
    }

    // ── Valhalla response parsing ─────────────────────────────────────────────

    private function valhallaRoute(float $fromLat, float $fromLng, float $toLat, float $toLng, string $costing): ?array
    {
        try {
            $body = match ($costing) {
                'pedestrian' => $this->walkBody($fromLat, $fromLng, $toLat, $toLng),
                'bicycle'    => $this->bikeBody($fromLat, $fromLng, $toLat, $toLng),
                default      => $this->autoBody($fromLat, $fromLng, $toLat, $toLng),
            };
            $r = Http::timeout(self::VALHALLA_TIMEOUT)
                ->post($this->valhallaBase() . '/route', $body);
            return $this->parseValhalla($r, $costing === 'bicycle' ? 'bike' : 'walk');
        } catch (\Throwable) { return null; }
    }

    private function parseValhalla(mixed $response, string $type = 'walk'): ?array
    {
        try {
            if (!$response || !$response->successful()) return null;
            $data = $response->json();
            return $this->parseTripSummary($data['trip'] ?? null);
        } catch (\Throwable) { return null; }
    }

    private function parseTripSummary(?array $trip): ?array
    {
        if (!$trip || empty($trip['legs'])) return null;

        $summary = $trip['summary'] ?? $trip['legs'][0]['summary'] ?? null;
        if (!$summary) return null;

        $coords = [];
        $steps  = [];

        foreach ($trip['legs'] as $leg) {
            $shape = $leg['shape'] ?? '';
            if ($shape === '') continue;
            $decoded    = $this->decodePolyline6($shape);
            $baseOffset = count($coords);
            // Skip first coord of subsequent legs to avoid duplicates at junctions
            if (!empty($coords) && !empty($decoded)) array_shift($decoded);
            array_push($coords, ...$decoded);

            foreach ($leg['maneuvers'] ?? [] as $maneuver) {
                $type = (int)($maneuver['type'] ?? 0);
                // Skip arrive maneuver — we show it as the destination node
                if ($type === 4 || $type === 5 || $type === 6) continue;
                $steps[] = [
                    'instruction' => $maneuver['instruction'] ?? '',
                    'type'        => $type,
                    'distance'    => (int) round((float)($maneuver['length'] ?? 0) * 1000),
                    'duration'    => (int)($maneuver['time'] ?? 0),
                    'shape_index' => $baseOffset + (int)($maneuver['begin_shape_index'] ?? 0),
                ];
            }
        }

        if (empty($coords)) return null;

        return [
            'geometry' => ['type' => 'LineString', 'coordinates' => $coords],
            'distance' => (float)($summary['length'] ?? 0) * 1000,
            'duration' => (float)($summary['time']   ?? 0),
            'steps'    => $steps,
        ];
    }

    /**
     * Decode Valhalla's encoded polyline (precision 6) to [[lng, lat], ...].
     */
    private function decodePolyline6(string $encoded): array
    {
        $coords = [];
        $len    = strlen($encoded);
        $index  = 0;
        $lat    = 0;
        $lng    = 0;

        while ($index < $len) {
            $b = 0; $shift = 0; $result = 0;
            do {
                $b      = ord($encoded[$index++]) - 63;
                $result |= ($b & 0x1f) << $shift;
                $shift  += 5;
            } while ($b >= 0x20 && $index < $len);
            $lat += ($result & 1) ? ~($result >> 1) : ($result >> 1);

            $result = 0; $shift = 0;
            do {
                $b      = ord($encoded[$index++]) - 63;
                $result |= ($b & 0x1f) << $shift;
                $shift  += 5;
            } while ($b >= 0x20 && $index < $len);
            $lng += ($result & 1) ? ~($result >> 1) : ($result >> 1);

            $coords[] = [round($lng / 1e6, 6), round($lat / 1e6, 6)]; // [lng, lat]
        }

        return $coords;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function currentCongestion(): int
    {
        $data = Cache::get('traffic_current', []);
        if (empty($data)) return 30;
        $total  = count($data);
        $jammed = count(array_filter($data, fn($t) => in_array($t['estado'] ?? '', ['congestionado', 'cortado'])));
        return (int) round(($jammed / $total) * 100);
    }

    private function nearestStation(array $stations, float $lat, float $lng, string $prefer): ?array
    {
        $field     = $prefer === 'bikes' ? 'bikes_available' : 'docks_available';
        $available = array_values(array_filter($stations, fn($s) => ($s[$field] ?? 0) > 0 && ($s['status'] ?? '') === 'active'));
        if (empty($available)) {
            $available = array_values(array_filter($stations, fn($s) => ($s['status'] ?? '') === 'active'));
        }
        return $this->nearestPoint($available, $lat, $lng);
    }

    private function nearestPoint(array $points, float $lat, float $lng): ?array
    {
        if (empty($points)) return null;
        $best = null; $bestDist = PHP_FLOAT_MAX;
        foreach ($points as $p) {
            $d = $this->haversine($lat, $lng, (float)($p['lat'] ?? 0), (float)($p['lng'] ?? 0));
            if ($d < $bestDist) { $bestDist = $d; $best = $p; }
        }
        return $best;
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R  = 6371000;
        $φ1 = deg2rad($lat1); $φ2 = deg2rad($lat2);
        $Δφ = deg2rad($lat2 - $lat1); $Δλ = deg2rad($lng2 - $lng1);
        $a  = sin($Δφ / 2) ** 2 + cos($φ1) * cos($φ2) * sin($Δλ / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
