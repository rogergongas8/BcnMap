<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\BicingSnapshot;
use App\Models\CitySnapshot;
use App\Models\TrafficSnapshot;
use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class HistorySnapshotService
{
    /**
     * Maximum delta (in minutes) to consider a snapshot "close" to the requested timestamp.
     */
    private const MAX_DELTA_MIN = 5;

    /**
     * Returns the city state nearest to the given timestamp. Each field is null if no
     * snapshot exists within the MAX_DELTA_MIN window around it.
     *
     * @return array{timestamp:string,traffic:array|null,bicing:array|null,city:array|null}
     */
    public function snapshotAt(DateTimeInterface $timestamp): array
    {
        $at = Carbon::instance(
            $timestamp instanceof DateTimeImmutable
                ? \DateTime::createFromImmutable($timestamp)
                : $timestamp
        );

        return [
            'timestamp' => $at->toIso8601String(),
            'traffic'   => $this->trafficAt($at),
            'bicing'    => $this->bicingAt($at),
            'city'      => $this->cityAt($at),
        ];
    }

    /**
     * Returns the time range available in the dataset, useful for slider bounds.
     *
     * @return array{earliest:?string,latest:?string,count:int}
     */
    public function availableRange(): array
    {
        $earliest = CitySnapshot::min('snapshot_at');
        $latest   = CitySnapshot::max('snapshot_at');
        $count    = (int) CitySnapshot::count();

        return [
            'earliest' => $earliest ? Carbon::parse($earliest)->toIso8601String() : null,
            'latest'   => $latest   ? Carbon::parse($latest)->toIso8601String()   : null,
            'count'    => $count,
        ];
    }

    /**
     * Returns a downsampled timeline (KPIs only) for the last $hours, bucketed every
     * $stepMin minutes. Cached in Redis for 60s.
     *
     * Buckets without a city snapshot are emitted with null KPIs so the frontend can
     * render gaps (no visual interpolation server-side; the client decides what to do).
     *
     * @return list<array{timestamp:string,traffic_congestion:?int,bicing_availability:?int,air_index:?int,weather_temp:?float}>
     */
    public function timeline(int $hours = 24, int $stepMin = 5): array
    {
        $hours   = max(1, min($hours, 48));
        $stepMin = max(1, min($stepMin, 60));
        $cacheKey = sprintf('history:timeline:%d:%d', $hours, $stepMin);

        return Cache::remember($cacheKey, 60, function () use ($hours, $stepMin) {
            $end   = Carbon::now();
            $start = (clone $end)->subHours($hours);

            $snapshots = CitySnapshot::where('snapshot_at', '>=', $start)
                ->orderBy('snapshot_at')
                ->get(['snapshot_at', 'traffic_congestion_global', 'bicing_availability_global', 'air_quality_index', 'weather_temp'])
                ->all();

            // Index snapshots by bucket (epoch seconds aligned to stepMin) for O(1) lookup.
            $stepSec  = $stepMin * 60;
            $buckets  = [];
            foreach ($snapshots as $s) {
                $ts  = Carbon::parse($s->snapshot_at)->getTimestamp();
                $key = intdiv($ts, $stepSec) * $stepSec;
                // Keep the most recent snapshot per bucket.
                $buckets[$key] = $s;
            }

            $points    = [];
            $startSec  = intdiv($start->getTimestamp(), $stepSec) * $stepSec;
            $endSec    = $end->getTimestamp();

            for ($t = $startSec; $t <= $endSec; $t += $stepSec) {
                $s = $buckets[$t] ?? null;

                $points[] = [
                    'timestamp'           => Carbon::createFromTimestamp($t)->toIso8601String(),
                    'traffic_congestion'  => $s !== null ? (int) $s->traffic_congestion_global  : null,
                    'bicing_availability' => $s !== null ? (int) $s->bicing_availability_global : null,
                    'air_index'           => $s !== null && $s->air_quality_index !== null ? (int) $s->air_quality_index : null,
                    'weather_temp'        => $s !== null && $s->weather_temp      !== null ? (float) $s->weather_temp     : null,
                ];
            }

            return $points;
        });
    }

    /**
     * @return array<int, array<string, mixed>>|null
     */
    private function trafficAt(Carbon $at): ?array
    {
        $nearest = TrafficSnapshot::orderByRaw('ABS(EXTRACT(EPOCH FROM (snapshot_at - ?))) ASC', [$at->toDateTimeString()])
            ->limit(1)
            ->value('snapshot_at');

        if ($nearest === null) {
            return null;
        }

        $nearestAt = Carbon::parse($nearest);
        if (abs($nearestAt->diffInSeconds($at)) > self::MAX_DELTA_MIN * 60) {
            return null;
        }

        return TrafficSnapshot::where('snapshot_at', $nearestAt)
            ->get(['snapshot_at', 'tramo_id', 'tramo_name', 'lat_start', 'lng_start', 'lat_end', 'lng_end', 'estado', 'velocidad_media'])
            ->toArray();
    }

    /**
     * @return array<int, array<string, mixed>>|null
     */
    private function bicingAt(Carbon $at): ?array
    {
        $nearest = BicingSnapshot::orderByRaw('ABS(EXTRACT(EPOCH FROM (snapshot_at - ?))) ASC', [$at->toDateTimeString()])
            ->limit(1)
            ->value('snapshot_at');

        if ($nearest === null) {
            return null;
        }

        $nearestAt = Carbon::parse($nearest);
        if (abs($nearestAt->diffInSeconds($at)) > self::MAX_DELTA_MIN * 60) {
            return null;
        }

        return BicingSnapshot::where('snapshot_at', $nearestAt)->get()->toArray();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function cityAt(Carbon $at): ?array
    {
        $nearest = CitySnapshot::orderByRaw('ABS(EXTRACT(EPOCH FROM (snapshot_at - ?))) ASC', [$at->toDateTimeString()])
            ->limit(1)
            ->first();

        if ($nearest === null) {
            return null;
        }

        $nearestAt = Carbon::parse($nearest->snapshot_at);
        if (abs($nearestAt->diffInSeconds($at)) > self::MAX_DELTA_MIN * 60) {
            return null;
        }

        return $nearest->toArray();
    }
}
