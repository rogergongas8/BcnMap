<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MetroService;
use Illuminate\Http\JsonResponse;

class MetroController extends Controller
{
    public function __construct(private MetroService $service) {}

    public function current(): JsonResponse
    {
        return response()->json($this->service->getCurrent());
    }

    public function lines(): JsonResponse
    {
        return response()->json($this->service->getLines());
    }

    public function arrivals(string $stationId): JsonResponse
    {
        // Collect the per-line imetro estacioIds stored when the station was fetched.
        // Multi-line interchanges (e.g. Catalunya L1+L3) each have their own CODI_ESTACIO.
        $stations   = $this->service->getCurrent();
        $station    = collect($stations)->firstWhere('station_id', $stationId);
        $estacioIds = collect($station['lines'] ?? [])
            ->pluck('estacio_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($estacioIds)) {
            // Overpass-sourced stations (fgc_XXX, tram_XXX) have no numeric TMB id
            $numericId = (int) $stationId;
            if ($numericId > 6660000) {
                $estacioIds = [$numericId - 6660000];
            }
        }

        if (empty($estacioIds)) {
            return response()->json(['station_id' => $stationId, 'trains' => []]);
        }

        $trains = $this->service->getArrivalsForLines($estacioIds);
        return response()->json(['station_id' => $stationId, 'trains' => $trains]);
    }

    public function disruptions(): JsonResponse
    {
        return response()->json($this->service->getDisruptions());
    }

    public function fetch(): JsonResponse
    {
        $stations = $this->service->fetch();
        $lines    = $this->service->fetchLines();
        return response()->json(['stations' => count($stations), 'lines' => count($lines)]);
    }
}
