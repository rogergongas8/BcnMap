<?php
declare(strict_types=1);
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Services\RouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouteController extends Controller
{
    public function __construct(private readonly RouteService $routeService) {}

    public function calculate(Request $request): JsonResponse
    {
        $request->validate([
            'from_lat' => 'required|numeric|between:-90,90',
            'from_lng' => 'required|numeric|between:-180,180',
            'to_lat'   => 'required|numeric|between:-90,90',
            'to_lng'   => 'required|numeric|between:-180,180',
            'mode'     => 'required|in:car,foot,bike,bicing,bus',
        ]);

        $result = $this->routeService->calculate(
            (float) $request->input('from_lat'),
            (float) $request->input('from_lng'),
            (float) $request->input('to_lat'),
            (float) $request->input('to_lng'),
            $request->input('mode'),
        );

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], 404);
        }

        return response()->json($result);
    }

    public function plan(Request $request): JsonResponse
    {
        $request->validate([
            'from_lat'   => 'required|numeric|between:-90,90',
            'from_lng'   => 'required|numeric|between:-180,180',
            'to_lat'     => 'required|numeric|between:-90,90',
            'to_lng'     => 'required|numeric|between:-180,180',
            'constraint' => 'nullable|string|max:200',
        ]);

        $result = $this->routeService->planMultimodal(
            (float) $request->input('from_lat'),
            (float) $request->input('from_lng'),
            (float) $request->input('to_lat'),
            (float) $request->input('to_lng'),
            $request->input('constraint'),
        );

        return response()->json($result);
    }
}
