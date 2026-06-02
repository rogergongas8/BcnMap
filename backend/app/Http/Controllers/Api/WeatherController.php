<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
    public function __construct(private WeatherService $service) {}

    public function current(Request $request): JsonResponse
    {
        $lang = $request->query('lang', 'es');
        $data = $this->service->getCurrent($lang);
        return response()->json($data ?? (object) []);
    }

    public function forecast(Request $request): JsonResponse
    {
        $lang = $request->query('lang', 'es');
        $data = $this->service->getForecast($lang);
        return response()->json($data ?? []);
    }
}
