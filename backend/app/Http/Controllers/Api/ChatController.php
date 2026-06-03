<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CityContextService;
use App\Services\EventsEnrichmentService;
use App\Services\GroqService;
use App\Services\PoiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ChatController extends Controller
{
    private const CONTEXT_TTL = 120;

    // POI category keywords → Overpass category
    private const POI_KEYWORDS = [
        'restaurant|restaurante|comer|menú|menu|cenar|cena|dinar|sopar|menjar|sushi|pizza|hamburguesa|tapas|italiano|mexicano|asiático' => 'restaurant',
        'café|cafetería|cafè|cafeteria|esmorzar|desayunar|cafè con leche'       => 'cafe',
        'bar|cerveza|vermut|copa|birra|birres|cañas|copes'                      => 'bar',
        'museo|museu|exposición|exposicio|exposició|galeria|galería'            => 'museum',
        'farmacia|farmàcia|medicament|medicamento|parafarmacia'                 => 'pharmacy',
        'supermercado|supermercat|compra|mercat|supermarket'                    => 'supermarket',
        'hospital|urgencias|urgència|urgencies|clínica|clinica|metge|médico|ambulatori|ambulatorio|CAP|centre mèdic' => 'hospital',
    ];

    // Categories that need a larger search radius (km)
    private const POI_RADIUS = [
        'hospital' => 3000,
    ];
    private const POI_RADIUS_DEFAULT = 800;

    public function __construct(
        private GroqService              $groq,
        private CityContextService       $context,
        private EventsEnrichmentService  $events,
        private PoiService               $pois,
    ) {}

    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'message'              => 'required|string|max:500',
            'conversation_history' => 'nullable|array|max:20',
            'lang'                 => 'nullable|in:ca,es,en',
            'user_lat'             => 'nullable|numeric',
            'user_lng'             => 'nullable|numeric',
            'nearby_pois'          => 'nullable|array|max:12',
        ]);

        $userMessage = $request->input('message');
        $userLat    = $request->input('user_lat') !== null ? (float) $request->input('user_lat') : null;
        $userLng    = $request->input('user_lng') !== null ? (float) $request->input('user_lng') : null;
        $nearbyPois = $request->input('nearby_pois', []);
        $lang       = $request->input('lang', 'ca');

        // Poor Man's RAG: events matching the message text
        $relevantEvents = $this->events->search($userMessage, limit: 5);

        // Nearby events when user has position (radius 3km, max 8)
        $nearbyEvents = [];
        if ($userLat !== null && $userLng !== null) {
            $nearbyEvents = array_slice($this->events->nearby($userLat, $userLng, 3.0), 0, 8);
        }

        // Proactive POI search: if message matches a category, fetch real POIs
        $proactivePois = [];
        if ($userLat !== null && $userLng !== null) {
            $history = $request->input('conversation_history', []);
            $specificMatch = $this->detectSpecificQuery($userMessage, $history);
            
            if ($specificMatch !== null) {
                $searchLat = $userLat;
                $searchLng = $userLng;
                
                // If the user specified a location, find its coordinates first
                if ($specificMatch['has_location'] && !empty($specificMatch['location'])) {
                    $locResults = $this->pois->searchByName($specificMatch['location']);
                    if (!empty($locResults)) {
                        $searchLat = $locResults[0]['lat'];
                        $searchLng = $locResults[0]['lng'];
                        
                        $locPoi = $locResults[0];
                        $locPoi['name'] = 'Referencia: ' . $locPoi['name'];
                        $locPoi['category'] = 'monument';
                        $proactivePois[] = $locPoi;
                    }
                }
                
                // Sort by distance to the chosen center (GPS or landmark)
                $specificPois = array_slice($this->pois->searchByName($specificMatch['query'], $searchLat, $searchLng, true), 0, 15);
                $proactivePois = array_merge($proactivePois, $specificPois);
            }
            
            if (empty($proactivePois)) {
                $poiCategory = $this->detectPoiCategory($userMessage, $history);
                if ($poiCategory !== null) {
                    $radius = self::POI_RADIUS[$poiCategory] ?? self::POI_RADIUS_DEFAULT;
                    $genericPois = array_slice(
                        $this->pois->nearby($userLat, $userLng, $radius, [$poiCategory]),
                        0, 12,
                    );
                    $proactivePois = array_merge($proactivePois, $genericPois);
                }
            }
        }

        $baseContext = Cache::remember('chat:city_base_context', self::CONTEXT_TTL, fn () =>
            $this->context->buildBaseContext()
        );

        $cityContext = $this->context->appendUserData(
            $baseContext,
            $userLat,
            $userLng,
            $nearbyPois,
            $relevantEvents,
        );

        // Append nearby events block
        if (!empty($nearbyEvents)) {
            $cityContext .= $this->buildNearbyEventsBlock($nearbyEvents);
        }

        // Append proactive POI search results
        if (!empty($proactivePois)) {
            $cityContext .= $this->buildProactivePoisBlock($proactivePois);
        }

        $result = $this->groq->chat(
            userMessage: $userMessage,
            cityContext:  $cityContext,
            history:      $request->input('conversation_history', []),
            lang:         $lang,
        );

        return response()->json($result);
    }

    private function detectPoiCategory(string $msg, array $history = []): ?string
    {
        foreach (self::POI_KEYWORDS as $pattern => $category) {
            if (preg_match("/{$pattern}/iu", $msg)) {
                return $category;
            }
        }
        
        // Search backwards in history if current message has no category
        foreach (array_reverse($history) as $h) {
            if (($h['role'] ?? '') === 'user') {
                foreach (self::POI_KEYWORDS as $pattern => $category) {
                    if (preg_match("/{$pattern}/iu", $h['content'] ?? '')) {
                        return $category;
                    }
                }
            }
        }
        return null;
    }

    private function detectSpecificQuery(string $msg, array $history = []): ?array
    {
        $keywords = ['sushi', 'pizza', 'hamburguesa', 'burger', 'tapas', 'mexicano', 'asiático', 'paella', 'kebab', 'indio', 'vegetariano'];
        $keywordsStr = implode('|', $keywords);
        
        $barrios = 'sagrada familia|gracia|gràcia|eixample|sants|born|raval|gotic|gótico|poblenou|barceloneta|carmel|clot|sant antoni|les corts|sarria|sarrià|sant gervasi|tibidabo|montjuic|montjuïc|camp nou|plaça catalunya|plaza cataluña|arc de triomf';
        
        $fullText = $msg;
        foreach (array_reverse($history) as $h) {
            if (($h['role'] ?? '') === 'user') {
                $fullText = ($h['content'] ?? '') . ' ' . $fullText;
            }
        }
        
        // Try to match keyword + a known location
        $patternLoc = '/\b(' . $keywordsStr . ')\b.*?\b(' . $barrios . ')\b/iu';
        if (preg_match($patternLoc, $fullText, $m)) {
            return ['query' => $m[1], 'location' => $m[2], 'has_location' => true];
        }
        
        // Fallback to just the keyword
        $pattern = '/\b(' . $keywordsStr . ')\b/iu';
        if (preg_match($pattern, $fullText, $m)) {
            return ['query' => $m[1], 'has_location' => false];
        }
        
        return null;
    }

    private function buildNearbyEventsBlock(array $events): string
    {
        $today = now()->format('Y-m-d');
        $lines = [];
        foreach ($events as $e) {
            $line = ($e['title'] ?? '');
            if (!empty($e['category'])) $line .= " ({$e['category']})";
            if (!empty($e['place']))    $line .= " — {$e['place']}";

            $start = $e['start'] ?? null;
            $end   = $e['end']   ?? null;
            if ($start && $start > $today)        $line .= ', a partir del ' . $start;
            elseif ($end && $end >= $today)        $line .= ', hasta el ' . $end;
            else                                   $line .= ', hoy';

            if (!empty($e['time']))      $line .= '. Hora: ' . $e['time'];
            if (!empty($e['timetable'])) $line .= '. Horario: ' . $e['timetable'];

            if (isset($e['lat'], $e['lng'])) {
                $lat   = number_format((float) $e['lat'], 6, '.', '');
                $lng   = number_format((float) $e['lng'], 6, '.', '');
                $line .= " [lat={$lat},lng={$lng}]";
            }
            $lines[] = "  - {$line}";
        }

        return "\n\nEVENTOS CERCANOS AL USUARIO:\n" . implode("\n", $lines)
            . "\nUsa estos eventos para sugerencias y rutas. Coordenadas precisas disponibles.";
    }

    private function buildProactivePoisBlock(array $pois): string
    {
        $lines = [];
        foreach ($pois as $p) {
            $dist  = isset($p['distance_m']) ? round((float) $p['distance_m']) . 'm' : '?m';
            $addr  = !empty($p['address']) ? ", {$p['address']}" : '';
            $lat   = number_format((float) ($p['lat'] ?? 0), 6, '.', '');
            $lng   = number_format((float) ($p['lng'] ?? 0), 6, '.', '');
            $lines[] = "  - {$p['name']} ({$p['category']}{$addr}) — {$dist} [lat={$lat},lng={$lng}]";
        }

        return "\n\nLUGARES ENCONTRADOS PARA TU CONSULTA:\n" . implode("\n", $lines)
            . "\nUsa estos lugares para responder. Menciona sus nombres reales. IMPORTANTE: Si los lugares no encajan exactamente con la búsqueda (ej. el usuario pide sushi y los lugares son restaurantes genéricos), adviértelo y NO inventes que ofrecen lo que el usuario pide.";
    }
}
