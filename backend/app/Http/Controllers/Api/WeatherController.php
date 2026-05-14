<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;

class WeatherController extends Controller
{
    public function __construct(private WeatherService $service) {}

    public function current(): JsonResponse
    {
        $data = $this->service->getCurrent();
        return response()->json($data ?? (object) []);
    }
}
