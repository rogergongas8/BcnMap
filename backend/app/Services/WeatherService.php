<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    private const API_URL      = 'https://api.openweathermap.org/data/2.5/weather';
    private const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
    private const CACHE_TTL    = 600;
    private const FORECAST_TTL = 1800;

    public function fetch(string $lang = 'es'): ?array
    {
        try {
            $response = Http::timeout(10)->get(self::API_URL, [
                'q'     => 'Barcelona,es',
                'appid' => config('services.openweather.key'),
                'units' => 'metric',
                'lang'  => $lang,
            ]);

            if (!$response->successful()) {
                Log::warning('WeatherService: API error', ['status' => $response->status()]);
                return null;
            }

            $data       = $response->json();
            $normalized = [
                'temp'        => round($data['main']['temp'], 1),
                'feels_like'  => round($data['main']['feels_like'], 1),
                'temp_min'    => round($data['main']['temp_min'], 1),
                'temp_max'    => round($data['main']['temp_max'], 1),
                'humidity'    => $data['main']['humidity'],
                'description' => $data['weather'][0]['description'] ?? '',
                'icon'        => $data['weather'][0]['icon'] ?? '',
                'wind_speed'  => $data['wind']['speed'] ?? null,
            ];

            Cache::put('weather_current_' . $lang, $normalized, self::CACHE_TTL);
            return $normalized;
        } catch (\Throwable $e) {
            Log::error('WeatherService: ' . $e->getMessage());
            return null;
        }
    }

    public function getCurrent(string $lang = 'es'): ?array
    {
        return Cache::get('weather_current_' . $lang) ?? $this->fetch($lang);
    }

    public function fetchForecast(string $lang = 'es'): ?array
    {
        try {
            $response = Http::timeout(10)->get(self::FORECAST_URL, [
                'q'     => 'Barcelona,es',
                'appid' => config('services.openweather.key'),
                'units' => 'metric',
                'lang'  => $lang,
                'cnt'   => 8,
            ]);

            if (!$response->successful()) {
                Log::warning('WeatherService: Forecast API error', ['status' => $response->status()]);
                return null;
            }

            $list = collect($response->json('list', []))->map(fn($item) => [
                'dt'          => $item['dt'],
                'time'        => substr($item['dt_txt'], 11, 5),
                'temp'        => (int) round($item['main']['temp']),
                'description' => $item['weather'][0]['description'] ?? '',
                'icon'        => $item['weather'][0]['icon'] ?? '',
            ])->values()->all();

            Cache::put('weather_forecast_' . $lang, $list, self::FORECAST_TTL);
            return $list;
        } catch (\Throwable $e) {
            Log::error('WeatherService forecast: ' . $e->getMessage());
            return null;
        }
    }

    public function getForecast(string $lang = 'es'): ?array
    {
        return Cache::get('weather_forecast_' . $lang) ?? $this->fetchForecast($lang);
    }
}
