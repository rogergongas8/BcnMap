<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BusService
{
    private const BASE            = 'https://api.tmb.cat/v1';
    private const CACHE_KEY       = 'bus:stops:current';
    private const CACHE_TTL       = 300;    // 5 min
    private const CACHE_KEY_STOPS = 'bus:stops:static';
    private const CACHE_TTL_STOPS = 86400;  // 24h — paradas estáticas

    private function auth(): array
    {
        return [
            'app_id'  => config('services.tmb.app_id'),
            'app_key' => config('services.tmb.app_key'),
        ];
    }

    /**
     * Carga paradas estáticas (coordenadas) y las guarda en caché.
     * Las llegadas se obtienen on-demand por parada.
     */
    public function fetch(): array
    {
        try {
            $stops = Cache::remember(self::CACHE_KEY_STOPS, self::CACHE_TTL_STOPS, function () {
                return $this->fetchStops();
            });

            Cache::put(self::CACHE_KEY, $stops, self::CACHE_TTL);
            return $stops;

        } catch (\Throwable $e) {
            Log::error('BusService fetch error: ' . $e->getMessage());
            return [];
        }
    }

    private function fetchStops(): array
    {
        $response = Http::timeout(20)->get(self::BASE . '/transit/parades/', $this->auth());

        if (!$response->successful()) {
            Log::warning('TMB parades error: ' . $response->status());
            return [];
        }

        $features = $response->json('features') ?? [];

        return collect($features)
            ->filter(fn($f) => isset($f['geometry']['coordinates']))
            ->map(function ($f) {
                $props  = $f['properties'] ?? [];
                $coords = $f['geometry']['coordinates'];
                return [
                    'stop_id'   => (string) ($props['CODI_PARADA'] ?? $props['codi_parada'] ?? ''),
                    'stop_name' => $props['NOM_PARADA']  ?? $props['nom_parada']  ?? '',
                    'address'   => $props['DESC_PARADA'] ?? $props['ADRECA']      ?? $props['adreca'] ?? '',
                    'lng'       => (float) $coords[0],
                    'lat'       => (float) $coords[1],
                ];
            })
            ->filter(fn($s) => $s['stop_id'] !== '' && $s['lat'] !== 0.0)
            ->values()
            ->toArray();
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    /**
     * Llegadas en tiempo real para una parada concreta.
     * Endpoint real: GET /ibus/stops/{stop_id}
     * Respuesta:     { status, data: { ibus: [{line, destination, t-in-min, t-in-s, routeId}] } }
     */
    /**
     * Llegadas en tiempo real para una parada concreta.
     * Usa el endpoint global cacheado para evitar una llamada por parada.
     * El endpoint individual /ibus/stops/{id} solo devuelve 1 bus por línea igual que el global.
     */
    public function getArrivalsForStop(string $stopId): array
    {
        // Intentar obtener del caché global primero (más eficiente)
        $global = Cache::get('bus:ibus:global', []);
        if (isset($global[$stopId])) {
            return $global[$stopId];
        }

        // Fallback: llamada individual si no hay caché global
        try {
            $response = Http::timeout(8)->get(
                self::BASE . '/ibus/stops/' . $stopId,
                $this->auth()
            );

            if (!$response->successful()) return [];

            return $this->parseIbusEntries($response->json('data.ibus') ?? []);

        } catch (\Throwable $e) {
            Log::warning("TMB ibus stop {$stopId} error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Refresca el caché global de llegadas (todas las paradas activas).
     * Llamar cada 2 minutos desde el scheduler.
     */
    public function refreshGlobalArrivals(): void
    {
        try {
            $response = Http::timeout(15)->get(self::BASE . '/ibus/stops/', $this->auth());
            if (!$response->successful()) return;

            $entries = $response->json('data.ibus') ?? [];

            // Agrupar por parada
            $byStop = [];
            foreach ($entries as $entry) {
                $stopId = (string) ($entry['stop'] ?? '');
                if (!$stopId) continue;
                if (!isset($byStop[$stopId])) $byStop[$stopId] = [];
                $byStop[$stopId][] = $entry;
            }

            // Parsear cada parada
            $result = [];
            foreach ($byStop as $stopId => $stopEntries) {
                $result[$stopId] = $this->parseIbusEntries($stopEntries);
            }

            Cache::put('bus:ibus:global', $result, 60);
            Log::info('Bus global arrivals refreshed: ' . count($result) . ' parades');

        } catch (\Throwable $e) {
            Log::warning('TMB ibus global error: ' . $e->getMessage());
        }
    }

    private function parseIbusEntries(array $entries): array
    {
        // Agrupar por línea + routeId (dirección) para mostrar ambos sentidos
        $byDirection = [];
        foreach ($entries as $entry) {
            $line    = $entry['line']    ?? '';
            $routeId = $entry['routeId'] ?? $line;
            if (!$line) continue;

            $key = $line . '|' . $routeId;
            if (!isset($byDirection[$key])) {
                $byDirection[$key] = [
                    'line'     => $line,
                    'dest'     => $entry['destination'] ?? '',
                    'arrivals' => [],
                ];
            }
            $byDirection[$key]['arrivals'][] = (int) ($entry['t-in-min'] ?? 0);
        }
        $result = array_values($byDirection);
        usort($result, fn($a, $b) => ($a['arrivals'][0] ?? 999) <=> ($b['arrivals'][0] ?? 999));
        return $result;
    }
}
