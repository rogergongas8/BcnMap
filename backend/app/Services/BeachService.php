<?php

declare(strict_types=1);

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Estado actual de las playas de Barcelona.
 *
 * El Ajuntament no publica sensores de bandera ni de aforo en tiempo real.
 * Por honestidad, derivamos la bandera del oleaje/viento del WeatherService
 * y estimamos la ocupación a partir de hora, día, temperatura y meteo.
 * Marcamos siempre `occupancy_estimated: true` para no engañar al usuario.
 */
class BeachService
{
    private const CACHE_KEY = 'beaches:current';
    private const CACHE_TTL = 600; // 10 min — clima cambia

    /**
     * Catálogo estático de playas. Coordenadas verificadas contra OSM
     * (natural=beach) y datos abiertos del Ajuntament.
     *
     * @var list<array{
     *   id: string, name: string, lat: float, lng: float,
     *   district: string, length_m: int, popularity: float,
     *   amenities: list<string>
     * }>
     */
    private const BEACHES = [
        [
            'id' => 'sant-sebastia',  'name' => 'Sant Sebastià',   'lat' => 41.3756, 'lng' => 2.1881,
            'district' => 'Ciutat Vella', 'length_m' => 1100, 'popularity' => 0.95,
            'amenities' => ['lifeguard', 'showers', 'accessible', 'wifi'],
        ],
        [
            'id' => 'sant-miquel',    'name' => 'Sant Miquel',     'lat' => 41.3781, 'lng' => 2.1922,
            'district' => 'Ciutat Vella', 'length_m' => 400,  'popularity' => 0.90,
            'amenities' => ['lifeguard', 'showers', 'accessible'],
        ],
        [
            'id' => 'barceloneta',    'name' => 'Barceloneta',     'lat' => 41.3795, 'lng' => 2.1962,
            'district' => 'Ciutat Vella', 'length_m' => 422,  'popularity' => 1.00,
            'amenities' => ['lifeguard', 'showers', 'accessible', 'wifi'],
        ],
        [
            'id' => 'somorrostro',    'name' => 'Somorrostro',     'lat' => 41.3837, 'lng' => 2.2017,
            'district' => 'Ciutat Vella', 'length_m' => 522,  'popularity' => 0.85,
            'amenities' => ['lifeguard', 'showers'],
        ],
        [
            'id' => 'nova-icaria',    'name' => 'Nova Icària',     'lat' => 41.3893, 'lng' => 2.2065,
            'district' => 'Sant Martí',  'length_m' => 415,  'popularity' => 0.80,
            'amenities' => ['lifeguard', 'showers', 'accessible'],
        ],
        [
            'id' => 'bogatell',       'name' => 'Bogatell',        'lat' => 41.3937, 'lng' => 2.2110,
            'district' => 'Sant Martí',  'length_m' => 640,  'popularity' => 0.85,
            'amenities' => ['lifeguard', 'showers', 'accessible', 'wifi'],
        ],
        [
            'id' => 'mar-bella',      'name' => 'Mar Bella',       'lat' => 41.3985, 'lng' => 2.2178,
            'district' => 'Sant Martí',  'length_m' => 512,  'popularity' => 0.75,
            'amenities' => ['lifeguard', 'showers', 'accessible'],
        ],
        [
            'id' => 'nova-mar-bella', 'name' => 'Nova Mar Bella',  'lat' => 41.4030, 'lng' => 2.2238,
            'district' => 'Sant Martí',  'length_m' => 420,  'popularity' => 0.70,
            'amenities' => ['lifeguard', 'showers'],
        ],
        [
            'id' => 'llevant',        'name' => 'Llevant',         'lat' => 41.4076, 'lng' => 2.2296,
            'district' => 'Sant Martí',  'length_m' => 380,  'popularity' => 0.65,
            'amenities' => ['lifeguard', 'showers', 'accessible'],
        ],
    ];

    public function __construct(private WeatherService $weather) {}

    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $weather    = $this->weather->getCurrent() ?? [];
            $isBeachDay = $this->isBeachDay($weather);
            $flag       = $this->flagFromWeather($weather);

            $result = [];
            foreach (self::BEACHES as $beach) {
                $occupancy = $this->estimateOccupancy($beach['id'], $beach, $weather);

                $result[] = [
                    'id'                  => $beach['id'],
                    'name'                => $beach['name'],
                    'lat'                 => $beach['lat'],
                    'lng'                 => $beach['lng'],
                    'district'            => $beach['district'],
                    'length_m'            => $beach['length_m'],
                    'amenities'           => $beach['amenities'],
                    'weather'             => [
                        'temp'        => $weather['temp']        ?? null,
                        'description' => $weather['description'] ?? null,
                        'icon'        => $weather['icon']        ?? null,
                        'wind_speed'  => $weather['wind_speed']  ?? null,
                    ],
                    'water_temp'          => $this->estimateWaterTemp($weather['temp'] ?? null),
                    'flag'                => $flag['flag'],
                    'flag_reason'         => $flag['reason'],
                    'occupancy_pct'       => $occupancy['pct'],
                    'occupancy_level'     => $occupancy['level'],
                    'occupancy_estimated' => true,
                    'is_beach_day'        => $isBeachDay,
                    'recommended'         => $isBeachDay && $occupancy['level'] !== 'high' && $flag['flag'] !== 'red',
                ];
            }

