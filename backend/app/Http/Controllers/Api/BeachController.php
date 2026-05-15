<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BeachService;
use Illuminate\Http\JsonResponse;

class BeachController extends Controller
{
    public function __construct(private BeachService $service) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->service->all()]);
    }
}
