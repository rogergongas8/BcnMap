<?php

declare(strict_types=1);

namespace App\Services;

class CityContextService
{
    public function __construct(
        private TrafficService    $traffic,
        private BicingService     $bicing,
        private WeatherService    $weather,
        private AirQualityService $air,
        private EventsEnrichmentService $events,
        private MetroService      $metro,
    ) {}

    /**
     * City-wide data that changes every ~2 minutes. Safe to cache at that TTL.
     * Does NOT include user position or nearby POIs.
     */
    public function buildBaseContext(): string
    {
        $nowDt   = now('Europe/Madrid');
        $now     = $nowDt->format('d/m/Y H:i');
        $weekday = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][(int)$nowDt->format('w')];
        $hour    = (int) $nowDt->format('H');
        $month   = (int) $nowDt->format('n');

        $timeOfDay = match (true) {
            $hour < 6  => 'madrugada',
            $hour < 12 => 'mañana',
            $hour < 15 => 'mediodía',
            $hour < 19 => 'tarde',
            $hour < 22 => 'tarde-noche',
            default    => 'noche',
        };

        $season = match (true) {
            in_array($month, [12, 1, 2], true) => 'invierno',
            in_array($month, [3, 4, 5], true)  => 'primavera',
            in_array($month, [6, 7, 8], true)  => 'verano',
            default                            => 'otoño',
        };

        $traffic      = $this->traffic->getCurrentSummary();
        $bicing       = $this->bicing->getCurrentSummary();
        $weather      = $this->weather->getCurrent();
        $air          = $this->air->getCurrent();
        $events       = $this->events->getSummaryForContext();
        $disruptions  = $this->metro->getDisruptions();

        $weatherText = $weather
            ? "{$weather['temp']}°C, {$weather['description']}, humedad {$weather['humidity']}%"
            : 'sin datos';

        $airText = $air
            ? "Índice AQI {$air['aqi']} ({$air['level']})"
            : 'sin datos';

        $isRainy = $weather && preg_match('/lluvi|tormenta|rain|storm/i', $weather['description'] ?? '');
        $isCold  = $weather && ($weather['temp'] ?? 99) < 10;
        $isHot   = $weather && ($weather['temp'] ?? 0) > 30;

        $signals = [];
        if ($isRainy)                               $signals[] = 'lluvia activa → evita bici/pie largo, transporte público saturado';
        if ($isCold)                                $signals[] = 'frío → desaconseja pie largo';
        if ($isHot)                                 $signals[] = 'calor extremo → evita pie a mediodía, prioriza metro o coche';
        if (($traffic->congestion_level ?? 0) > 60) $signals[] = 'tráfico denso → metro o bici recomendado sobre coche';
        if (($air['aqi'] ?? 0) > 100)               $signals[] = 'aire malo → evita actividad física al aire libre';
        if ($hour >= 22 || $hour < 6)               $signals[] = 'horario nocturno → frecuencias metro reducidas, último metro ~24h L-J / 02h V / 24h continuo S';
        if ($timeOfDay === 'mediodía' && $isHot)    $signals[] = 'mediodía caluroso → playas y parques con sombra (Ciutadella, Montjuïc)';

        $signalsText = $signals ? "\nSEÑALES OPERATIVAS:\n- " . implode("\n- ", $signals) : '';
        $bicingNote  = $isRainy ? ' [lluvia → bicing NO recomendado]' : '';
        $eventsBlock = $events ? "\nEVENTOS BCN: {$events}." : '';

        $disruptionsBlock = '';
        if (!empty($disruptions)) {
            $lines = array_map(fn($d) => "{$d['line']}: {$d['description']}", $disruptions);
            $disruptionsBlock = "\nINCIDENCIAS METRO: " . implode('. ', $lines) . ". La IA debe mencionar incidencias relevantes al calcular rutas.";
        }

        return <<<EOT
        Estado actual de Barcelona ({$now}, {$weekday} {$timeOfDay}, {$season}):

        TRÁFICO: {$traffic->congestion_level}% de congestión global.
        Zonas cortadas: {$traffic->closed_zones}.
        Zonas más congestionadas: {$traffic->worst_zones}.

        BICING: {$bicing->available_bikes} bicis disponibles en {$bicing->active_stations} estaciones activas.
        Estaciones vacías: {$bicing->empty_zones}.{$bicingNote}

        CLIMA: {$weatherText}.

        AIRE: {$airText}.{$eventsBlock}{$disruptionsBlock}{$signalsText}
        EOT;
    }

    /**
     * Appends user-specific data (position + nearby POIs) to a pre-built base context.
     */
    public function appendUserData(string $base, ?float $userLat, ?float $userLng, array $nearbyPois, array $relevantEvents = []): string
    {
        $userBlock = '';
        if ($userLat !== null && $userLng !== null) {
            $userBlock = "\n\nPOSICIÓN USUARIO: lat={$userLat}, lng={$userLng}";
        }

        $poisBlock = '';
        if (!empty($nearbyPois)) {
            $lines = [];
            foreach (array_slice($nearbyPois, 0, 12) as $p) {
                $dist    = isset($p['distance_m']) ? round((float)$p['distance_m']) . 'm' : '?m';
                $addr    = isset($p['address']) && $p['address'] ? ", {$p['address']}" : '';
                $lat     = number_format((float)($p['lat'] ?? 0), 6, '.', '');
                $lng     = number_format((float)($p['lng'] ?? 0), 6, '.', '');
                $lines[] = "  - {$p['name']} ({$p['category']}{$addr}) — {$dist} [lat={$lat},lng={$lng}]";
            }
            $poisBlock = "\n\nPOIS CERCANOS AL USUARIO (en pantalla):\n" . implode("\n", $lines)
                . "\nUsa lat/lng exactos en calculate_route para rutas a estos lugares.";
        }

        $relevantEventsBlock = '';
        if (!empty($relevantEvents)) {
            $lines = [];
            foreach ($relevantEvents as $e) {
                $label = $e['title'];
                if ($e['start'] ?? null) {
                    $label .= ' (' . $e['start'] . ')';
                }
                $meta = array_filter([$e['place'] ?? null, $e['time'] ?? null]);
                if ($meta) $label .= ' — ' . implode(', ', $meta);
                
                $coords = '';
                if (isset($e['lat']) && isset($e['lng'])) {
                    $lat = number_format((float)$e['lat'], 6, '.', '');
                    $lng = number_format((float)$e['lng'], 6, '.', '');
                    $coords = " [lat={$lat},lng={$lng}]";
                }
                $lines[] = "  - {$label}{$coords}";
            }
            $relevantEventsBlock = "\n\nPOSIBLES EVENTOS MENCIONADOS POR EL USUARIO:\n" . implode("\n", $lines)
                . "\nSi el usuario pregunta por alguno de estos, ya tienes los datos.";
        }

        return $base . $userBlock . $poisBlock . $relevantEventsBlock;
    }

    // Kept for backwards compatibility with any other callers (e.g. city-context endpoint).
    public function buildContext(?float $userLat = null, ?float $userLng = null, array $nearbyPois = []): string
    {
        return $this->appendUserData($this->buildBaseContext(), $userLat, $userLng, $nearbyPois);
    }
}
