<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\TrafficSnapshot;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TrafficService
{
    // Coordenades dels trams — fitxer estàtic, no canvia
    private const COORDS_URL = 'https://opendata-ajuntament.barcelona.cat/data/dataset/transit-relacio-trams/resource/1d6c814c-70ef-4147-aa16-a49ddb952f72/download/transit_relacio_trams.csv';

    // Snapshot en temps real — s'actualitza cada pocs minuts, 12KB
    private const DAT_URL = 'https://opendata-ajuntament.barcelona.cat/data/dataset/transit-trams/resource/2d456eb5-4ea6-4f68-9794-2f3f1a58a933/download/TRAMS_TRAMS.dat';

    private const CACHE_KEY        = 'traffic_current';
    private const CACHE_KEY_COORDS = 'traffic_coords';
    private const CACHE_TTL        = 150;
    private const CACHE_TTL_COORDS = 86400;

    public function fetch(): array
    {
        try {
            $coords = $this->fetchCoords();
            if (empty($coords)) {
                Log::warning('TrafficService: no coords loaded');
                return [];
            }

            $response = Http::timeout(15)->withoutVerifying()->get(self::DAT_URL);
            if (!$response->successful()) {
                Log::warning('TrafficService: DAT fetch failed', ['status' => $response->status()]);
                return [];
            }

            $normalized = $this->parseDat($response->body(), $coords);
            Cache::put(self::CACHE_KEY, $normalized, self::CACHE_TTL);
            return $normalized;
        } catch (\Throwable $e) {
            Log::error('TrafficService: ' . $e->getMessage());
            return [];
        }
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    public function getCurrentSummary(): object
    {
        $data  = collect($this->getCurrent());
        $total = $data->count();

        if ($total === 0) {
            return (object) ['congestion_level' => 0, 'closed_zones' => 'sin datos', 'worst_zones' => 'sin datos'];
        }

        $congested = $data->filter(fn($t) => in_array($t['estado'], ['congestionado', 'cortado']))->count();

        return (object) [
            'congestion_level' => (int) round(($congested / $total) * 100),
            'closed_zones'     => $data->filter(fn($t) => $t['estado'] === 'cortado')->pluck('tramo_name')->take(3)->implode(', ') ?: 'ninguna',
            'worst_zones'      => $data->filter(fn($t) => $t['estado'] === 'congestionado')->pluck('tramo_name')->take(3)->implode(', ') ?: 'ninguna',
        ];
    }

    private function fetchCoords(): array
    {
        return Cache::remember(self::CACHE_KEY_COORDS, self::CACHE_TTL_COORDS, function () {
            $response = Http::timeout(15)->withoutVerifying()->get(self::COORDS_URL);
            if (!$response->successful()) return [];

            $coords = [];
            $lines  = explode("\n", trim($response->body()));
            array_shift($lines); // cabecera

            foreach ($lines as $line) {
                if (empty(trim($line))) continue;
                // Format: "Tram","Descripció","Coordenades"
                // Coordenades: "lng1,lat1,lng2,lat2"
                preg_match('/^"?(\d+)"?,"([^"]*)"?,"?([^"]*)"?$/', $line, $m);
                if (!$m) {
                    // Try CSV parsing more robustly
                    $parts = str_getcsv($line);
                    if (count($parts) >= 3) {
                        $tramId = (int) $parts[0];
                        $desc   = $parts[1];
                        $coordStr = $parts[2];
                        $c = array_map('trim', explode(',', $coordStr));
                        if (count($c) >= 4) {
                            $coords[$tramId] = [
                                'name'      => $desc,
                                'lng_start' => (float) $c[0],
                                'lat_start' => (float) $c[1],
                                'lng_end'   => (float) $c[2],
                                'lat_end'   => (float) $c[3],
                            ];
                        }
                    }
                } else {
                    $c = array_map('trim', explode(',', $m[3]));
                    if (count($c) >= 4) {
                        $coords[(int)$m[1]] = [
                            'name'      => $m[2],
                            'lng_start' => (float) $c[0],
                            'lat_start' => (float) $c[1],
                            'lng_end'   => (float) $c[2],
                            'lat_end'   => (float) $c[3],
                        ];
                    }
                }
            }

            return $coords;
        });
    }

    private function parseDat(string $dat, array $coords): array
    {
        // Format: idTram#timestamp#estatActual#estatPrevist (un registro por tram, ya es el actual)
        $lines  = explode("\n", trim($dat));
        $result = [];

        foreach ($lines as $line) {
            if (empty(trim($line))) continue;
            $parts = explode('#', $line);
            if (count($parts) < 3) continue;

            $tramId = (int) $parts[0];
            $estat  = (int) $parts[2];
            $c      = $coords[$tramId] ?? null;

            if (!$c || $estat === -1) continue;

            $result[] = [
                'tramo_id'        => (string) $tramId,
                'tramo_name'      => $c['name'],
                'lat_start'       => $c['lat_start'],
                'lng_start'       => $c['lng_start'],
                'lat_end'         => $c['lat_end'],
                'lng_end'         => $c['lng_end'],
                'estado'          => $this->mapEstat($estat),
                'velocidad_media' => 0,
            ];
        }

        return $result;
    }

    private function mapEstat(int $estat): string
    {
        return match ($estat) {
            0, 1, 2 => 'fluido',
            3       => 'lento',
            4       => 'congestionado',
            5       => 'cortado',
            default => 'fluido',
        };
    }
}
