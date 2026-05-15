<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PoiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PoiController extends Controller
{
    public function __construct(private PoiService $service) {}

    public function nearby(Request $request): JsonResponse
    {
        $request->validate([
            'lat'        => 'required|numeric|between:-90,90',
            'lng'        => 'required|numeric|between:-180,180',
            'radius'     => 'nullable|integer|between:100,5000',
            'categories' => 'nullable|string',
        ]);

        $categories = $this->parseCategories($request->query('categories'));
        if (empty($categories)) {
            $categories = PoiService::categories();
        }

        $data = $this->service->nearby(
            (float) $request->query('lat'),
            (float) $request->query('lng'),
            (int)   ($request->query('radius') ?? 500),
            $categories,
        );

        return response()->json(['data' => $data]);
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q'   => 'required|string|min:2|max:100',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
        ]);

        $lat = $request->query('lat') !== null ? (float) $request->query('lat') : null;
        $lng = $request->query('lng') !== null ? (float) $request->query('lng') : null;

        $data = $this->service->searchByName((string) $request->query('q'), $lat, $lng);
        return response()->json(['data' => $data]);
    }

    public function categories(): JsonResponse
    {
        return response()->json(['data' => PoiService::categories()]);
    }

    private function parseCategories(?string $raw): array
    {
        if ($raw === null || $raw === '') return [];
        return array_values(array_filter(array_map('trim', explode(',', $raw))));
    }
}
