<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HistorySnapshotService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoryController extends Controller
{
    public function __construct(private HistorySnapshotService $service) {}

    public function timeline(Request $request): JsonResponse
    {
        $hours = (int) $request->get('hours', 24);
        $step  = (int) $request->get('step', 5);

        return response()->json([
            'hours'  => $hours,
            'step'   => $step,
            'points' => $this->service->timeline($hours, $step),
        ]);
    }

    public function snapshot(Request $request): JsonResponse
    {
        $at = $request->get('at');
        if (!is_string($at) || $at === '') {
            return response()->json(['error' => 'Missing or invalid "at" parameter (ISO-8601 expected)'], 422);
        }

        try {
            $timestamp = Carbon::parse($at);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Could not parse "at": ' . $e->getMessage()], 422);
        }

        return response()->json($this->service->snapshotAt($timestamp));
    }

    public function range(): JsonResponse
    {
        return response()->json($this->service->availableRange());
    }
}
