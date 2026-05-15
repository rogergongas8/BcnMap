<?php
declare(strict_types=1);
namespace App\Services;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class RouteService
{
    private const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

    private const COLORS = [
        'walk'  => '#ffffff',
        'bike'  => '#00ff88',
        'drive' => '#ffaa00',
        'metro' => '#ff6b35',
        'bus'   => '#00b4ff',
    ];

    // Real-world average speeds for urban Barcelona (km/h).
    // The public OSRM demo server returns identical durations for all profiles,
    // so we override duration using road distance + these speeds.
    private const SPEEDS_KMH = [
        'walk'  => 4.8,   // typical pedestrian in city
        'bike'  => 17.0,  // city cycling with traffic lights
        'drive' => 28.0,  // urban driving BCN (congestion factored)
    ];

    public function calculate(float $fromLat, float $fromLng, float $toLat, float $toLng, string $mode): array
    {
        return match ($mode) {
            'foot'   => $this->singleSegment('foot',    $fromLat, $fromLng, $toLat, $toLng, 'walk'),
            'car'    => $this->carRoute($fromLat, $fromLng, $toLat, $toLng),
            'bike'   => $this->singleSegment('bike',    $fromLat, $fromLng, $toLat, $toLng, 'bike'),
            'bicing' => $this->bicingRoute($fromLat, $fromLng, $toLat, $toLng),
            'bus'    => $this->transitRoute($fromLat, $fromLng, $toLat, $toLng),
            default  => ['error' => 'Modo de transporte no soportado'],
        };
    }

