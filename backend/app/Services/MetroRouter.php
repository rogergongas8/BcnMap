<?php
declare(strict_types=1);
namespace App\Services;

use Illuminate\Support\Facades\Cache;

class MetroRouter
{
    private array $stationMap = [];   // station_id => station data
    private array $adjacency  = [];   // station_id => [neighbor_id => line_name]
    private array $lineData   = [];   // line_name  => {color, geometry}

    public function __construct()
    {
        $this->build();
    }

    private function build(): void
    {
        $stations = Cache::get('metro:stations', []);
        $lines    = Cache::get('metro:lines',    []);

        foreach ($stations as $s) {
            if (($s['type'] ?? '') === 'metro') {
                $this->stationMap[$s['station_id']] = $s;
            }
        }

        foreach ($lines as $l) {
            $this->lineData[$l['name']] = $l;
        }

        // Group stations by line, sort along line geometry, connect adjacent pairs
        $lineStations = [];
        foreach ($this->stationMap as $s) {
            foreach ($s['lines'] as $li) {
                $lineStations[$li['name']][] = $s;
            }
        }

        foreach ($lineStations as $lineName => $stns) {
            $coords = $this->lineCoords($lineName);
            if (count($coords) < 2) continue;

            usort($stns, fn($a, $b) =>
                $this->project((float)$a['lat'], (float)$a['lng'], $coords) <=>
                $this->project((float)$b['lat'], (float)$b['lng'], $coords)
            );

            for ($i = 0; $i < count($stns) - 1; $i++) {
                $aId = $stns[$i]['station_id'];
                $bId = $stns[$i + 1]['station_id'];
                $this->adjacency[$aId][$bId] ??= $lineName;
                $this->adjacency[$bId][$aId] ??= $lineName;
            }
        }
    }

    /** Safely extract the coordinate array for a line, handling both LineString and MultiLineString. */
    private function lineCoords(string $lineName): array
    {
        $geo = $this->lineData[$lineName]['geometry'] ?? [];
        if (empty($geo)) return [];
        return ($geo['type'] ?? '') === 'MultiLineString'
            ? ($geo['coordinates'][0] ?? [])
            : ($geo['coordinates'] ?? []);
    }

    /** Project lat/lng onto a polyline; returns cumulative arc-length parameter. */
    private function project(float $lat, float $lng, array $coords): float
    {
        $best   = PHP_FLOAT_MAX;
        $bestT  = 0.0;
        $cumLen = 0.0;

        for ($i = 0; $i < count($coords) - 1; $i++) {
            [$ax, $ay] = [$coords[$i][0],     $coords[$i][1]];
            [$bx, $by] = [$coords[$i + 1][0], $coords[$i + 1][1]];
            $dx = $bx - $ax; $dy = $by - $ay;
            $len2 = $dx * $dx + $dy * $dy;
            if ($len2 < 1e-20) { $cumLen += sqrt($len2); continue; }

            $t  = max(0.0, min(1.0, (($lng - $ax) * $dx + ($lat - $ay) * $dy) / $len2));
            $px = $ax + $t * $dx; $py = $ay + $t * $dy;
            $d  = ($lng - $px) ** 2 + ($lat - $py) ** 2;

            if ($d < $best) { $best = $d; $bestT = $cumLen + $t * sqrt($len2); }
            $cumLen += sqrt($len2);
        }

        return $bestT;
    }

    /**
     * BFS from originStation to destStation on the metro graph.
     * Returns array of legs [{line, from_station, to_station}] or null if unreachable.
     */
    public function route(array $originStation, array $destStation): ?array
    {
        $srcId = $originStation['station_id'];
        $dstId = $destStation['station_id'];

        if ($srcId === $dstId) return null;
        if (!isset($this->stationMap[$srcId]) || !isset($this->stationMap[$dstId])) return null;

        // visited[id] = [prev_id, line] or null for source
        // Use array_key_exists (not isset) — isset returns false for null values
        $visited = [$srcId => null];
        $queue   = [$srcId];

        while (!empty($queue)) {
            $cur = array_shift($queue);
            if ($cur === $dstId) break;
            foreach ($this->adjacency[$cur] ?? [] as $next => $line) {
                if (!array_key_exists($next, $visited)) {
                    $visited[$next] = [$cur, $line];
                    $queue[] = $next;
                }
            }
        }

        if (!array_key_exists($dstId, $visited)) return null;

        // Reconstruct raw path of [from_id, to_id, line]
        $path = [];
        $cur  = $dstId;
        while ($visited[$cur] !== null) {
            [$prev, $line] = $visited[$cur];
            $path[] = [$prev, $cur, $line];
            $cur    = $prev;
        }
        $path = array_reverse($path);

        // Group consecutive same-line hops into legs
        $legs = [];
        $i    = 0;
        $n    = count($path);
        while ($i < $n) {
            $line    = $path[$i][2];
            $legFrom = $path[$i][0];
            $legTo   = $path[$i][1];
            $j       = $i + 1;
            while ($j < $n && $path[$j][2] === $line) {
                $legTo = $path[$j][1];
                $j++;
            }
            $legs[] = [
                'line'         => $line,
                'from_station' => $this->stationMap[$legFrom],
                'to_station'   => $this->stationMap[$legTo],
            ];
            $i = $j;
        }

        return $legs;
    }

    /**
     * Extract real GeoJSON LineString for a leg between two stations on a line.
     */
    public function legGeometry(string $lineName, array $fromStation, array $toStation): array
    {
        $coords = $this->lineCoords($lineName);
        $fallback = ['type' => 'LineString', 'coordinates' => [
            [(float)$fromStation['lng'], (float)$fromStation['lat']],
            [(float)$toStation['lng'],   (float)$toStation['lat']],
        ]];

        if (count($coords) < 2) return $fallback;

        $tFrom = $this->project((float)$fromStation['lat'], (float)$fromStation['lng'], $coords);
        $tTo   = $this->project((float)$toStation['lat'],   (float)$toStation['lng'],   $coords);

        $forward = $tFrom <= $tTo;
        $tMin    = min($tFrom, $tTo);
        $tMax    = max($tFrom, $tTo);

        // Collect polyline vertices that fall strictly inside [tMin, tMax]
        $middle = [];
        $cum    = 0.0;
        for ($i = 0; $i < count($coords) - 1; $i++) {
            [$ax, $ay] = [$coords[$i][0],     $coords[$i][1]];
            [$bx, $by] = [$coords[$i + 1][0], $coords[$i + 1][1]];
            $segLen = sqrt(($bx - $ax) ** 2 + ($by - $ay) ** 2);
            $segEnd = $cum + $segLen;

            if ($segEnd > $tMin && $cum < $tMax && $segEnd <= $tMax) {
                $middle[] = [$bx, $by];
            }
            $cum += $segLen;
        }

        $result = array_merge(
            [[(float)$fromStation['lng'], (float)$fromStation['lat']]],
            $forward ? $middle : array_reverse($middle),
            [[(float)$toStation['lng'],   (float)$toStation['lat']]]
        );

        return ['type' => 'LineString', 'coordinates' => $result];
    }

    public function lineColor(string $lineName): string
    {
        $c = $this->lineData[$lineName]['color'] ?? '#ff6b35';
        return str_starts_with($c, '#') ? $c : '#' . $c;
    }
}
