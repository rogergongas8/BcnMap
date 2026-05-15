<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CitySnapshot;
use App\Services\HistorySnapshotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class SnapshotController extends Controller
{
    public function __construct(private HistorySnapshotService $history) {}

    public function at(Request $request): JsonResponse
    {
        $data = $request->validate([
            'timestamp'        => ['sometimes', 'string'],
            'relative_minutes' => ['sometimes', 'integer', 'min:0', 'max:1440'],
        ]);

        if (isset($data['relative_minutes'])) {
            $at = Carbon::now()->subMinutes((int) $data['relative_minutes']);
        } elseif (isset($data['timestamp'])) {
            try {
                $at = Carbon::parse($data['timestamp']);
            } catch (\Throwable) {
                return response()->json(['error' => 'invalid timestamp'], 422);
            }
        } else {
            return response()->json(['error' => 'timestamp or relative_minutes required'], 422);
        }

        return response()->json($this->history->snapshotAt($at));
    }

    public function range(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from'  => ['sometimes', 'string'],
            'to'    => ['sometimes', 'string'],
            'hours' => ['sometimes', 'integer', 'min:1', 'max:48'],
            'step'  => ['sometimes', 'integer', 'min:1', 'max:60'],
        ]);

        $stepMin = (int) ($data['step'] ?? 15);

        if (isset($data['from']) || isset($data['to'])) {
            try {
                $to   = isset($data['to'])   ? Carbon::parse($data['to'])   : Carbon::now();
                $from = isset($data['from']) ? Carbon::parse($data['from']) : (clone $to)->subHours(6);
            } catch (\Throwable) {
                return response()->json(['error' => 'invalid date range'], 422);
            }

            if ($from->greaterThanOrEqualTo($to)) {
                return response()->json(['error' => 'from must be earlier than to'], 422);
            }

            $buckets = $this->bucketsBetween($from, $to, $stepMin);
        } else {
            $hours   = (int) ($data['hours'] ?? 6);
            $buckets = $this->bucketsLastHours($hours, $stepMin);
        }

        return response()->json(['buckets' => $buckets]);
    }

    /**
     * @return list<array{ts:string,congestion:?int,bicing_avail:?int,temp:?float,aqi:?int}>
     */
    private function bucketsLastHours(int $hours, int $stepMin): array
    {
        $cacheKey = sprintf('snapshot:range:hours:%d:%d', $hours, $stepMin);

        return Cache::remember($cacheKey, 60, function () use ($hours, $stepMin) {
            $end   = Carbon::now();
            $start = (clone $end)->subHours($hours);

            return $this->buildBuckets($start, $end, $stepMin);
        });
    }

    /**
     * @return list<array{ts:string,congestion:?int,bicing_avail:?int,temp:?float,aqi:?int}>
     */
    private function bucketsBetween(Carbon $from, Carbon $to, int $stepMin): array
    {
        return $this->buildBuckets($from, $to, $stepMin);
    }

    /**
     * @return list<array{ts:string,congestion:?int,bicing_avail:?int,temp:?float,aqi:?int}>
     */
    private function buildBuckets(Carbon $start, Carbon $end, int $stepMin): array
    {
        $snapshots = CitySnapshot::whereBetween('snapshot_at', [$start, $end])
            ->orderBy('snapshot_at')
            ->get(['snapshot_at', 'traffic_congestion_global', 'bicing_availability_global', 'air_quality_index', 'weather_temp'])
            ->all();

        $stepSec = $stepMin * 60;
        $bins    = [];

        foreach ($snapshots as $s) {
            $ts  = Carbon::parse($s->snapshot_at)->getTimestamp();
            $key = intdiv($ts, $stepSec) * $stepSec;
            $bins[$key][] = $s;
        }

        $points   = [];
        $startSec = intdiv($start->getTimestamp(), $stepSec) * $stepSec;
        $endSec   = $end->getTimestamp();

        for ($t = $startSec; $t <= $endSec; $t += $stepSec) {
            $group = $bins[$t] ?? null;

            if ($group === null) {
                $points[] = [
                    'ts'           => Carbon::createFromTimestamp($t)->toIso8601String(),
                    'congestion'   => null,
                    'bicing_avail' => null,
                    'temp'         => null,
                    'aqi'          => null,
                ];
                continue;
            }

            $count        = count($group);
            $sumCong      = 0;
            $sumBic       = 0;
            $sumTemp      = 0.0;
            $tempCount    = 0;
            $sumAqi       = 0;
            $aqiCount     = 0;

            foreach ($group as $s) {
                $sumCong += (int) $s->traffic_congestion_global;
                $sumBic  += (int) $s->bicing_availability_global;
                if ($s->weather_temp !== null) {
                    $sumTemp += (float) $s->weather_temp;
                    $tempCount++;
                }
                if ($s->air_quality_index !== null) {
                    $sumAqi += (int) $s->air_quality_index;
                    $aqiCount++;
                }
            }

            $points[] = [
                'ts'           => Carbon::createFromTimestamp($t)->toIso8601String(),
                'congestion'   => (int) round($sumCong / $count),
                'bicing_avail' => (int) round($sumBic / $count),
                'temp'         => $tempCount > 0 ? round($sumTemp / $tempCount, 1) : null,
                'aqi'          => $aqiCount  > 0 ? (int) round($sumAqi  / $aqiCount)  : null,
            ];
        }

        return $points;
    }
}