    /**
     * Car route: fetches up to 3 OSRM alternatives, applies real-time traffic
     * congestion penalty, and returns the fastest after adjustment.
     */
    private function carRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        try {
            $r = Http::timeout(12)->get(
                self::OSRM_BASE . "/driving/{$fromLng},{$fromLat};{$toLng},{$toLat}",
                ['overview' => 'full', 'geometries' => 'geojson', 'alternatives' => 'true']
            );
            if (!$r->successful()) return $this->singleSegment('driving', $fromLat, $fromLng, $toLat, $toLng, 'drive');

            $data   = $r->json();
            $routes = $data['routes'] ?? [];
            if (empty($routes)) return ['error' => 'No se encontró ruta'];

            // Traffic congestion level (0-100) derived from live traffic data
            $congestion = $this->currentCongestion();

            // Penalty factor: +1% per congestion point above 20, capped at +80%
            $penalty = 1.0 + max(0, min(0.8, ($congestion - 20) / 100));

            // For each alternative: use OSRM geometry (real road distance) + our duration formula + traffic
            $candidates = array_map(function ($route) use ($penalty) {
                $dist = (float) $route['distance'];
                $dur  = $this->realisticDuration($dist, 'drive') * $penalty;
                return ['geometry' => $route['geometry'], 'distance' => $dist, 'duration' => $dur];
            }, $routes);

            // Pick route with shortest traffic-adjusted duration
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
            return $this->singleSegment('driving', $fromLat, $fromLng, $toLat, $toLng, 'drive');
        }
    }

    private function singleSegment(string $profile, float $fromLat, float $fromLng, float $toLat, float $toLng, string $type): array
    {
        $seg = $this->osrmRoute($profile, $fromLat, $fromLng, $toLat, $toLng, $type);
        if (!$seg) return ['error' => 'No se encontró ruta'];
        return [
            'segments' => [[
                'type'     => $type,
                'geometry' => $seg['geometry'],
                'distance' => $seg['distance'],
                'duration' => $seg['duration'],
                'color'    => self::COLORS[$type],
                'label'    => match($type) { 'walk' => 'A pie', 'drive' => 'En coche', 'bike' => 'En bici', default => ucfirst($type) },
            ]],
            'distance' => $seg['distance'],
            'duration' => $seg['duration'],
        ];
    }

    private function bicingRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $stations = Cache::get('bicing_current', []);
        if (empty($stations)) {
            return $this->singleSegment('bike', $fromLat, $fromLng, $toLat, $toLng, 'bike');
        }

        $originStation = $this->nearestStation($stations, $fromLat, $fromLng, 'bikes');
        $destStation   = $this->nearestStation($stations, $toLat, $toLng, 'docks');

        if (!$originStation || !$destStation || $originStation['station_id'] === $destStation['station_id']) {
            return $this->singleSegment('foot', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        // Parallel OSRM requests
        $oLng = $originStation['lng']; $oLat = $originStation['lat'];
        $dLng = $destStation['lng'];   $dLat = $destStation['lat'];

        $responses = Http::pool(fn($pool) => [
            $pool->as('walk1')->timeout(12)->get(self::OSRM_BASE . "/foot/{$fromLng},{$fromLat};{$oLng},{$oLat}", ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('bike') ->timeout(12)->get(self::OSRM_BASE . "/bike/{$oLng},{$oLat};{$dLng},{$dLat}",       ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('walk2')->timeout(12)->get(self::OSRM_BASE . "/foot/{$dLng},{$dLat};{$toLng},{$toLat}",   ['overview' => 'full', 'geometries' => 'geojson']),
        ]);

        $walk1 = $this->parseOsrm($responses['walk1'], 'walk');
        $bike  = $this->parseOsrm($responses['bike'],  'bike');
        $walk2 = $this->parseOsrm($responses['walk2'], 'walk');

        if (!$bike) {
            return $this->singleSegment('bike', $fromLat, $fromLng, $toLat, $toLng, 'bike');
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
                    'station_lat'      => (float)$originStation['lat'],
                    'station_lng'      => (float)$originStation['lng'],
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
                'from_lat'          => (float)$originStation['lat'],
                'from_lng'          => (float)$originStation['lng'],
                'to_station_id'     => $destStation['station_id'],
                'to_station'        => $destStation['station_name'],
                'to_lat'            => (float)$destStation['lat'],
                'to_lng'            => (float)$destStation['lng'],
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
                    'station_lat'     => (float)$destStation['lat'],
                    'station_lng'     => (float)$destStation['lng'],
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
            return $this->singleSegment('foot', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $originStation  = $this->nearestPoint($metroStations, $fromLat, $fromLng);
        $destCandidates = array_values(array_filter($metroStations, fn($s) => $s['station_id'] !== ($originStation['station_id'] ?? null)));
        $destStation    = $this->nearestPoint($destCandidates ?: $metroStations, $toLat, $toLng);

        if (!$originStation || !$destStation) {
            return $this->singleSegment('foot', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        // BFS route through metro graph
        $router = new MetroRouter();
        $legs   = $router->route($originStation, $destStation);

        // Fallback: single straight leg if graph gives no path
        if (!$legs) {
            $legs = [[
                'line'         => ($originStation['lines'][0]['name'] ?? 'M'),
                'from_station' => $originStation,
                'to_station'   => $destStation,
            ]];
        }

        $firstFrom = $legs[0]['from_station'];
        $lastTo    = $legs[count($legs) - 1]['to_station'];
        $oLng = (float)$firstFrom['lng']; $oLat = (float)$firstFrom['lat'];
        $dLng = (float)$lastTo['lng'];    $dLat = (float)$lastTo['lat'];

        $responses = Http::pool(fn($pool) => [
            $pool->as('walk1')->timeout(12)->get(self::OSRM_BASE . "/foot/{$fromLng},{$fromLat};{$oLng},{$oLat}", ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('walk2')->timeout(12)->get(self::OSRM_BASE . "/foot/{$dLng},{$dLat};{$toLng},{$toLat}",   ['overview' => 'full', 'geometries' => 'geojson']),
        ]);

        $walk1 = $this->parseOsrm($responses['walk1'], 'walk');
        $walk2 = $this->parseOsrm($responses['walk2'], 'walk');

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
                    'station_lat'  => (float)$firstFrom['lat'],
                    'station_lng'  => (float)$firstFrom['lng'],
                ],
            ];
        }

        foreach ($legs as $leg) {
            $lineName  = $leg['line'];
            $from      = $leg['from_station'];
            $to        = $leg['to_station'];
            $geometry  = $router->legGeometry($lineName, $from, $to);
            $color     = $router->lineColor($lineName);
            $dist      = $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
            $dur       = ($dist / 25000) * 3600 + 120;
            // Transfer time (2 min) added for every leg after the first
            $isFirst   = ($leg === $legs[0]);

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
                    'from_lat'        => (float)$from['lat'],
                    'from_lng'        => (float)$from['lng'],
                    'to_station_id'   => $to['station_id'],
                    'to_station'      => $to['station_name'],
                    'to_lat'          => (float)$to['lat'],
                    'to_lng'          => (float)$to['lng'],
                    'lines'           => [$lineName],
                    'line_colors'     => [$lineName => $color],
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

        return [
            'segments' => $segments,
            'distance' => array_sum(array_column($segments, 'distance')),
            'duration' => array_sum(array_column($segments, 'duration')),
            'mode'     => 'transit',
        ];
    }

    private function osrmRoute(string $profile, float $fromLat, float $fromLng, float $toLat, float $toLng, string $type = 'walk'): ?array
    {
        try {
            $r = Http::timeout(12)->get(
                self::OSRM_BASE . "/{$profile}/{$fromLng},{$fromLat};{$toLng},{$toLat}",
                ['overview' => 'full', 'geometries' => 'geojson']
            );
            return $this->parseOsrm($r, $type);
        } catch (\Throwable) { return null; }
    }

    private function parseOsrm(mixed $response, string $type = 'walk'): ?array
    {
        try {
            if (!$response || !$response->successful()) return null;
            $data = $response->json();
            if (($data['code'] ?? '') !== 'Ok' || empty($data['routes'])) return null;
            $r    = $data['routes'][0];
            $dist = (float) $r['distance'];
            // The public OSRM demo server returns the same (wrong) duration for all profiles.
            // We override it with a realistic estimate based on road distance.
            $dur  = $this->realisticDuration($dist, $type);
            return ['geometry' => $r['geometry'], 'distance' => $dist, 'duration' => $dur];
        } catch (\Throwable) { return null; }
    }

    private function realisticDuration(float $distM, string $type): float
    {
        $kmh = self::SPEEDS_KMH[$type] ?? 4.8;
        return ($distM / ($kmh / 3.6)); // seconds = meters / (m/s)
    }

    /** Compute current traffic congestion % (0-100) from cached live data. */
    private function currentCongestion(): int
    {
        $data = Cache::get('traffic_current', []);
        if (empty($data)) return 30; // default mid-level when no data
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
        $R = 6371000;
        $φ1 = deg2rad($lat1); $φ2 = deg2rad($lat2);
        $Δφ = deg2rad($lat2 - $lat1); $Δλ = deg2rad($lng2 - $lng1);
        $a  = sin($Δφ/2)**2 + cos($φ1) * cos($φ2) * sin($Δλ/2)**2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
