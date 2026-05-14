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

    public function calculate(float $fromLat, float $fromLng, float $toLat, float $toLng, string $mode): array
    {
        return match ($mode) {
            'foot'   => $this->singleSegment('foot',    $fromLat, $fromLng, $toLat, $toLng, 'walk'),
            'car'    => $this->singleSegment('driving', $fromLat, $fromLng, $toLat, $toLng, 'drive'),
            'bike'   => $this->singleSegment('bike',    $fromLat, $fromLng, $toLat, $toLng, 'bike'),
            'bicing' => $this->bicingRoute($fromLat, $fromLng, $toLat, $toLng),
            'bus'    => $this->transitRoute($fromLat, $fromLng, $toLat, $toLng),
            default  => ['error' => 'Modo de transporte no soportado'],
        };
    }

    private function singleSegment(string $profile, float $fromLat, float $fromLng, float $toLat, float $toLng, string $type): array
    {
        $seg = $this->osrmRoute($profile, $fromLat, $fromLng, $toLat, $toLng);
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
            $pool->as('walk1')->timeout(8)->get(self::OSRM_BASE . "/foot/{$fromLng},{$fromLat};{$oLng},{$oLat}", ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('bike') ->timeout(8)->get(self::OSRM_BASE . "/bike/{$oLng},{$oLat};{$dLng},{$dLat}",       ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('walk2')->timeout(8)->get(self::OSRM_BASE . "/foot/{$dLng},{$dLat};{$toLng},{$toLat}",   ['overview' => 'full', 'geometries' => 'geojson']),
        ]);

        $walk1 = $this->parseOsrm($responses['walk1']);
        $bike  = $this->parseOsrm($responses['bike']);
        $walk2 = $this->parseOsrm($responses['walk2']);

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
                    'station_name'     => $originStation['station_name'],
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
                'from_station'    => $originStation['station_name'],
                'to_station'      => $destStation['station_name'],
                'bikes_available' => $originStation['bikes_available'],
                'docks_available' => $destStation['docks_available'],
            ],
        ];

        if ($walk2 && $walk2['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk2['geometry'],
                'distance' => $walk2['distance'], 'duration' => $walk2['duration'],
                'color' => self::COLORS['walk'], 'label' => 'Caminar al destino',
                'meta' => ['station_name' => $destStation['station_name'], 'docks_available' => $destStation['docks_available']],
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

        $originStation = $this->nearestPoint($metroStations, $fromLat, $fromLng);
        $destStation   = $this->nearestPoint($metroStations, $toLat, $toLng);

        if (!$originStation || !$destStation || $originStation['station_id'] === $destStation['station_id']) {
            return $this->singleSegment('foot', $fromLat, $fromLng, $toLat, $toLng, 'walk');
        }

        $oLng = $originStation['lng']; $oLat = $originStation['lat'];
        $dLng = $destStation['lng'];   $dLat = $destStation['lat'];

        $responses = Http::pool(fn($pool) => [
            $pool->as('walk1')->timeout(8)->get(self::OSRM_BASE . "/foot/{$fromLng},{$fromLat};{$oLng},{$oLat}", ['overview' => 'full', 'geometries' => 'geojson']),
            $pool->as('walk2')->timeout(8)->get(self::OSRM_BASE . "/foot/{$dLng},{$dLat};{$toLng},{$toLat}",   ['overview' => 'full', 'geometries' => 'geojson']),
        ]);

        $walk1 = $this->parseOsrm($responses['walk1']);
        $walk2 = $this->parseOsrm($responses['walk2']);

        $transitDist = $this->haversine((float)$oLat, (float)$oLng, (float)$dLat, (float)$dLng);
        $transitTime = ($transitDist / 25000) * 3600 + 120;
        $lineNames   = array_column($originStation['lines'] ?? [], 'name');

        $segments = [];

        if ($walk1 && $walk1['distance'] > 20) {
            $segments[] = [
                'type' => 'walk', 'geometry' => $walk1['geometry'],
                'distance' => $walk1['distance'], 'duration' => $walk1['duration'],
                'color' => self::COLORS['walk'], 'label' => 'Caminar a ' . ($originStation['station_name'] ?? 'estación'),
            ];
        }

        $segments[] = [
            'type' => 'metro',
            'geometry' => ['type' => 'LineString', 'coordinates' => [[(float)$oLng, (float)$oLat], [(float)$dLng, (float)$dLat]]],
            'distance' => $transitDist, 'duration' => $transitTime,
            'color' => self::COLORS['metro'],
            'label' => 'Metro' . (count($lineNames) ? ' ' . implode('/', $lineNames) : ''),
            'meta'  => ['from_station' => $originStation['station_name'], 'to_station' => $destStation['station_name'], 'lines' => $lineNames],
        ];

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

    private function osrmRoute(string $profile, float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        try {
            $r = Http::timeout(8)->get(
                self::OSRM_BASE . "/{$profile}/{$fromLng},{$fromLat};{$toLng},{$toLat}",
                ['overview' => 'full', 'geometries' => 'geojson']
            );
            return $this->parseOsrm($r);
        } catch (\Throwable) { return null; }
    }

    private function parseOsrm(mixed $response): ?array
    {
        try {
            if (!$response || !$response->successful()) return null;
            $data = $response->json();
            if (($data['code'] ?? '') !== 'Ok' || empty($data['routes'])) return null;
            $r = $data['routes'][0];
            return ['geometry' => $r['geometry'], 'distance' => $r['distance'], 'duration' => $r['duration']];
        } catch (\Throwable) { return null; }
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
