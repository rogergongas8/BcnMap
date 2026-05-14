<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AirQualityService
{
    private const API_URL   = 'https://api.waqi.info/feed/barcelona/';
    private const CACHE_KEY = 'airquality_current';
    private const CACHE_TTL = 600;

    public function fetch(): ?array
    {
        try {
            $response = Http::timeout(10)->get(self::API_URL, [
                'token' => config('services.aqicn.key'),
            ]);

            if (!$response->successful() || $response->json('status') !== 'ok') {
                Log::warning('AirQualityService: API error');
                return null;
            }

            $aqi = (int) $response->json('data.aqi');
            $normalized = [
                'aqi'   => $aqi,
                'level' => $this->aqiLevel($aqi),
                'pm25'  => $response->json('data.iaqi.pm25.v'),
                'pm10'  => $response->json('data.iaqi.pm10.v'),
                'no2'   => $response->json('data.iaqi.no2.v'),
            ];

            Cache::put(self::CACHE_KEY, $normalized, self::CACHE_TTL);
            return $normalized;
        } catch (\Throwable $e) {
            Log::error('AirQualityService: ' . $e->getMessage());
            return null;
        }
    }

    public function getCurrent(): ?array
    {
        return Cache::get(self::CACHE_KEY);
    }

    private function aqiLevel(int $aqi): string
    {
        return match (true) {
            $aqi <= 50  => 'Buena',
            $aqi <= 100 => 'Moderada',
            $aqi <= 150 => 'Dañina para grupos sensibles',
            $aqi <= 200 => 'Dañina',
            $aqi <= 300 => 'Muy dañina',
            default     => 'Peligrosa',
        };
    }
}
