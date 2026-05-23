<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Events\CityDataUpdated;
use App\Models\BicingSnapshot;
use App\Models\CitySnapshot;
use App\Models\TrafficSnapshot;
use App\Services\AirQualityService;
use App\Services\BicingService;
use App\Services\BusService;
use App\Services\MetroService;
use App\Services\TrafficService;
use App\Services\WeatherService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class FetchCityData extends Command
{
    protected $signature   = 'city:fetch';
    protected $description = 'Fetch all city data from external APIs and store snapshots';

    public function __construct(
        private TrafficService    $traffic,
        private BicingService     $bicing,
        private WeatherService    $weather,
        private AirQualityService $air,
        private BusService        $bus,
        private MetroService      $metro,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $now = now();
        $this->info("Fetching city data at {$now->toTimeString()}...");

        $trafficData = $this->traffic->fetch();
        $bicingData  = $this->bicing->fetch();
        $weatherData = $this->weather->fetch();
        $airData     = $this->air->fetch();
        $busData     = $this->bus->fetch();
        $this->bus->refreshGlobalArrivals();
        $this->info('Bus: ' . count($busData) . ' parades');

        $metroData   = $this->metro->fetch();
        $metroLines  = $this->metro->fetchLines();
        $this->info('Metro: ' . count($metroData) . ' estacions, ' . count($metroLines) . ' línies');

        // Guardar snapshot de tráfico
        if (!empty($trafficData)) {
            $rows = array_map(fn($t) => array_merge($t, ['snapshot_at' => $now, 'created_at' => $now, 'updated_at' => $now]), $trafficData);
            foreach (array_chunk($rows, 500) as $chunk) {
                TrafficSnapshot::insert($chunk);
            }
            $this->info('Traffic: ' . count($trafficData) . ' tramos');
        }

        // Guardar snapshot de Bicing
        if (!empty($bicingData)) {
            $rows = array_map(fn($b) => array_merge($b, ['snapshot_at' => $now, 'created_at' => $now, 'updated_at' => $now]), $bicingData);
            foreach (array_chunk($rows, 500) as $chunk) {
                BicingSnapshot::insert($chunk);
            }
            $this->info('Bicing: ' . count($bicingData) . ' estaciones');
        }

        // Guardar city snapshot general
        $trafficSummary = $this->traffic->getCurrentSummary();
        $bicingSummary  = $this->bicing->getCurrentSummary();

        CitySnapshot::create([
            'snapshot_at'               => $now,
            'weather_temp'              => $weatherData['temp'] ?? null,
            'weather_desc'              => $weatherData['description'] ?? null,
            'weather_icon'              => $weatherData['icon'] ?? null,
            'air_quality_index'         => $airData['aqi'] ?? null,
            'air_quality_level'         => $airData['level'] ?? null,
            'traffic_congestion_global' => $trafficSummary->congestion_level,
            'bicing_availability_global'=> $bicingSummary->active_stations > 0
                ? (int) round(($bicingSummary->available_bikes / ($bicingSummary->active_stations * 20)) * 100)
                : 0,
        ]);

        // Limpiar snapshots de más de 48h
        TrafficSnapshot::where('snapshot_at', '<', now()->subHours(48))->delete();
        BicingSnapshot::where('snapshot_at', '<', now()->subHours(48))->delete();
        CitySnapshot::where('snapshot_at', '<', now()->subHours(48))->delete();

        // Señal WebSocket ligera — el frontend re-fetcha via REST
        try {
            broadcast(new CityDataUpdated(refreshedAt: $now->toISOString()));
            $this->info('Done. WebSocket event dispatched.');
        } catch (\Throwable $e) {
            Log::warning('Broadcast failed (non-fatal): ' . $e->getMessage());
            $this->warn('Broadcast skipped: ' . $e->getMessage());
        }

        return self::SUCCESS;
    }
}
