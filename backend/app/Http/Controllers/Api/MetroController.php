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
        $estacioId = (int) $stationId - 6660000;
        $trains    = $this->service->getArrivalsForStation($estacioId);
        return response()->json(['station_id' => $stationId, 'trains' => $trains]);
    }

    public function fetch(): JsonResponse
    {
        $stations = $this->service->fetch();
        $lines    = $this->service->fetchLines();
        return response()->json(['stations' => count($stations), 'lines' => count($lines)]);
    }
}