            return $result;
        });
    }

    /**
     * Heurística honesta — no hay sensor público para playas de BCN.
     *
     * Factores:
     *  - hora del día (campana centrada en 14h, σ≈3)
     *  - fin de semana (+30%)
     *  - cada °C >25 suma 5pp; <18 °C cap a 10%
     *  - lluvia/tormenta cap a 20%
     *  - viento >10 m/s reduce 30%
     *  - fuera del horario de baño (8h–21h) cap a 15%
     *  - popularidad relativa de la playa
     *
     * @param array{popularity: float, ...} $beach
     * @param array<string, mixed>          $weather
     * @return array{pct: int, level: string}
     */
    private function estimateOccupancy(string $beachId, array $beach, array $weather): array
    {
        try {
            $now    = Carbon::now('Europe/Madrid');
            $hour   = $now->hour + $now->minute / 60.0;
            $isWknd = $now->isWeekend();

            $hourFactor = exp(-(($hour - 14) ** 2) / (2 * 3 * 3));
            $baseline   = 60 * $hourFactor * ((float) $beach['popularity']);

            if ($isWknd) {
                $baseline *= 1.30;
            }

            $temp = $weather['temp'] ?? null;
            if ($temp !== null) {
                if ($temp > 25) {
                    $baseline += ($temp - 25) * 5;
                }
                if ($temp < 18) {
                    $baseline = min($baseline, 10);
                }
            }

            if ($this->hasRain($weather)) {
                $baseline = min($baseline, 20);
            }

            $wind = $weather['wind_speed'] ?? null;
            if ($wind !== null && $wind > 10) {
                $baseline *= 0.7;
            }

            if ($hour < 8 || $hour > 21) {
                $baseline = min($baseline, 15);
            }

            $pct = (int) round(max(0, min(100, $baseline)));

            return [
                'pct'   => $pct,
                'level' => $this->occupancyLevel($pct),
            ];
        } catch (\Throwable $e) {
            Log::warning("BeachService::estimateOccupancy[{$beachId}]: " . $e->getMessage());
            return ['pct' => 0, 'level' => 'low'];
        }
    }

    private function occupancyLevel(int $pct): string
    {
        if ($pct >= 65) return 'high';
        if ($pct >= 35) return 'medium';
        return 'low';
    }

    /**
     * @param array<string, mixed> $weather
     */
    private function isBeachDay(array $weather): bool
    {
        $temp = $weather['temp'] ?? null;
        if ($temp === null || $temp < 20) return false;
        return !$this->hasRain($weather);
    }

    /**
     * @param array<string, mixed> $weather
     */
    private function hasRain(array $weather): bool
    {
        $desc = strtolower((string) ($weather['description'] ?? ''));
        return str_contains($desc, 'lluvia')
            || str_contains($desc, 'tormenta')
            || str_contains($desc, 'chubasco')
            || str_contains($desc, 'rain')
            || str_contains($desc, 'storm')
            || str_contains($desc, 'drizzle');
    }

    /**
     * Bandera derivada del viento + lluvia (no es una bandera oficial).
     *
     * @param array<string, mixed> $weather
     * @return array{flag: string, reason: string}
     */
    private function flagFromWeather(array $weather): array
    {
        $windMs = $weather['wind_speed'] ?? null;
        $windKmh = $windMs !== null ? ((float) $windMs) * 3.6 : null;

        $flag   = 'green';
        $reason = 'Condicions favorables';

        if ($windKmh !== null) {
            if ($windKmh > 50) {
                $flag   = 'red';
                $reason = 'Vent fort (' . round($windKmh) . ' km/h)';
            } elseif ($windKmh > 30) {
                $flag   = 'yellow';
                $reason = 'Vent moderat (' . round($windKmh) . ' km/h)';
            }
        }

        if ($this->hasRain($weather)) {
            if ($flag === 'green') {
                $flag = 'yellow';
                $reason = 'Pluja';
            } else {
                $reason .= ' i pluja';
            }
        }

        return ['flag' => $flag, 'reason' => $reason];
    }

    /**
     * Temperatura del agua sin boya — offset estacional sobre el aire.
     */
    private function estimateWaterTemp(?float $airTemp): ?float
    {
        if ($airTemp === null) return null;

        $month   = (int) Carbon::now('Europe/Madrid')->format('n');
        $isWarm  = $month >= 6 && $month <= 9;
        $offset  = $isWarm ? 1.5 : -2.0;

        return round($airTemp + $offset, 1);
    }
}
