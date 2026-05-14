<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusService;
use Illuminate\Http\JsonResponse;

class BusController extends Controller
{
    public function __construct(private BusService $service) {}

    public function current(): JsonResponse
    {
        return response()->json($this->service->getCurrent());
    }

    public function fetch(): JsonResponse
    {
        $data = $this->service->fetch();
        return response()->json($data);
    }

    public function arrivals(string $stopId): JsonResponse
    {
        $buses = $this->service->getArrivalsForStop($stopId);
        return response()->json(['stop_id' => $stopId, 'buses' => $buses]);
    }
}
