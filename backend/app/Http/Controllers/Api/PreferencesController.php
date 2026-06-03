<?php
declare(strict_types=1);
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PreferencesController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json($request->user()->getPreferences());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'has_bicing'        => 'boolean',
            'preferred_modes'   => 'array',
            'preferred_modes.*' => 'string|in:foot,bicing,metro,bus,car',
            'avoid_modes'       => 'array',
            'avoid_modes.*'     => 'string|in:foot,bicing,metro,bus,car',
            'max_walk_minutes'  => 'integer|min:5|max:60',
        ]);

        $user    = $request->user();
        $current = $user->preferences ?? [];
        $user->update(['preferences' => array_merge($current, $data)]);

        return response()->json($user->getPreferences());
    }
}
