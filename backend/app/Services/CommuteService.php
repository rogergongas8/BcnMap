<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CommuteSchedule;
use Illuminate\Support\Facades\Cache;

class CommuteService
{
    public function __construct(
        private readonly RouteService $routeService,
        private readonly BusService $busService,
        private readonly MetroService $metroService,
    ) {}

    /**
     * Returns real-time commute status:
     * {
     *   is_today, leave_by (HH:MM), next_departure (HH:MM|null),
     *   travel_minutes, arrival_time, mode, warning (string|null)
     * }
     */
    public function getStatus(CommuteSchedule $schedule): array
    {
        $isToday = $schedule->isActiveToday();

        $route = $this->getRouteEstimate($schedule);
        $travelMinutes = $route['duration_minutes'] ?? null;

        [$leaveBy, $nextDeparture, $warning] = $this->calculateDeparture($schedule, $travelMinutes);

        return [
            'is_today'       => $isToday,
            'leave_by'       => $leaveBy,
            'next_departure' => $nextDeparture,
            'travel_minutes' => $travelMinutes,
            'arrival_time'   => $schedule->arrival_time,
            'mode'           => $schedule->mode,
            'warning'        => $warning,
        ];
    }

    private function getRouteEstimate(CommuteSchedule $schedule): array
    {
        $cacheKey = sprintf(
            'commute:route:%d:%s',
            $schedule->id,
            now()->format('Y-m-d-H')
        );

        return Cache::remember($cacheKey, 3600, function () use ($schedule) {
            try {
                $result = $this->routeService->calculate(
                    $schedule->origin_lat,
                    $schedule->origin_lng,
                    $schedule->dest_lat,
                    $schedule->dest_lng,
                    $schedule->mode,
                );
                $durationSeconds = $result['duration'] ?? null;
                return [
                    'duration_minutes' => $durationSeconds ? (int) ceil($durationSeconds / 60) : null,
                ];
            } catch (\Throwable) {
                return ['duration_minutes' => null];
            }
        });
    }

    /**
     * Returns [leave_by, next_departure, warning].
     *
     * For bus/metro modes: fetches real next departure from origin stop area,
     * calculates walk-to-stop time + vehicle travel time.
     * For foot/bicing/car: pure duration subtraction from arrival_time.
     */
    private function calculateDeparture(CommuteSchedule $schedule, ?int $travelMinutes): array
    {
        if ($travelMinutes === null) {
            return [null, null, 'No se pudo calcular la ruta'];
        }

        [$arrivalH, $arrivalM] = explode(':', $schedule->arrival_time);
        $arrivalMinutes = (int) $arrivalH * 60 + (int) $arrivalM;

        if (in_array($schedule->mode, ['bus', 'metro'], true)) {
            return $this->calculateTransitDeparture($schedule, $arrivalMinutes, $travelMinutes);
        }

        $leaveByMinutes = $arrivalMinutes - $travelMinutes;
        return [
            $this->minutesToTime($leaveByMinutes),
            null,
            $leaveByMinutes < 0 ? 'La ruta tarda mas que el tiempo disponible' : null,
        ];
    }

    private function calculateTransitDeparture(CommuteSchedule $schedule, int $arrivalMinutes, int $travelMinutes): array
    {
        $nextDeparture = $this->getNextDepartureMinutes($schedule);

        if ($nextDeparture === null) {
            // Fallback: simple subtraction
            $leaveBy = $arrivalMinutes - $travelMinutes - ($schedule->alert_minutes_before);
            return [$this->minutesToTime($leaveBy), null, null];
        }

        // "Leave home" = next_departure - 5 min walk buffer to stop
        $walkToStopBuffer = 5;
        $leaveByMinutes = $nextDeparture - $walkToStopBuffer;

        $warning = null;
        $expectedArrival = $nextDeparture + $travelMinutes;
        if ($expectedArrival > $arrivalMinutes) {
            $late = $expectedArrival - $arrivalMinutes;
            $warning = "Llegaras ~{$late} min tarde con el siguiente servicio";
        }

        return [
            $this->minutesToTime($leaveByMinutes),
            $this->minutesToTime($nextDeparture),
            $warning,
        ];
    }

    private function getNextDepartureMinutes(CommuteSchedule $schedule): ?int
    {
        $nowMinutes = (int) now()->format('G') * 60 + (int) now()->format('i');

        try {
            if ($schedule->mode === 'bus') {
                $stops = $this->busService->getCurrent();
                $nearest = $this->findNearestStop($stops, $schedule->origin_lat, $schedule->origin_lng);
                if (!$nearest) return null;

                $arrivals = $this->busService->getArrivalsForStop((string) $nearest['stop_id']);
                $minFromNow = $this->firstArrivalMinutes($arrivals);
                return $minFromNow !== null ? $nowMinutes + $minFromNow : null;
            }

            if ($schedule->mode === 'metro') {
                $stations = $this->metroService->getCurrent();
                $nearest = $this->findNearestStop($stations, $schedule->origin_lat, $schedule->origin_lng);
                if (!$nearest) return null;

                $arrivals = $this->metroService->getArrivalsForStation((int) $nearest['estacio_id']);
                $minFromNow = $this->firstArrivalMinutes($arrivals);
                return $minFromNow !== null ? $nowMinutes + $minFromNow : null;
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }

    private function findNearestStop(array $stops, float $lat, float $lng): ?array
    {
        $nearest = null;
        $minDist = PHP_INT_MAX;

        foreach ($stops as $stop) {
            $sLat = (float) ($stop['lat'] ?? 0);
            $sLng = (float) ($stop['lng'] ?? 0);
            if ($sLat === 0.0 && $sLng === 0.0) continue;
            $dist = ($lat - $sLat) ** 2 + ($lng - $sLng) ** 2;
            if ($dist < $minDist) {
                $minDist = $dist;
                $nearest = $stop;
            }
        }

        // Only use if within ~500m (0.0000225 deg^2 ≈ 500m radius)
        return $minDist < 0.0000225 ? $nearest : null;
    }

    private function firstArrivalMinutes(array $arrivals): ?int
    {
        foreach ($arrivals as $line) {
            if (!empty($line['arrivals'])) {
                return (int) $line['arrivals'][0];
            }
        }
        return null;
    }

    private function minutesToTime(int $minutes): string
    {
        $minutes = ((($minutes % 1440) + 1440) % 1440);
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
