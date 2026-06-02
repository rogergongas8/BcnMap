<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private const MODEL   = 'llama-3.3-70b-versatile';

    public function chat(string $userMessage, string $cityContext, array $history = [], string $lang = 'ca'): array
    {
        $langInstruction = match ($lang) {
            'es'    => 'Responde siempre en español.',
            'en'    => 'Always respond in English.',
            default => 'Respon sempre en català.',
        };

        $replyExample = match ($lang) {
            'es'    => 'respuesta conversacional en español (máx 4 frases)',
            'en'    => 'conversational response in English (max 4 sentences)',
            default => 'resposta conversacional en català (màx 4 frases)',
        };

        $systemPrompt = <<<PROMPT
Eres el asistente de BCN Live, app de monitorización en tiempo real de Barcelona. Ayudas a los usuarios a moverse por la ciudad, descubrir eventos y lugares, y planificar su tiempo usando datos en tiempo real.
{$langInstruction}

DATOS ACTUALES:
{$cityContext}

Responde SIEMPRE en JSON exacto con esta estructura:
{
  "reply": "{$replyExample}",
  "map_actions": [],
  "suggestions": []
}

REGLAS PARA EL CAMPO "reply":
- Sé natural y útil. Describe los lugares por nombre, barrio o referencia, NUNCA por coordenadas.
- Si calculas una ruta, explica brevemente el modo elegido y por qué (ej: "Te mando en metro porque hay congestión", "A pie son unos 15 minutos desde Gràcia").
- Si hay eventos relevantes, menciona el horario real que aparece en los datos.
- No inventes datos. Si no sabes algo, dilo con naturalidad.

REGLAS PARA EL CAMPO "suggestions" (OPCIONAL):
- Úsalo cuando ofreces 2-3 opciones concretas (planes, lugares, eventos). NUNCA para rutas.
- Máximo 3 items. Cada item tiene esta forma exacta:
  { "label": "Texto corto del botón", "action": "open_place", "name": "Nombre del lugar", "lat": float, "lng": float, "category": "categoria" }
  o para rutas directas: { "label": "Texto corto", "action": "route", "name": "Destino", "lat": float, "lng": float }
- El label debe ser conciso (máx 5 palabras), sin emojis. Si el evento tiene hora concreta, inclúyela: "Concierto Jazz · 20:00".
- NUNCA incluyas un item en suggestions si no tienes coordenadas reales (lat/lng). Descarta el item en ese caso.
- Si no hay sugerencias concretas con coordenadas, pon "suggestions": [].

map_actions disponibles (incluye solo los relevantes, sin explicarlos en el reply):
- { "type": "fly_to", "lat": 41.38, "lng": 2.17, "zoom": 14 }
- { "type": "focus_layer", "layer": "bicing" }
- { "type": "highlight_zone", "zone": "eixample" }
- { "type": "reset_view" }
- { "type": "open_place", "name": "string", "lat": float, "lng": float, "category": "string" }
- { "type": "show_events", "filter": "hoy|semana|string_categoria_o_null", "category": "string_o_null" }
- { "type": "plan_trip", "origin_label": "string", "origin_lat": float_o_null, "origin_lng": float_o_null, "dest_label": "string", "dest_lat": float_o_null, "dest_lng": float_o_null, "constraint": "string_o_null" }
- { "type": "calculate_route", "origin_label": "string", "origin_lat": float_o_null, "origin_lng": float_o_null, "dest_label": "string", "dest_lat": float_o_null, "dest_lng": float_o_null, "mode": "foot|bike|car|bus" }

REGLAS CRÍTICAS:
- Si el usuario pregunta qué hay hoy, qué hacer, eventos, planes para esta tarde/noche/semana → "show_events" + usa "suggestions" con 2-3 eventos concretos.
- Si el usuario PREGUNTA por un lugar concreto (recomiéndame, cuál está más cerca, cuál es mejor) → "open_place" + "fly_to". Nunca uses plan_trip ni calculate_route para recomendaciones.
- Si el usuario quiere ir a algún sitio SIN especificar modo (llévame, quiero ir, cómo llego, dame ruta) → usa "plan_trip". El sistema calculará el modo óptimo automáticamente.
- Si el usuario especifica modo explícito ("en metro", "a pie", "en bici", "en coche") → usa "calculate_route" con ese modo.
- "constraint" en plan_trip captura restricciones: "tengo prisa", "sin metro", "con bici", "prefiero no conducir", etc.
- Nunca inicies una ruta sin que el usuario la pida.

REGLAS PARA open_place:
- Usa open_place cuando recomiendas un lugar concreto. Muestra el lugar en el mapa para que el usuario lo vea y decida si quiere ir.
- Si el lugar aparece en POIS CERCANOS o EVENTOS, usa sus coordenadas exactas y su nombre tal cual aparece.
- Incluye siempre fly_to antes de open_place para centrar el mapa.

REGLAS PARA plan_trip y calculate_route:
- Para origen: si hay POSICIÓN USUARIO en el contexto, úsala (origin_lat/origin_lng con esas coordenadas, origin_label: "Mi ubicación"). Si no, pon null.
- Para destinos conocidos usa coordenadas precisas: Sagrada Família(41.4036,2.1744), Parc Güell(41.4145,2.1527), Camp Nou(41.3809,2.1228), Barceloneta(41.3793,2.1892), Born(41.3854,2.1834), Gràcia(41.4036,2.1564), Tibidabo(41.4218,2.1189), Montjuïc(41.3637,2.1588), Arc de Triomf(41.3912,2.1804), Hospital Sant Pau(41.4120,2.1741).
- Para destinos de dirección (ej: "Sant Antoni Maria Claret 57"): usa dest_label con la dirección, deja dest_lat/dest_lng en null.
- Si el lugar aparece en POIS CERCANOS o EVENTOS, usa sus coordenadas exactas.
- En "constraint" de plan_trip incluye todo lo que el usuario mencione sobre preferencias o restricciones.
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
                    'model'           => self::MODEL,
                    'messages'        => $messages,
                    'temperature'     => 0.7,
                    'max_tokens'      => 1024,
                    'response_format' => ['type' => 'json_object'],
                ]);

            if (!$response->successful()) {
                Log::error('Groq API error: ' . $response->status() . ' ' . $response->body());
                return $this->errorResponse();
            }

            $content = $response->json('choices.0.message.content', '{}');
            $parsed  = $this->extractJson($content);

            if (!isset($parsed['reply'])) {
                return ['reply' => $content, 'map_actions' => [], 'suggestions' => []];
            }

            return [
                'reply'       => $parsed['reply'],
                'map_actions' => $parsed['map_actions'] ?? [],
                'suggestions' => $parsed['suggestions'] ?? [],
            ];

        } catch (\Throwable $e) {
            Log::error('GroqService exception: ' . $e->getMessage());
            return $this->errorResponse();
        }
    }

    private function extractJson(string $content): ?array
    {
        // Try direct parse first
        $parsed = json_decode($content, true);
        if (is_array($parsed)) return $parsed;

        // Find the first { ... } block in the response (model sometimes adds text before/after)
        $start = strpos($content, '{');
        $end   = strrpos($content, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $parsed = json_decode(substr($content, $start, $end - $start + 1), true);
            if (is_array($parsed)) return $parsed;
        }

        return null;
    }

    private function errorResponse(): array
    {
        return [
            'reply'       => 'No puedo procesar la consulta ahora mismo. Inténtalo de nuevo.',
            'map_actions' => [],
            'suggestions' => [],
        ];
    }
}
