<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private const MODEL   = 'llama-3.3-70b-versatile';

    public function chat(string $userMessage, string $cityContext, array $history = []): array
    {
        $systemPrompt = <<<PROMPT
Eres el asistente de BCN Live, app de monitorización en tiempo real de Barcelona.

DATOS ACTUALES:
{$cityContext}

Responde SIEMPRE en JSON exacto con esta estructura:
{
  "reply": "respuesta concisa en español (máx 3 frases)",
  "map_actions": []
}

map_actions disponibles (incluye solo los relevantes):
- { "type": "fly_to", "lat": 41.38, "lng": 2.17, "zoom": 14 }
- { "type": "focus_layer", "layer": "bicing" }
- { "type": "highlight_zone", "zone": "eixample" }
- { "type": "reset_view" }
- { "type": "calculate_route", "origin_label": "string", "origin_lat": null_o_float, "origin_lng": null_o_float, "dest_label": "string", "dest_lat": null_o_float, "dest_lng": null_o_float, "mode": "foot|bike|car|bus" }

Reglas para calculate_route:
- Si el usuario pregunta cómo llegar a algún lugar, incluye SIEMPRE calculate_route.
- Para origen: usa la POSICIÓN USUARIO del contexto si está disponible, si no pon null en origin_lat/origin_lng.
- Para destinos conocidos de Barcelona usa coordenadas exactas: Sagrada Família(41.4036,2.1744), Parc Güell(41.4145,2.1527), Camp Nou(41.3809,2.1228), Barceloneta(41.3793,2.1892), Born(41.3854,2.1834), Gràcia(41.4036,2.1564), Tibidabo(41.4218,2.1189), Montjuïc(41.3637,2.1588), Arc de Triomf(41.3912,2.1804).
- Elige el modo: si llueve evita bike, si mencionan metro/tren usa bus, si es lejos sugiere bus o car.
- Si el usuario menciona "a pie" o "caminando" usa foot. Si menciona "bici" usa bike.

Reglas generales: usa solo datos reales, no inventes, responde en español, respuesta máx 3 frases.
PROMPT;

        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        foreach ($history as $msg) {
            if (in_array($msg['role'] ?? '', ['user', 'assistant'], true)) {
                $messages[] = ['role' => $msg['role'], 'content' => $msg['content']];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        try {
            $response = Http::withToken(config('services.groq.key'))
                ->timeout(20)
                ->post(self::API_URL, [
                    'model'       => self::MODEL,
                    'messages'    => $messages,
                    'temperature' => 0.7,
                    'max_tokens'  => 768,
                ]);

            if (!$response->successful()) {
                Log::error('Groq API error: ' . $response->status() . ' ' . $response->body());
                return $this->errorResponse();
            }

            $content = $response->json('choices.0.message.content', '{}');
            $parsed  = json_decode($content, true);

            if (!isset($parsed['reply'])) {
                return ['reply' => $content, 'map_actions' => []];
            }

            return [
                'reply'       => $parsed['reply'],
                'map_actions' => $parsed['map_actions'] ?? [],
            ];

        } catch (\Throwable $e) {
            Log::error('GroqService exception: ' . $e->getMessage());
            return $this->errorResponse();
        }
    }

    private function errorResponse(): array
    {
        return [
            'reply'       => 'No puedo procesar la consulta ahora mismo. Inténtalo de nuevo.',
            'map_actions' => [],
        ];
    }
}
