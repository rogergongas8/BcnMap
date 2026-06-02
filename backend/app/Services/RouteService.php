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

    private string $lang = 'ca';

    private function valhallaBase(): string
    {
        return rtrim(env('VALHALLA_URL', 'http://valhalla:8002'), '/');
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public function planMultimodal(float $fromLat, float $fromLng, float $toLat, float $toLng, ?string $constraint = null, string $lang = 'ca'): array
    {
        $cacheKey = 'plan:v1:' . md5(round($fromLat, 4) . ',' . round($fromLng, 4) . ',' . round($toLat, 4) . ',' . round($toLng, 4) . ',' . ($constraint ?? '') . ',' . $lang);
        $cached = Cache::get($cacheKey);
        if ($cached !== null) return $cached;

        $options = [];
        foreach (['foot', 'bicing', 'metro', 'bus', 'car'] as $mode) {
            try {
                $result = $this->calculate($fromLat, $fromLng, $toLat, $toLng, $mode, $lang);
                $options[$mode] = isset($result['error']) ? null : $result;
            } catch (\Throwable) {
                $options[$mode] = null;
            }
        }

        $walkDist = $options['foot']['distance'] ?? 0;
        $isVeryClose = $walkDist > 0 && $walkDist <= 600;
        $isClose     = $walkDist > 0 && $walkDist <= 1200;

        foreach ($options as $mode => &$route) {
            if (!$route) continue;
            
            $route['inefficient'] = false;
            
            if ($isVeryClose && in_array($mode, ['car', 'metro', 'bus', 'bicing'])) {
                $route['inefficient'] = true;
                $route['inefficient_reason'] = 'El trajecte és molt curt, anar a peu és més ràpid i eficient.';
            } elseif ($isClose && in_array($mode, ['metro', 'bus', 'car'])) {
                $route['inefficient'] = true;
                $route['inefficient_reason'] = 'El trajecte és curt, anar a peu o en bicing és més eficient.';
            }
        }
        unset($route);

        $result = [
            'recommended' => $this->scoreRoutes($options, $constraint),
            'options'     => $options,
        ];

        Cache::put($cacheKey, $result, 300); // 5 min — routes don't change faster

        return $result;
    }

    private function scoreRoutes(array $options, ?string $constraint): string
    {
        $weather    = Cache::get('weather_current_es')
                  ?? Cache::get('weather_current_ca')
                  ?? Cache::get('weather_current_en');
        $desc       = strtolower($weather['description'] ?? '');
        $windSpeed  = (float)($weather['wind_speed'] ?? 0);
        $temp       = (float)($weather['temp'] ?? 20);

        $isRainy    = (bool) preg_match('/rain|llovi|lluvia|shower|drizzle|llovizn|pluja|xàfec/i', $desc);
        $isStormy   = (bool) preg_match('/storm|tormenta|thunder/i', $desc);
        $isHot      = $temp >= 35;
        $strongWind = $windSpeed >= 30;

        $congestion     = $this->currentCongestion();
        $congestionPenalty = 1.0 + max(0, min(1.5, ($congestion - 20) / 50));

        $noMetro    = $constraint && preg_match('/sin metro|no metro|sense metro/i', $constraint);
        $noBici     = $constraint && preg_match('/sin bici|no bici|sense bici/i', $constraint);
        $noBus      = $constraint && preg_match('/sin bus|no bus|sense bus/i', $constraint);
        $noCoche    = $constraint && preg_match('/sin coche|no coche|sense cotxe|a pie|a peu/i', $constraint);
        $hurry      = $constraint && preg_match('/prisa|ràpid|rapido|urgent/i', $constraint);

        // Walking distance = baseline for proximity thresholds
        $walkDist    = (float)(($options['foot']['distance'] ?? 0));
        $isVeryClose = $walkDist > 0 && $walkDist <= 600;   // < 600m: transit never makes sense
        $isClose     = $walkDist > 0 && $walkDist <= 1500;  // < 1.5km: transit rarely worth it

        $scores = [];
        foreach ($options as $mode => $route) {
            if (!$route) { $scores[$mode] = PHP_INT_MAX; continue; }
            $score    = (float)($route['duration'] ?? PHP_INT_MAX);
            $distance = (float)($route['distance'] ?? 0);

            switch ($mode) {
                case 'car':
                    if ($isVeryClose)      $score  = PHP_INT_MAX; // never drive <600m
                    elseif ($isClose)      $score *= 3.5;         // strong discourage <1.5km
                    elseif ($congestion > 40) $score *= $congestionPenalty;
                    if ($isRainy)          $score *= 1.15;
                    if ($isStormy)         $score *= 1.3;
                    if ($noCoche)          $score  = PHP_INT_MAX;
                    break;
                case 'bicing':
                    if ($isRainy)          $score *= 3.0;
                    if ($isStormy)         $score  = PHP_INT_MAX;
                    if ($isHot)            $score *= 1.4;
                    if ($strongWind)       $score *= 1.5;
                    if ($noBici)           $score  = PHP_INT_MAX;
                    break;
                case 'foot':
                    if ($isVeryClose)      $score *= 0.25; // strong preference when very close
                    elseif ($isClose)      $score *= 0.6;
                    elseif ($distance > 3000) $score *= 1.8;
                    if ($isRainy)          $score *= 1.25;
                    if ($isStormy)         $score *= 1.8;
                    if ($isHot && !$isClose) $score *= 1.3;
                    break;
                case 'metro':
                    if ($isVeryClose)      $score  = PHP_INT_MAX; // pointless for <600m
                    elseif ($isClose)      $score *= 2.5;
                    elseif (!$noMetro)     $score  *= 0.92;
                    if ($noMetro)          $score  = PHP_INT_MAX;
                    break;
                case 'bus':
                    if ($isVeryClose)      $score  = PHP_INT_MAX;
                    elseif ($isClose)      $score *= 2.5;
                    if ($noBus)            $score  = PHP_INT_MAX;
                    if (!$isClose && $congestion > 40) $score *= 1.0 + max(0, ($congestion - 40) / 150);
                    break;
            }

            // Con prisa: penalizar modos lentos aún más
            if ($hurry && $mode === 'foot' && $distance > 1500) $score *= 1.5;

            $scores[$mode] = $score;
        }

        $min  = min($scores);
        $best = array_keys(array_filter($scores, fn($s) => $s === $min));
        return $best[0] ?? 'foot';
    }

    public function calculate(float $fromLat, float $fromLng, float $toLat, float $toLng, string $mode, string $lang = 'ca'): array
    {
        $this->lang = in_array($lang, ['ca', 'es', 'en']) ? $lang : 'ca';

        return match ($mode) {
            'foot'   => $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk'),
            'car'    => $this->carRoute($fromLat, $fromLng, $toLat, $toLng),
            'bike'   => $this->singleSegment('bicycle',   $fromLat, $fromLng, $toLat, $toLng, 'bike'),
            'bicing' => $this->bicingRoute($fromLat, $fromLng, $toLat, $toLng),
            'metro'  => $this->transitRoute($fromLat, $fromLng, $toLat, $toLng),
            'bus'    => $this->busRoute($fromLat, $fromLng, $toLat, $toLng),
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
            $weather    = Cache::get('weather_current_es')
                       ?? Cache::get('weather_current_ca')
                       ?? Cache::get('weather_current_en');
            $desc       = strtolower($weather['description'] ?? '');
            $isRainy    = (bool) preg_match('/rain|llovi|lluvia|shower|drizzle|llovizn|pluja|xàfec/i', $desc);
            $isStormy   = (bool) preg_match('/storm|tormenta|thunder/i', $desc);

            // 1.8 = factor base semàfors/cruïlles urbanes (Barcelona ~20 km/h real vs ~36 km/h Valhalla)
            $penalty    = 1.8 + max(0, min(0.8, ($congestion - 20) / 100));
            if ($isRainy)  $penalty *= 1.15;
            if ($isStormy) $penalty *= 1.3;

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

        $originStation = $this->bestOriginStation($stations, $fromLat, $fromLng, $toLat, $toLng);
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

    private function busRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $router = new BusRouter();

        if ($router->isEmpty()) {
            // Graph not yet built — trigger async build and return explicit warming error
            dispatch(fn() => (new BusRouter())->buildAndCache())->afterResponse();
            return ['error' => 'bus_warming', 'mode' => 'bus', 'bus_graph_warming' => true];
        }

        // Wider search: 10 stops from 1000m to catch more line variety (direct routes)
        $originCandidates = $router->nearestStops($fromLat, $fromLng, 10, 1000.0);
        $destCandidates   = $router->nearestStops($toLat,   $toLng,    5,  800.0);

        if (empty($originCandidates) || empty($destCandidates)) {
            return ['error' => 'no_stops_nearby', 'mode' => 'bus'];
        }

        // Collect up to 4 unique-line-combo routes
        $candidates = [];
        foreach ($originCandidates as $orig) {
            $result = $router->route($orig, $toLat, $toLng);
            if (!$result) continue;
            $lineNames = array_map(fn($l) => $l['line_name'] ?? $l['line'], $result['legs']);
            $fullSig   = implode('+', $lineNames);
            if (!isset($candidates[$fullSig])) {
                $candidates[$fullSig] = ['result' => $result, 'origin' => $orig];
            }
            if (count($candidates) >= 4) break;
        }

        if (empty($candidates)) {
            return ['error' => 'no_route_found', 'mode' => 'bus'];
        }

        // Sort by transfers asc, then line count asc (prefer simpler routes first)
        uasort($candidates, function ($a, $b) {
            $ta = count($a['result']['legs']) - 1;
            $tb = count($b['result']['legs']) - 1;
            return $ta !== $tb ? $ta <=> $tb : count($a['result']['legs']) <=> count($b['result']['legs']);
        });
        $candidates = array_values($candidates);

        // Pre-compute stop sequences for all candidates' legs
        $allLegCoords = [];
        foreach ($candidates as $ci => $cand) {
            foreach ($cand['result']['legs'] as $li => $leg) {
                $allLegCoords[$ci][$li] = $router->getStopsBetween(
                    $leg['from_stop'], $leg['to_stop'], $leg['rec_key'] ?? ''
                );
            }
        }

        // Fire all walk + bus leg geometry requests in one parallel pool
        $responses = Http::pool(function ($pool) use ($fromLat, $fromLng, $toLat, $toLng, $candidates, $allLegCoords) {
            $requests = [];
            foreach ($candidates as $ci => $cand) {
                $origin = $cand['origin'];
                $alight = $cand['result']['alight_stop'];
                $oLat = (float)$origin['lat']; $oLng = (float)$origin['lng'];
                $dLat = (float)$alight['lat']; $dLng = (float)$alight['lng'];
                $requests[] = $pool->as("w1_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($fromLat, $fromLng, $oLat, $oLng));
                $requests[] = $pool->as("w2_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($dLat, $dLng, $toLat, $toLng));
                foreach ($allLegCoords[$ci] ?? [] as $li => $stops) {
                    if (count($stops) >= 2) {
                        $requests[] = $pool->as("b_{$ci}_{$li}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->busLegBody($stops));
                    }
                }
            }
            return $requests;
        });

        // Build segments for each candidate
        $alternatives = [];
        $straightLine    = $this->haversine($fromLat, $fromLng, $toLat, $toLng);
        $walkEstimateSec = $straightLine / 1.25;

        foreach ($candidates as $ci => $cand) {
            $origin    = $cand['origin'];
            $alight    = $cand['result']['alight_stop'];
            $legs      = $cand['result']['legs'];
            $transfers = count($legs) - 1;
            $walk1     = isset($responses["w1_{$ci}"]) ? $this->parseValhalla($responses["w1_{$ci}"], 'walk') : null;
            $walk2     = isset($responses["w2_{$ci}"]) ? $this->parseValhalla($responses["w2_{$ci}"], 'walk') : null;

            $segs = [];
            if ($walk1 && $walk1['distance'] > 20) {
                $segs[] = ['type' => 'walk', 'geometry' => $walk1['geometry'], 'distance' => $walk1['distance'], 'duration' => $walk1['duration'], 'color' => self::COLORS['walk'], 'label' => 'Caminar a ' . ($origin['stop_name'] ?? 'parada'), 'meta' => ['stop_id' => $origin['stop_id'], 'stop_name' => $origin['stop_name'], 'stop_lat' => (float)$origin['lat'], 'stop_lng' => (float)$origin['lng']]];
            }

            foreach ($legs as $li => $leg) {
                $from     = $leg['from_stop'];
                $to       = $leg['to_stop'];
                $recKey   = $leg['rec_key'] ?? '';
                $lineName = $leg['line_name'] ?? $leg['line'];
                $busGeo   = isset($responses["b_{$ci}_{$li}"]) ? $this->parseValhalla($responses["b_{$ci}_{$li}"], 'bus') : null;

                if ($busGeo) {
                    $geo = $busGeo['geometry']; $dist = $busGeo['distance']; $dur = $busGeo['duration'];
                } else {
                    $geo = $router->legGeometry($from, $to, $recKey);
                    $dist = $router->legDistance($from, $to, $recKey);
                    $dur  = ($dist / BusRouter::BUS_SPEED_MS) + 60;
                }

                $segs[] = ['type' => 'bus', 'geometry' => $geo, 'distance' => $dist, 'duration' => $dur, 'color' => self::COLORS['bus'], 'label' => 'Bus ' . $lineName, 'meta' => ['from_station_id' => $from['stop_id'], 'from_station' => $from['stop_name'] ?? '', 'from_lat' => (float)$from['lat'], 'from_lng' => (float)$from['lng'], 'to_station_id' => $to['stop_id'], 'to_station' => $to['stop_name'] ?? '', 'to_lat' => (float)$to['lat'], 'to_lng' => (float)$to['lng'], 'lines' => [$lineName], 'line_colors' => [$lineName => '00b4ff'], 'direction' => null]];
            }

            if ($walk2 && $walk2['distance'] > 20) {
                $segs[] = ['type' => 'walk', 'geometry' => $walk2['geometry'], 'distance' => $walk2['distance'], 'duration' => $walk2['duration'], 'color' => self::COLORS['walk'], 'label' => 'Caminar al destino'];
            }

            $totalDist = array_sum(array_column($segs, 'distance'));
            $totalDur  = array_sum(array_column($segs, 'duration'));
            $lineNames = array_map(fn($l) => $l['line_name'] ?? $l['line'], $legs);

            $alternatives[] = [
                'segments'    => $segs,
                'distance'    => $totalDist,
                'duration'    => $totalDur,
                'lines_label' => implode(' → ', $lineNames),
                'transfers'   => $transfers,
                'inefficient' => $totalDur > $walkEstimateSec * 0.9 || $transfers >= 2,
            ];
        }

        // Merge hybrid bus+metro alternatives with pure-bus ones, then filter
        $hybridAlts = $this->hybridBusMetroAlternatives($fromLat, $fromLng, $toLat, $toLng, $router);
        $allAlts    = array_merge($alternatives, $hybridAlts);
        $rankedAlts = $this->filterAndRankAlternatives($allAlts, $straightLine);

        // Fallback: if nothing passes the filter, keep only the fastest unfiltered option
        if (empty($rankedAlts)) {
            usort($allAlts, fn($a, $b) => $a['duration'] <=> $b['duration']);
            $best = $allAlts[0];
            return [
                'segments'     => $best['segments'],
                'distance'     => $best['distance'],
                'duration'     => $best['duration'],
                'mode'         => 'bus',
                'inefficient'  => true,
                'alternatives' => [$best],
            ];
        }

        $best = $rankedAlts[0];
        return [
            'segments'     => $best['segments'],
            'distance'     => $best['distance'],
            'duration'     => $best['duration'],
            'mode'         => 'bus',
            'inefficient'  => false,
            'alternatives' => $rankedAlts,
        ];
    }

    /**
     * Find bus→metro hybrid routes.
     * Routes bus from origin to a metro station near the destination, then metro to dest.
     * Uses BusRouter geometry (no Valhalla for bus legs) + 3 Valhalla walk calls per candidate.
     */
    private function hybridBusMetroAlternatives(
        float $fromLat, float $fromLng, float $toLat, float $toLng,
        BusRouter $busRouter
    ): array {
        $metroRouter   = new MetroRouter();
        $allStations   = Cache::get('metro:stations', []);
        $metroStations = array_values(array_filter($allStations, fn($s) => ($s['type'] ?? '') === 'metro'));
        if (empty($metroStations)) return [];

        // --- Destination stations (where metro ride ends) ---
        usort($metroStations, fn($a, $b) =>
            $this->haversine($toLat, $toLng, (float)$a['lat'], (float)$a['lng']) <=>
            $this->haversine($toLat, $toLng, (float)$b['lat'], (float)$b['lng'])
        );
        $topDestStations = array_slice($metroStations, 0, 5);

        // Lines that serve the destination (e.g. L5 for Sagrada Família)
        $destLines = [];
        foreach (array_slice($topDestStations, 0, 2) as $ds) {
            foreach ($ds['lines'] ?? [] as $l) { $destLines[$l['name']] = true; }
        }

        // --- Transfer station pool ---
        // Must be on a destination line, NOT at the destination (>300m),
        // and not further from origin than 1.3× the total trip distance.
        $origToDest = $this->haversine($fromLat, $fromLng, $toLat, $toLng);
        $xferPool   = [];
        foreach ($metroStations as $s) {
            $dToDest = $this->haversine($toLat, $toLng, (float)$s['lat'], (float)$s['lng']);
            if ($dToDest < 300) continue;  // too close to destination — no meaningful metro ride

            $onDestLine = false;
            foreach ($s['lines'] ?? [] as $l) {
                if (isset($destLines[$l['name']])) { $onDestLine = true; break; }
            }
            if (!$onDestLine) continue;

            $dToOrig = $this->haversine($fromLat, $fromLng, (float)$s['lat'], (float)$s['lng']);
            if ($dToOrig > $origToDest * 1.3) continue;  // avoid backtracking

            $xferPool[] = $s;
        }

        if (empty($xferPool)) return [];

        // Sort by proximity to origin (closest = shortest walk to transfer)
        usort($xferPool, fn($a, $b) =>
            $this->haversine($fromLat, $fromLng, (float)$a['lat'], (float)$a['lng']) <=>
            $this->haversine($fromLat, $fromLng, (float)$b['lat'], (float)$b['lng'])
        );
        $transferStations = array_slice($xferPool, 0, 5);

        $originStops = $busRouter->nearestStops($fromLat, $fromLng, 4, 700.0);
        if (empty($originStops)) return [];

        $seen = []; $rawCandidates = [];

        foreach ($transferStations as $xferStation) {
            $xLat = (float)$xferStation['lat']; $xLng = (float)$xferStation['lng'];

            foreach ($originStops as $origStop) {
                $busResult = $busRouter->route($origStop, $xLat, $xLng);
                if (!$busResult) continue;

                $alight   = $busResult['alight_stop'];
                $xferWalk = $this->haversine((float)$alight['lat'], (float)$alight['lng'], $xLat, $xLng);
                if ($xferWalk > 500) continue;

                // Best metro leg from transfer station to destination
                $bestMLegs = null; $bestMScore = PHP_FLOAT_MAX; $bestDStn = null;
                foreach ($topDestStations as $dStn) {
                    if ($dStn['station_id'] === $xferStation['station_id']) continue;
                    $mLegs = $metroRouter->route($xferStation, $dStn);
                    if (!$mLegs) continue;
                    $rT = array_sum(array_column($mLegs, 'route_time_s'));
                    $wD = $this->haversine((float)$dStn['lat'], (float)$dStn['lng'], $toLat, $toLng);
                    $sc = $rT + (count($mLegs) - 1) * 240 + $wD / 1.25;
                    if ($sc < $bestMScore) { $bestMLegs = $mLegs; $bestMScore = $sc; $bestDStn = $dStn; }
                }
                if (!$bestMLegs || !$bestDStn) continue;

                $busLines   = array_map(fn($l) => $l['line_name'] ?? $l['line'], $busResult['legs']);
                $metroLines = array_map(fn($l) => $l['line'], $bestMLegs);
                $sig        = implode('+', $busLines) . '→M' . implode('/', $metroLines);
                if (isset($seen[$sig])) continue;
                $seen[$sig] = true;

                $rawCandidates[] = compact(
                    'busResult', 'origStop', 'alight', 'xferStation', 'xferWalk',
                    'bestMLegs', 'bestDStn', 'busLines', 'metroLines', 'sig'
                );
                if (count($rawCandidates) >= 4) break 2;
            }
        }

        if (empty($rawCandidates)) return [];

        // 3 Valhalla walk calls per candidate (to bus stop, transfer walk, from metro to dest)
        $responses = Http::pool(function ($pool) use ($fromLat, $fromLng, $toLat, $toLng, $rawCandidates) {
            $reqs = [];
            foreach ($rawCandidates as $ci => $c) {
                $oLat = (float)$c['origStop']['lat'];    $oLng = (float)$c['origStop']['lng'];
                $aLat = (float)$c['alight']['lat'];      $aLng = (float)$c['alight']['lng'];
                $xLat = (float)$c['xferStation']['lat']; $xLng = (float)$c['xferStation']['lng'];
                $dLat = (float)$c['bestDStn']['lat'];    $dLng = (float)$c['bestDStn']['lng'];
                $reqs[] = $pool->as("w1_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($fromLat, $fromLng, $oLat, $oLng));
                $reqs[] = $pool->as("wt_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($aLat, $aLng, $xLat, $xLng));
                $reqs[] = $pool->as("w2_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($dLat, $dLng, $toLat, $toLng));
            }
            return $reqs;
        });

        $alternatives = [];
        foreach ($rawCandidates as $ci => $c) {
            $walk1 = isset($responses["w1_{$ci}"]) ? $this->parseValhalla($responses["w1_{$ci}"], 'walk') : null;
            $walkT = isset($responses["wt_{$ci}"]) ? $this->parseValhalla($responses["wt_{$ci}"], 'walk') : null;
            $walk2 = isset($responses["w2_{$ci}"]) ? $this->parseValhalla($responses["w2_{$ci}"], 'walk') : null;

            $segs = [];

            if ($walk1 && $walk1['distance'] > 20) {
                $segs[] = ['type' => 'walk', 'geometry' => $walk1['geometry'], 'distance' => $walk1['distance'], 'duration' => $walk1['duration'], 'color' => self::COLORS['walk'], 'label' => 'Caminar a ' . ($c['origStop']['stop_name'] ?? 'parada'), 'meta' => ['stop_id' => $c['origStop']['stop_id'] ?? '', 'stop_name' => $c['origStop']['stop_name'] ?? '']];
            }

            foreach ($c['busResult']['legs'] as $leg) {
                $from = $leg['from_stop']; $to = $leg['to_stop']; $recKey = $leg['rec_key'] ?? '';
                $lineName = $leg['line_name'] ?? $leg['line'];
                $geo  = $busRouter->legGeometry($from, $to, $recKey);
                $dist = $busRouter->legDistance($from, $to, $recKey);
                $dur  = ($dist / BusRouter::BUS_SPEED_MS) + 60;
                $segs[] = ['type' => 'bus', 'geometry' => $geo, 'distance' => $dist, 'duration' => $dur, 'color' => self::COLORS['bus'], 'label' => 'Bus ' . $lineName, 'meta' => ['from_station_id' => $from['stop_id'] ?? '', 'from_station' => $from['stop_name'] ?? '', 'from_lat' => (float)$from['lat'], 'from_lng' => (float)$from['lng'], 'to_station_id' => $to['stop_id'] ?? '', 'to_station' => $to['stop_name'] ?? '', 'to_lat' => (float)$to['lat'], 'to_lng' => (float)$to['lng'], 'lines' => [$lineName], 'line_colors' => [$lineName => '00b4ff'], 'direction' => null]];
            }

            // Transfer walk: bus alight stop → metro station
            if ($walkT && $walkT['distance'] > 20) {
                $segs[] = ['type' => 'walk', 'geometry' => $walkT['geometry'], 'distance' => $walkT['distance'], 'duration' => $walkT['duration'], 'color' => self::COLORS['walk'], 'label' => 'Caminar a ' . ($c['xferStation']['station_name'] ?? 'metro')];
            } elseif ($c['xferWalk'] > 5) {
                $aLat = (float)$c['alight']['lat']; $aLng = (float)$c['alight']['lng'];
                $xLat = (float)$c['xferStation']['lat']; $xLng = (float)$c['xferStation']['lng'];
                $segs[] = ['type' => 'walk', 'geometry' => ['type' => 'LineString', 'coordinates' => [[$aLng, $aLat], [$xLng, $xLat]]], 'distance' => $c['xferWalk'], 'duration' => (int)($c['xferWalk'] / 1.25), 'color' => self::COLORS['walk'], 'label' => 'Caminar a ' . ($c['xferStation']['station_name'] ?? 'metro')];
            }

            // Metro legs
            foreach ($c['bestMLegs'] as $mli => $mleg) {
                $lineName   = $mleg['line'];
                $from       = $mleg['from_station']; $to = $mleg['to_station'];
                $geometry   = $metroRouter->legGeometry($lineName, $from, $to);
                $color      = $metroRouter->lineColor($lineName);
                $dist       = $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
                $routeTimeS = $mleg['route_time_s'] ?? ($dist / 6.5);
                $stopsCount = $mleg['stops_count'] ?? 1;
                $dur        = $routeTimeS + ($stopsCount * 25) + 60 + ($mli > 0 ? 120 : 0);
                $segs[] = ['type' => 'metro', 'geometry' => $geometry, 'distance' => $dist, 'duration' => $dur, 'color' => $color, 'label' => 'Metro ' . $lineName, 'meta' => ['from_station_id' => $from['station_id'], 'from_station' => $from['station_name'], 'from_lat' => (float)$from['lat'], 'from_lng' => (float)$from['lng'], 'to_station_id' => $to['station_id'], 'to_station' => $to['station_name'], 'to_lat' => (float)$to['lat'], 'to_lng' => (float)$to['lng'], 'lines' => [$lineName], 'line_colors' => [$lineName => ltrim($color, '#')], 'direction' => $metroRouter->terminus($lineName, $from, $to)]];
            }

            if ($walk2 && $walk2['distance'] > 20) {
                $segs[] = ['type' => 'walk', 'geometry' => $walk2['geometry'], 'distance' => $walk2['distance'], 'duration' => $walk2['duration'], 'color' => self::COLORS['walk'], 'label' => 'Caminar al destino'];
            }

            $alternatives[] = [
                'segments'    => $segs,
                'distance'    => array_sum(array_column($segs, 'distance')),
                'duration'    => array_sum(array_column($segs, 'duration')),
                'lines_label' => implode(' → ', $c['busLines']) . ' → ' . implode('/', $c['metroLines']),
                'transfers'   => count($c['busResult']['legs']) + count($c['bestMLegs']),
                'is_hybrid'   => true,
            ];
        }

        return $alternatives;
    }

    /**
     * Filter alternatives to only efficient routes, sorted by duration.
     * Removes routes slower than walking, with excessive detour, or too many transfers.
     */
    private function filterAndRankAlternatives(array $alternatives, float $straightLineDist): array
    {
        $walkEstimateSec = $straightLineDist / 1.25;

        $filtered = array_filter($alternatives, function ($alt) use ($walkEstimateSec, $straightLineDist) {
            $dur       = $alt['duration'] ?? PHP_INT_MAX;
            $dist      = $alt['distance'] ?? 0;
            $transfers = $alt['transfers'] ?? 0;

            if ($dur   > $walkEstimateSec * 0.9)  return false; // no ahorra tiempo vs caminar
            if ($dist  > $straightLineDist * 5.0) return false; // desvío excesivo
            if ($transfers > 2)                    return false; // demasiados transbordos

            return true;
        });

        usort($filtered, fn($a, $b) => $a['duration'] <=> $b['duration']);

        return array_values(array_slice($filtered, 0, 3));
    }

    private function transitRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $allStations   = Cache::get('metro:stations', []);
        $metroStations = array_values(array_filter($allStations, fn($s) => ($s['type'] ?? '') === 'metro'));

        if (empty($metroStations)) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $router = new MetroRouter();

        // Sort by proximity to origin and try top 3 — the closest station isn't always on the fastest line
        usort($metroStations, fn($a, $b) =>
            $this->haversine($fromLat, $fromLng, (float)$a['lat'], (float)$a['lng']) <=>
            $this->haversine($fromLat, $fromLng, (float)$b['lat'], (float)$b['lng'])
        );
        $topOrigins = array_slice($metroStations, 0, 3);

        $destCandidates = $metroStations;
        usort($destCandidates, fn($a, $b) =>
            $this->haversine($toLat, $toLng, (float)$a['lat'], (float)$a['lng']) <=>
            $this->haversine($toLat, $toLng, (float)$b['lat'], (float)$b['lng'])
        );
        $topDest = array_slice($destCandidates, 0, 5);

        if (empty($topOrigins) || empty($topDest)) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        // Collect top 3 candidates with unique line signatures
        $rawCandidates = [];
        $seen          = [];

        foreach ($topOrigins as $origCandidate) {
            $walkToOrig = $this->haversine($fromLat, $fromLng, (float)$origCandidate['lat'], (float)$origCandidate['lng']);
            foreach ($topDest as $destCandidate) {
                if ($origCandidate['station_id'] === $destCandidate['station_id']) continue;
                $legs = $router->route($origCandidate, $destCandidate);
                if (!$legs) continue;

                $lineSig    = implode('→', array_column($legs, 'line'));
                if (isset($seen[$lineSig])) continue;
                $seen[$lineSig] = true;

                $transfers  = count($legs) - 1;
                $walkToDest = $this->haversine((float)$destCandidate['lat'], (float)$destCandidate['lng'], $toLat, $toLng);
                $routeTimeS = array_sum(array_column($legs, 'route_time_s'));
                $score      = $walkToOrig / 1.25 + $routeTimeS + $transfers * 240 + $walkToDest / 1.25;

                $rawCandidates[] = compact('legs', 'score', 'origCandidate', 'destCandidate', 'lineSig');
                if (count($rawCandidates) >= 5) break 2;
            }
        }

        if (empty($rawCandidates)) {
            return $this->singleSegment('pedestrian', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        usort($rawCandidates, fn($a, $b) => $a['score'] <=> $b['score']);
        $rawCandidates = array_slice($rawCandidates, 0, 3);

        // Parallel Valhalla walk requests (2 per candidate)
        $responses = Http::pool(function ($pool) use ($fromLat, $fromLng, $toLat, $toLng, $rawCandidates) {
            $reqs = [];
            foreach ($rawCandidates as $ci => $c) {
                $firstFrom = $c['legs'][0]['from_station'];
                $lastTo    = $c['legs'][count($c['legs']) - 1]['to_station'];
                $oLat = (float)$firstFrom['lat']; $oLng = (float)$firstFrom['lng'];
                $dLat = (float)$lastTo['lat'];    $dLng = (float)$lastTo['lng'];
                $reqs[] = $pool->as("w1_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($fromLat, $fromLng, $oLat, $oLng));
                $reqs[] = $pool->as("w2_{$ci}")->timeout(self::VALHALLA_TIMEOUT)->post($this->valhallaBase() . '/route', $this->walkBody($dLat, $dLng, $toLat, $toLng));
            }
            return $reqs;
        });

        // Build segments for each candidate
        $alternatives    = [];
        $straightLine    = $this->haversine($fromLat, $fromLng, $toLat, $toLng);
        $walkEstimateSec = $straightLine / 1.25;

        foreach ($rawCandidates as $ci => $c) {
            $legs      = $c['legs'];
            $firstFrom = $legs[0]['from_station'];
            $lastTo    = $legs[count($legs) - 1]['to_station'];
            $walk1     = isset($responses["w1_{$ci}"]) ? $this->parseValhalla($responses["w1_{$ci}"], 'walk') : null;
            $walk2     = isset($responses["w2_{$ci}"]) ? $this->parseValhalla($responses["w2_{$ci}"], 'walk') : null;

            $segs = [];

            if ($walk1 && $walk1['distance'] > 20) {
                $segs[] = [
                    'type' => 'walk', 'geometry' => $walk1['geometry'],
                    'distance' => $walk1['distance'], 'duration' => $walk1['duration'],
                    'color' => self::COLORS['walk'],
                    'label' => 'Caminar a ' . ($firstFrom['station_name'] ?? 'estación'),
                    'meta'  => [
                        'station_id'   => $firstFrom['station_id'],
                        'station_name' => $firstFrom['station_name'],
                        'station_lat'  => (float)$firstFrom['lat'], 'station_lng' => (float)$firstFrom['lng'],
                    ],
                ];
            }

            foreach ($legs as $leg) {
                $lineName   = $leg['line'];
                $from       = $leg['from_station'];
                $to         = $leg['to_station'];
                $geometry   = $router->legGeometry($lineName, $from, $to);
                $color      = $router->lineColor($lineName);
                $dist       = $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
                $isFirst    = ($leg === $legs[0]);
                $routeTimeS = $leg['route_time_s'] ?? ($dist / 6.5);
                $stopsCount = $leg['stops_count'] ?? 1;
                $dur        = $routeTimeS + ($stopsCount * 25) + 60 + ($isFirst ? 0 : 120);

                $segs[] = [
                    'type'     => 'metro', 'geometry' => $geometry,
                    'distance' => $dist,   'duration'  => $dur,
                    'color'    => $color,  'label'     => 'Metro ' . $lineName,
                    'meta'     => [
                        'from_station_id' => $from['station_id'], 'from_station' => $from['station_name'],
                        'from_lat'        => (float)$from['lat'], 'from_lng'     => (float)$from['lng'],
                        'to_station_id'   => $to['station_id'],   'to_station'   => $to['station_name'],
                        'to_lat'          => (float)$to['lat'],   'to_lng'       => (float)$to['lng'],
                        'lines'           => [$lineName],
                        'line_colors'     => [$lineName => $color],
                        'direction'       => $router->terminus($lineName, $from, $to),
                    ],
                ];
            }

            if ($walk2 && $walk2['distance'] > 20) {
                $segs[] = [
                    'type' => 'walk', 'geometry' => $walk2['geometry'],
                    'distance' => $walk2['distance'], 'duration' => $walk2['duration'],
                    'color' => self::COLORS['walk'], 'label' => 'Caminar al destino',
                ];
            }

            $totalDist = array_sum(array_column($segs, 'distance'));
            $totalDur  = array_sum(array_column($segs, 'duration'));
            $transfers = count(array_filter($segs, fn($s) => $s['type'] === 'metro')) - 1;
            $lineNames = array_column($legs, 'line');

            $inefficient = $totalDur > $walkEstimateSec * 0.85
                || $totalDist > $straightLine * 3.5
                || $transfers >= 3;

            $alternatives[] = [
                'segments'    => $segs,
                'distance'    => $totalDist,
                'duration'    => $totalDur,
                'transfers'   => max(0, $transfers),
                'lines_label' => implode(' → ', $lineNames),
                'inefficient' => $inefficient,
            ];
        }

        $best = $alternatives[0];

        return [
            'segments'     => $best['segments'],
            'distance'     => $best['distance'],
            'duration'     => $best['duration'],
            'mode'         => 'metro',
            'inefficient'  => $best['inefficient'],
            'lines_label'  => $best['lines_label'],
            'alternatives' => $alternatives,
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
            'directions_options' => ['units' => 'kilometers', 'language' => $this->lang],
        ];

        // Cortado segments also block pedestrians (construction, accidents).
        $closures = $this->trafficExcludeLocations(['cortado']);
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
            'directions_options' => ['units' => 'kilometers', 'language' => $this->lang],
        ];

        $closures = $this->trafficExcludeLocations(['cortado']);
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
                    'use_highways' => 0.1,  // evitar rondes/autopistes urbanes — preferir xarxa de carrers
                    'use_tolls'    => 0.0,
                    'top_speed'    => 50,   // límit urbà Barcelona (km/h)
                ],
            ],
            'directions_options' => ['units' => 'kilometers', 'language' => $this->lang],
        ];

        // Always exclude closed streets + congested segments.
        // Using 3 points per segment (start + mid + end) for better Valhalla edge matching.
        $exclude = $this->trafficExcludeLocations(['cortado', 'congestionado']);
        if (!empty($exclude)) {
            $body['exclude_locations'] = $exclude;
        }

        if ($alternates > 0) $body['alternates'] = $alternates;
        return $body;
    }

    /**
     * Build a Valhalla `auto` request that threads through bus stop coordinates
     * to produce road-following geometry for a bus leg.
     * Intermediate stops become `through` locations; endpoints are `break_through`.
     * When there are more than 10 intermediate stops, we sample evenly to cap the
     * request size and stay within Valhalla's location limits.
     *
     * @param  array $stopCoords  [{lat, lng}, ...] in route order (at least 2 entries)
     */
    private function busLegBody(array $stopCoords): array
    {
        $n = count($stopCoords);

        // Sample intermediate stops if there are too many (keep ≤8 through-stops)
        if ($n > 10) {
            $step         = (int) ceil(($n - 2) / 8);
            $intermediate = [];
            for ($i = 1; $i < $n - 1; $i += $step) {
                $intermediate[] = $stopCoords[$i];
            }
        } else {
            $intermediate = array_slice($stopCoords, 1, $n - 2);
        }

        $locations = [['lon' => $stopCoords[0]['lng'], 'lat' => $stopCoords[0]['lat'], 'type' => 'break_through']];
        foreach ($intermediate as $coord) {
            $locations[] = ['lon' => $coord['lng'], 'lat' => $coord['lat'], 'type' => 'through'];
        }
        $locations[] = ['lon' => $stopCoords[$n - 1]['lng'], 'lat' => $stopCoords[$n - 1]['lat'], 'type' => 'break_through'];

        return [
            'locations'          => $locations,
            'costing'            => 'auto',
            'costing_options'    => ['auto' => ['use_highways' => 0.3, 'use_tolls' => 0.0]],
            'directions_options' => ['units' => 'kilometers'],
        ];
    }

    /**
     * Returns exclude_locations for Valhalla from traffic segments matching $estados.
     * Uses start + midpoint + end (3 points per segment) so Valhalla snaps to the
     * full road edge instead of just one point near the middle.
     * Valhalla caps exclude_locations at 50, so we allow at most 16 segments × 3 = 48.
     */
    private function trafficExcludeLocations(array $estados = ['cortado']): array
    {
        $traffic = Cache::get('traffic_current', []);
        $result  = [];
        $count   = 0;

        foreach ($traffic as $t) {
            if (!in_array($t['estado'] ?? '', $estados, true)) continue;

            $latS = (float)($t['lat_start'] ?? 0);
            $lngS = (float)($t['lng_start'] ?? 0);
            $latE = (float)($t['lat_end']   ?? 0);
            $lngE = (float)($t['lng_end']   ?? 0);

            if ($latS === 0.0 || $lngS === 0.0) continue;

            $result[] = ['lon' => $lngS,                  'lat' => $latS];
            $result[] = ['lon' => ($lngS + $lngE) / 2,   'lat' => ($latS + $latE) / 2];
            if ($latE !== 0.0 && $lngE !== 0.0) {
                $result[] = ['lon' => $lngE, 'lat' => $latE];
            }

            if (++$count >= 16) break; // 16 segments × 3 pts = 48, within Valhalla's limit
        }

        return $result;
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
        if ($prefer === 'bikes') {
            $available = array_values(array_filter($stations, fn($s) =>
                (($s['bikes_available'] ?? 0) + ($s['ebikes_available'] ?? 0)) > 0
                && ($s['status'] ?? '') === 'active'
            ));
        } else {
            $available = array_values(array_filter($stations, fn($s) =>
                ($s['docks_available'] ?? 0) > 0 && ($s['status'] ?? '') === 'active'
            ));
        }
        if (empty($available)) {
            $available = array_values(array_filter($stations, fn($s) => ($s['status'] ?? '') === 'active'));
        }
        return $this->nearestPoint($available, $lat, $lng);
    }

    /**
     * Pick the best origin Bicing station accounting for direction to destination.
     * Scores each candidate as walk_distance + 0.35 * bike_distance_to_dest,
     * reflecting that cycling is ~3× faster than walking.
     */
    private function bestOriginStation(array $stations, float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        $available = array_values(array_filter($stations, fn($s) =>
            (($s['bikes_available'] ?? 0) + ($s['ebikes_available'] ?? 0)) > 0
            && ($s['status'] ?? '') === 'active'
        ));
        if (empty($available)) {
            $available = array_values(array_filter($stations, fn($s) => ($s['status'] ?? '') === 'active'));
        }
        if (empty($available)) return null;

        $best = null; $bestScore = PHP_FLOAT_MAX;
        foreach ($available as $s) {
            $walkDist = $this->haversine($fromLat, $fromLng, (float)$s['lat'], (float)$s['lng']);
            $bikeDist = $this->haversine((float)$s['lat'], (float)$s['lng'], $toLat, $toLng);
            $score = $walkDist + 0.35 * $bikeDist;
            if ($score < $bestScore) { $bestScore = $score; $best = $s; }
        }
        return $best;
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
