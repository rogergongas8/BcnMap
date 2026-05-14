<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CityContextService;
use Illuminate\Http\JsonResponse;

class CityContextController extends Controller
{
    public function __construct(private CityContextService $service) {}

    public function index(): JsonResponse
    {
        return response()->json(['context' => $this->service->buildContext()]);
    }
}
