<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FoursquareService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaceEnrichController extends Controller
{
    public function __construct(private FoursquareService $foursquare) {}

    public function enrich(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:200',
            'lat'  => 'required|numeric|between:-90,90',
            'lng'  => 'required|numeric|between:-180,180',
        ]);

        $data = $this->foursquare->findPlace(
            (string) $request->query('name'),
            (float)  $request->query('lat'),
            (float)  $request->query('lng'),
        );

        if (!$data) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => $data]);
    }
}
