<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->hasMany(Favorite::class)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:200',
            'lat'      => 'required|numeric',
            'lng'      => 'required|numeric',
            'address'  => 'nullable|string|max:300',
            'category' => 'nullable|string|max:100',
        ]);

        $favorite = Favorite::create([...$data, 'user_id' => $request->user()->id]);

        return response()->json($favorite, 201);
    }

    public function destroy(Request $request, Favorite $favorite): JsonResponse
    {
        abort_if($favorite->user_id !== $request->user()->id, 403);
        $favorite->delete();
        return response()->json(['ok' => true]);
    }
}
