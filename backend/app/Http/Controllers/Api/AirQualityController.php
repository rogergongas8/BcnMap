<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AirQualityService;
use Illuminate\Http\JsonResponse;

class AirQualityController extends Controller
{
    public function __construct(private AirQualityService $service) {}

    public function current(): JsonResponse
    {
        $data = $this->service->getCurrent();
        return response()->json($data ?? (object) []);
    }
}
