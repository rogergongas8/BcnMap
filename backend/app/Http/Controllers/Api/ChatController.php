<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CityContextService;
use App\Services\GroqService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(
        private GroqService        $groq,
        private CityContextService $context,
    ) {}

    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'message'              => 'required|string|max:500',
            'conversation_history' => 'nullable|array|max:20',
            'user_lat'             => 'nullable|numeric',
            'user_lng'             => 'nullable|numeric',
            'nearby_pois'          => 'nullable|array|max:12',
        ]);

        $userLat     = $request->input('user_lat') !== null ? (float) $request->input('user_lat') : null;
        $userLng     = $request->input('user_lng') !== null ? (float) $request->input('user_lng') : null;
        $nearbyPois  = $request->input('nearby_pois', []);
        $cityContext = $this->context->buildContext($userLat, $userLng, $nearbyPois);

        $result = $this->groq->chat(
            userMessage: $request->input('message'),
            cityContext:  $cityContext,
            history:      $request->input('conversation_history', []),
        );

        return response()->json($result);
    }
}
