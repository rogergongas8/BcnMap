<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrafficSnapshot;
use App\Services\TrafficService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrafficController extends Controller
{
    public function __construct(private TrafficService $service) {}

    public function current(): JsonResponse
    {
        return response()->json($this->service->getCurrent());
    }

    public function history(Request $request): JsonResponse
    {
        $hours = min((int) $request->get('hours', 6), 48);
        $since = now()->subHours($hours);

        $data = TrafficSnapshot::where('snapshot_at', '>=', $since)
            ->orderBy('snapshot_at')
            ->get(['snapshot_at', 'tramo_id', 'tramo_name', 'lat_start', 'lng_start', 'lat_end', 'lng_end', 'estado', 'velocidad_media']);

        return response()->json($data);
    }
}
