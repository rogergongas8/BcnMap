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
        private EventsService     $events,
    ) {}

    public function buildContext(?float $userLat = null, ?float $userLng = null): string
    {
        $now     = now()->format('d/m/Y H:i');
        $traffic = $this->traffic->getCurrentSummary();
        $bicing  = $this->bicing->getCurrentSummary();
        $weather = $this->weather->getCurrent();
        $air     = $this->air->getCurrent();
        $events  = $this->events->getSummaryForContext();

        $weatherText = $weather
            ? "{$weather['temp']}°C, {$weather['description']}, humedad {$weather['humidity']}%"
            : 'sin datos';

        $airText = $air
            ? "Índice AQI {$air['aqi']} ({$air['level']})"
            : 'sin datos';

        $isRainy = $weather && preg_match('/lluvi|tormenta|rain|storm/i', $weather['description'] ?? '');

        $userBlock = '';
        if ($userLat !== null && $userLng !== null) {
            $userBlock = "POSICIÓN USUARIO: lat={$userLat}, lng={$userLng}\n\n";
        }

        $bicingNote = $isRainy ? ' [NOTA: lluvia → bicing NO recomendado]' : '';
        $weatherNote = $isRainy ? "\n[IMPACTO MOVILIDAD: lluvia → más tráfico, transporte público saturado]" : '';

        $eventsBlock = $events ? "\nEVENTOS BCN: {$events}." : '';

        return <<<EOT
        Estado actual de Barcelona ({$now}):

        {$userBlock}TRÁFICO: {$traffic->congestion_level}% de congestión global.
        Zonas cortadas: {$traffic->closed_zones}.
        Zonas más congestionadas: {$traffic->worst_zones}.

        BICING: {$bicing->available_bikes} bicis disponibles en {$bicing->active_stations} estaciones activas.
        Estaciones vacías: {$bicing->empty_zones}.{$bicingNote}

        CLIMA: {$weatherText}.{$weatherNote}

        AIRE: {$airText}.{$eventsBlock}
        EOT;
    }
}
