<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    private const API_URL  = 'https://api.openweathermap.org/data/2.5/weather';
    private const CACHE_KEY = 'weather_current';
    private const CACHE_TTL = 600; // 10 min (clima cambia poco)

    public function fetch(): ?array
    {
        try {
            $response = Http::timeout(10)->get(self::API_URL, [
                'q'     => 'Barcelona,es',
                'appid' => config('services.openweather.key'),
                'units' => 'metric',
                'lang'  => 'es',
            ]);

            if (!$response->successful()) {
                Log::warning('WeatherService: API error', ['status' => $response->status()]);
                return null;
            }

            $data = $response->json();
            $normalized = [
                'temp'        => round($response->json('main.temp'), 1),
                'feels_like'  => round($response->json('main.feels_like'), 1),
                'humidity'    => $response->json('main.humidity'),
                'description' => $data['weather'][0]['description'] ?? '',
                'icon'        => $data['weather'][0]['icon'] ?? '',
                'wind_speed'  => $response->json('wind.speed'),
            ];

            Cache::put(self::CACHE_KEY, $normalized, self::CACHE_TTL);
            return $normalized;
        } catch (\Throwable $e) {
            Log::error('WeatherService: ' . $e->getMessage());
            return null;
        }
    }

    public function getCurrent(): ?array
    {
        return Cache::get(self::CACHE_KEY);
    }
}
