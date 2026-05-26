<?php
declare(strict_types=1);
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BusRouter
{
    private const BASE             = 'https://api.tmb.cat/v1';
    private const CACHE_KEY        = 'bus:router:graph';
    private const CACHE_TTL        = 86400;  // 24h
    private const TRANSFER_PENALTY = 180;    // 3 min per line change
    public  const BUS_SPEED_MS     = 4.2;    // ~15 km/h average BCN

    private array $stopMap   = [];   // stop_id => stop data
    private array $adjacency = [];   // stop_id => [neighbor_id => [line_id => line_id]]
    private array $lineData  = [];   // line_id => {name, id}

    public function __construct()
    {
        $graph = Cache::get(self::CACHE_KEY);
        if ($graph !== null) {
            $this->stopMap   = $graph['stopMap']   ?? [];
            $this->adjacency = $graph['adjacency'] ?? [];
            $this->lineData  = $graph['lineData']  ?? [];
        }
        // If cache is empty the router will be marked empty — caller should check isEmpty().
        // Run `php artisan bus:warm-graph` or wait for scheduler to pre-warm.
    }

    private function auth(): array
    {
        return [
            'app_id'  => config('services.tmb.app_id'),
            'app_key' => config('services.tmb.app_key'),
        ];
    }

    public function isEmpty(): bool
    {
        return empty($this->stopMap);
    }

    // ── Graph build ───────────────────────────────────────────────────────────

    /**
     * Build and cache the full bus stop graph from TMB API.
     * Called once per day by the scheduler or artisan command.
     */
    public function buildAndCache(): void
    {
        $graph = $this->buildGraph();
        if (!empty($graph['stopMap'])) {
            Cache::put(self::CACHE_KEY, $graph, self::CACHE_TTL);
            $this->stopMap   = $graph['stopMap'];
            $this->adjacency = $graph['adjacency'];
            $this->lineData  = $graph['lineData'];
            Log::info('BusRouter: graph cached — ' . count($graph['stopMap']) . ' stops, ' . count($graph['lineData']) . ' lines');
        }
    }

    private function buildGraph(): array
    {
        // 1. Fetch all bus lines
        $linesRes = Http::timeout(20)->get(self::BASE . '/transit/linies/bus', $this->auth());
        if (!$linesRes->successful()) {
            Log::warning('BusRouter: failed to fetch bus lines (HTTP ' . $linesRes->status() . ')');
            return ['stopMap' => [], 'adjacency' => [], 'lineData' => []];
        }

        $lines = [];
        foreach ($linesRes->json('features') ?? [] as $f) {
            $props = $f['properties'] ?? [];
            $id    = (string)($props['CODI_LINIA'] ?? '');
            $name  = $props['NOM_LINIA'] ?? $id;
            if (!$id) continue;
            $lines[$id] = ['id' => $id, 'name' => $name];
        }

        if (empty($lines)) {
            Log::warning('BusRouter: no bus lines returned from TMB');
            return ['stopMap' => [], 'adjacency' => [], 'lineData' => []];
        }

        // 2. Fetch stops for all lines in parallel batches
        $lineIds    = array_keys($lines);
        $batchSize  = 15;
        $lineStops  = [];   // line_id => [stops in order]

        for ($i = 0; $i < count($lineIds); $i += $batchSize) {
            $batch = array_slice($lineIds, $i, $batchSize);

            $responses = Http::pool(function ($pool) use ($batch) {
                $requests = [];
                foreach ($batch as $id) {
                    // Prefix with 'L' so PHP does not coerce numeric string keys to integers
                    $requests[] = $pool->as('L' . $id)->timeout(12)->get(
                        self::BASE . '/transit/linies/bus/' . $id . '/parades',
                        $this->auth()
                    );
                }
                return $requests;
            });

            foreach ($responses as $key => $response) {
                $lineId = substr((string)$key, 1); // strip 'L' prefix
                if (!($response instanceof \Illuminate\Http\Client\Response) || !$response->successful()) continue;

                $stops = [];
                foreach ($response->json('features') ?? [] as $f) {
                    $props  = $f['properties'] ?? [];
                    $coords = $f['geometry']['coordinates'] ?? null;
                    if (!$coords || count($coords) < 2) continue;
                    $stopId = (string)($props['CODI_PARADA'] ?? '');
                    if (!$stopId) continue;
                    $stops[] = [
                        'stop_id'   => $stopId,
                        'stop_name' => $props['NOM_PARADA'] ?? '',
                        'lat'       => (float)$coords[1],
                        'lng'       => (float)$coords[0],
                        'order'     => (int)($props['ORDRE_PARADA'] ?? $props['ORDRE'] ?? count($stops)),
                    ];
                }

                usort($stops, fn($a, $b) => $a['order'] <=> $b['order']);

                if (count($stops) >= 2) {
                    $lineStops[$lineId] = $stops;
                }
            }
        }

        // 3. Build adjacency graph
        $stopMap   = [];
        $adjacency = [];
        $lineData  = [];

        foreach ($lineStops as $lineId => $stops) {
            $lineData[$lineId] = $lines[$lineId];

            foreach ($stops as $stop) {
                $sid = $stop['stop_id'];
                if (!isset($stopMap[$sid])) {
                    $stopMap[$sid] = $stop;
                }
            }

            for ($i = 0; $i < count($stops) - 1; $i++) {
                $aId = $stops[$i]['stop_id'];
                $bId = $stops[$i + 1]['stop_id'];
                // Bidirectional — real-world bus lines have separate inbound/outbound routes
                // but this approximation gives good routing results
                $adjacency[$aId][$bId][$lineId] = $lineId;
                $adjacency[$bId][$aId][$lineId] = $lineId;
            }
        }

        return ['stopMap' => $stopMap, 'adjacency' => $adjacency, 'lineData' => $lineData];
    }

    // ── Spatial helpers ───────────────────────────────────────────────────────

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R  = 6371000;
        $φ1 = deg2rad($lat1); $φ2 = deg2rad($lat2);
        $Δφ = deg2rad($lat2 - $lat1); $Δλ = deg2rad($lng2 - $lng1);
        $a  = sin($Δφ / 2) ** 2 + cos($φ1) * cos($φ2) * sin($Δλ / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Find N nearest stops to a given coordinate, optionally within maxDist metres.
     */
    public function nearestStops(float $lat, float $lng, int $n = 5, float $maxDist = 800.0): array
    {
        if (empty($this->stopMap)) return [];

        $candidates = [];
        foreach ($this->stopMap as $stop) {
            $d = $this->haversine($lat, $lng, (float)$stop['lat'], (float)$stop['lng']);
            if ($d <= $maxDist) {
                $candidates[] = ['stop' => $stop, 'dist' => $d];
            }
        }

        usort($candidates, fn($a, $b) => $a['dist'] <=> $b['dist']);
        return array_column(array_slice($candidates, 0, $n), 'stop');
    }

    // ── Routing ───────────────────────────────────────────────────────────────

    /**
     * Dijkstra from fromStop to toStop.
     * Returns [{line, line_name, from_stop, to_stop}] legs or null if unreachable.
     */
    public function route(array $fromStop, array $toStop): ?array
    {
        $srcId = $fromStop['stop_id'];
        $dstId = $toStop['stop_id'];

        if ($srcId === $dstId) return null;
        if (!isset($this->stopMap[$srcId]) || !isset($this->stopMap[$dstId])) return null;

        // Bounding box pruning: skip stops that are too far from the corridor
        $straightDist = $this->haversine(
            (float)$fromStop['lat'], (float)$fromStop['lng'],
            (float)$toStop['lat'],   (float)$toStop['lng']
        );
        $maxCost = ($straightDist / self::BUS_SPEED_MS) * 3.0 + 600; // 3× direct time + 10 min buffer

        $INF  = PHP_FLOAT_MAX;
        $cost = [];
        $prev = [];

        $pq = new \SplMinHeap();
        $pq->insert([0.0, $srcId, null]);
        $cost[$srcId]['__start__'] = 0.0;

        while (!$pq->isEmpty()) {
            [$curCost, $curId, $curLine] = $pq->extract();

            if ($curId === $dstId) break;
            if ($curCost > $maxCost) continue;

            $lineKey   = $curLine ?? '__start__';
            $bestSoFar = $cost[$curId][$lineKey] ?? $INF;
            if ($curCost > $bestSoFar + 0.01) continue;

            foreach ($this->adjacency[$curId] ?? [] as $nextId => $lines) {
                $nextStop = $this->stopMap[$nextId] ?? null;
                if (!$nextStop) continue;

                $dist       = $this->haversine(
                    (float)$this->stopMap[$curId]['lat'], (float)$this->stopMap[$curId]['lng'],
                    (float)$nextStop['lat'],              (float)$nextStop['lng']
                );
                $travelTime = $dist / self::BUS_SPEED_MS;

                foreach ($lines as $edgeLine) {
                    $transfer = ($curLine !== null && $curLine !== $edgeLine)
                        ? self::TRANSFER_PENALTY
                        : 0.0;
                    $newCost  = $curCost + $travelTime + $transfer;

                    $prevBest = $cost[$nextId][$edgeLine] ?? $INF;
                    if ($newCost < $prevBest) {
                        $cost[$nextId][$edgeLine] = $newCost;
                        $prev[$nextId][$edgeLine] = [$curId, $curLine, $edgeLine];
                        $pq->insert([$newCost, $nextId, $edgeLine]);
                    }
                }
            }
        }

        if (empty($cost[$dstId])) return null;

        $bestLine = null;
        $bestCost = $INF;
        foreach ($cost[$dstId] as $line => $c) {
            if ($c < $bestCost) { $bestCost = $c; $bestLine = $line; }
        }
        if ($bestLine === null) return null;

        // Reconstruct path
        $path    = [];
        $curId   = $dstId;
        $curLine = $bestLine;
        while (isset($prev[$curId][$curLine])) {
            [$prevId, $prevLine, $edgeLine] = $prev[$curId][$curLine];
            $path[]  = [$prevId, $curId, $edgeLine];
            $curId   = $prevId;
            $curLine = $prevLine;
        }
        $path = array_reverse($path);

        if (empty($path)) return null;

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
                'line'      => $line,
                'line_name' => $this->lineData[$line]['name'] ?? $line,
                'from_stop' => $this->stopMap[$legFrom],
                'to_stop'   => $this->stopMap[$legTo],
            ];
            $i = $j;
        }

        return $legs;
    }

    /**
     * Straight-line geometry for a bus leg (no actual route shape available from TMB).
     */
    public function legGeometry(array $from, array $to): array
    {
        return ['type' => 'LineString', 'coordinates' => [
            [(float)$from['lng'], (float)$from['lat']],
            [(float)$to['lng'],   (float)$to['lat']],
        ]];
    }

    public function lineColor(): string
    {
        return '#00b4ff';
    }

    public function lineName(string $lineId): string
    {
        return $this->lineData[$lineId]['name'] ?? $lineId;
    }
}
