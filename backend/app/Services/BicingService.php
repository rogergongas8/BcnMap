<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\BicingSnapshot;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BicingService
{
    // Bicing Barcelona GBFS v1 — endpoint público
    private const GBFS_BASE   = 'https://barcelona.publicbikesystem.net/ube/gbfs/v1/en/station_information.json';
    private const GBFS_STATUS = 'https://barcelona.publicbikesystem.net/ube/gbfs/v1/en/station_status.json';
    private const CACHE_KEY    = 'bicing_current';
    private const CACHE_TTL    = 150;

    public function fetch(): array
    {
        try {
            $infoRes   = Http::timeout(15)->withoutVerifying()->get(self::GBFS_BASE);
            $statusRes = Http::timeout(15)->withoutVerifying()->get(self::GBFS_STATUS);

            if (!$infoRes->successful() || !$statusRes->successful()) {
                Log::warning('BicingService: API error', [
                    'info_status'   => $infoRes->status(),
                    'status_status' => $statusRes->status(),
                ]);
                return [];
            }

            $info   = collect($infoRes->json('data.stations', []))->keyBy('station_id');
            $status = $statusRes->json('data.stations', []);

            if (empty($status)) {
                Log::warning('BicingService: empty stations response');
                return [];
            }

            $normalized = collect($status)->map(function ($s) use ($info) {
                $i = $info->get($s['station_id']);
                if (!$i) return null;

                return [
                    'station_id'       => (int) $s['station_id'],
                    'station_name'     => $i['name'] ?? '',
                    'lat'              => (float) ($i['lat'] ?? 0),
                    'lng'              => (float) ($i['lon'] ?? 0),
                    'bikes_available'  => (int) ($s['num_bikes_available'] ?? 0),
                    'ebikes_available' => (int) ($s['num_bikes_available_types']['ebike'] ?? $s['num_ebikes_available'] ?? 0),
                    'docks_available'  => (int) ($s['num_docks_available'] ?? 0),
                    'status'           => ($s['status'] ?? $s['is_renting'] ?? 'IN_SERVICE') === 'IN_SERVICE' ? 'active' : 'closed',
                ];
            })->filter()->values()->all();

            Cache::put(self::CACHE_KEY, $normalized, self::CACHE_TTL);
            return $normalized;
        } catch (\Throwable $e) {
            Log::error('BicingService: ' . $e->getMessage());
            return [];
        }
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    public function getCurrentSummary(): object
    {
        $data = collect($this->getCurrent());

        if ($data->isEmpty()) {
            return (object) ['available_bikes' => 0, 'active_stations' => 0, 'empty_zones' => 'sin datos'];
        }

        $active = $data->where('status', 'active');
        $empty  = $active->where('bikes_available', 0)->pluck('station_name')->take(3)->implode(', ');

        return (object) [
            'available_bikes' => $active->sum('bikes_available'),
            'active_stations' => $active->count(),
            'empty_zones'     => $empty ?: 'ninguna',
        ];
    }
}
