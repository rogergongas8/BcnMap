<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Enriquece los eventos crudos de EventsService añadiendo categoría,
 * distancia al centro y ordenación por proximidad temporal.
 *
 * Nota: EventsService no devuelve lat/lng todavía. Mantenemos los eventos
 * sin coordenadas para no inventar datos, pero el contrato lo aceptamos
 * para que el frontend pueda enriquecerlos cuando lleguen.
 */
class EventsEnrichmentService
{
    private const CACHE_KEY = 'events:enriched:current';
    private const CACHE_TTL = 3600; // 1h

    private const CENTER_LAT = 41.3870;
    private const CENTER_LNG = 2.1701;

    private const MAX_FUTURE_DAYS = 14;

    public function __construct(private EventsService $events)
    {
    }

    public function current(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && !empty($cached)) {
            return $cached;
        }

        return $this->build();
    }

    public function today(): array
    {
        $today = now()->format('Y-m-d');
        return array_values(array_filter(
            $this->current(),
            fn (array $e): bool => ($e['start'] ?? null) === $today
                || (($e['start'] ?? null) <= $today && ($e['end'] ?? $today) >= $today),
        ));
    }

    /**
     * Eventos cuya ubicación está dentro de un radio. Si no hay lat/lng,
     * el evento se omite del resultado (no podemos calcular distancia).
     */
    public function nearby(float $lat, float $lng, float $radiusKm = 2.0): array
    {
        $result = [];
        foreach ($this->current() as $event) {
            if (!isset($event['lat'], $event['lng'])) {
                continue;
            }
            $distance = $this->haversine($lat, $lng, (float) $event['lat'], (float) $event['lng']);
            if ($distance <= $radiusKm) {
                $event['distance_km'] = round($distance, 2);
                $result[] = $event;
            }
        }

        usort($result, fn (array $a, array $b): int => ($a['distance_km'] <=> $b['distance_km']));
        return $result;
    }

    private function build(): array
    {
        $raw = $this->events->getCurrent();
        if (empty($raw)) {
            $raw = $this->events->fetch();
        }

        $today  = now()->format('Y-m-d');
        $cutoff = now()->addDays(self::MAX_FUTURE_DAYS)->format('Y-m-d');

        $enriched = [];
        foreach ($raw as $event) {
            $start = $event['start'] ?? null;
            $end   = $event['end'] ?? null;

            // Honest filter: dejar pasar eventos en curso o que empiezan en <= 14 días
            if ($start && $start > $cutoff) {
                continue;
            }
            if ($end && $end < $today) {
                continue;
            }

            $lat = isset($event['lat']) && is_numeric($event['lat']) ? (float) $event['lat'] : null;
            $lng = isset($event['lng']) && is_numeric($event['lng']) ? (float) $event['lng'] : null;

            $enrichedEvent = [
                'title'    => $event['title'] ?? '',
                'category' => $this->deriveCategory($event),
                'raw_category' => $event['category'] ?? '',
                'place'    => $event['place'] ?? '',
                'district' => $event['district'] ?? '',
                'start'    => $start,
                'end'      => $end,
                'lat'      => $lat,
                'lng'      => $lng,
                'today'    => $start === $today || ($start && $start <= $today && $end && $end >= $today),
                'distance_to_center_km' => null,
            ];

            if ($lat !== null && $lng !== null) {
                $enrichedEvent['distance_to_center_km'] = round(
                    $this->haversine(self::CENTER_LAT, self::CENTER_LNG, $lat, $lng),
                    2,
                );
            }

            $enriched[] = $enrichedEvent;
        }

        usort($enriched, function (array $a, array $b) use ($today): int {
            $aToday = $a['today'] ? 0 : 1;
            $bToday = $b['today'] ? 0 : 1;
            if ($aToday !== $bToday) {
                return $aToday <=> $bToday;
            }
            return strcmp((string) ($a['start'] ?? '9999'), (string) ($b['start'] ?? '9999'));
        });

        Cache::put(self::CACHE_KEY, $enriched, self::CACHE_TTL);
        return $enriched;
    }

    private function deriveCategory(array $event): string
    {
        $text = strtolower(implode(' ', [
            $event['title'] ?? '',
            $event['category'] ?? '',
            $event['place'] ?? '',
        ]));

        $map = [
            'musica'      => ['música', 'musica', 'concert', 'concierto', 'jazz', 'rock', 'pop', 'opera', 'festival'],
            'esport'      => ['esport', 'deport', 'futbol', 'fútbol', 'basquet', 'bàsquet', 'marató', 'maraton', 'cursa', 'running'],
            'cultura'     => ['cultura', 'museu', 'museo', 'exposici', 'art', 'teatre', 'teatro', 'cinema', 'cine', 'literatura'],
            'gastronomia' => ['gastro', 'tast', 'cuina', 'cocina', 'food', 'vins', 'vinos', 'cervesa', 'cerveza'],
            'familia'     => ['família', 'familia', 'infants', 'niños', 'kids', 'children'],
        ];

        foreach ($map as $category => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($text, $kw)) {
                    return $category;
                }
            }
        }

        return 'altres';
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
