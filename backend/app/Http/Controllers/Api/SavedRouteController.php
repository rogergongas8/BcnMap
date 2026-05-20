<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedRouteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->hasMany(SavedRoute::class)->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:200',
            'mode'          => 'required|string|in:foot,bicing,bus,car',
            'origin_label'  => 'required|string|max:300',
            'origin_lat'    => 'required|numeric',
            'origin_lng'    => 'required|numeric',
            'dest_label'    => 'required|string|max:300',
            'dest_lat'      => 'required|numeric',
            'dest_lng'      => 'required|numeric',
        ]);

        $route = SavedRoute::create([...$data, 'user_id' => $request->user()->id]);

        return response()->json($route, 201);
    }

    public function destroy(Request $request, SavedRoute $savedRoute): JsonResponse
    {
        abort_if($savedRoute->user_id !== $request->user()->id, 403);
        $savedRoute->delete();
        return response()->json(['ok' => true]);
    }
}
