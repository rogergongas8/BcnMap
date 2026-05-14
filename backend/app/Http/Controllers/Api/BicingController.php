<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BicingSnapshot;
use App\Services\BicingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BicingController extends Controller
{
    public function __construct(private BicingService $service) {}

    public function current(): JsonResponse
    {
        return response()->json($this->service->getCurrent());
    }

    public function history(Request $request): JsonResponse
    {
        $hours = min((int) $request->get('hours', 6), 48);

        $data = BicingSnapshot::where('snapshot_at', '>=', now()->subHours($hours))
            ->orderBy('snapshot_at')
            ->get();

        return response()->json($data);
    }
}
