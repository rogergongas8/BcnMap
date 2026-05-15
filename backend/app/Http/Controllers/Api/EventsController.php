<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\EventsEnrichmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventsController extends Controller
{
    public function __construct(private EventsEnrichmentService $events)
    {
    }

    public function current(): JsonResponse
    {
        return response()->json($this->events->current());
    }

    public function today(): JsonResponse
    {
        return response()->json($this->events->today());
    }

    public function nearby(Request $request): JsonResponse
    {
        $lat = (float) $request->query('lat', '41.3870');
        $lng = (float) $request->query('lng', '2.1701');
        $radius = (float) $request->query('radius', '2');

        return response()->json($this->events->nearby($lat, $lng, $radius));
    }
}
