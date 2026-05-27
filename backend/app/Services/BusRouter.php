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
    private const TRANSFER_PENALTY = 480;    // 8 min per line change (realistic wait)
    public  const BUS_SPEED_MS     = 4.2;    // ~15 km/h average BCN

    private array $stopMap       = [];   // stop_id => stop data
    private array $adjacency     = [];   // stop_id => [neighbor_id => [recKey => recKey]]
    private array $lineData      = [];   // recKey => {name, id}
    private array $stopSequences = [];   // recKey => [stop_id, ...] in route order

    public function __construct()
    {
        $graph = Cache::get(self::CACHE_KEY);
        if ($graph !== null) {
            $this->stopMap       = $graph['stopMap']       ?? [];
            $this->adjacency     = $graph['adjacency']     ?? [];
            $this->lineData      = $graph['lineData']      ?? [];
            $this->stopSequences = $graph['stopSequences'] ?? [];
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

        // 2. Fetch stops for all lines in parallel batches.
        //    Each API response contains stops for ALL recorreguts (directions) of a line.
        //    We group by ID_RECORREGUT so each direction becomes its own unidirectional sequence.
        $lineIds   = array_keys($lines);
        $batchSize = 15;
        // recorregutId => ['lineId' => ..., 'lineName' => ..., 'stops' => [...ordered...]]
        $recorreguts = [];

        for ($i = 0; $i < count($lineIds); $i += $batchSize) {
            $batch = array_slice($lineIds, $i, $batchSize);

            $responses = Http::pool(function ($pool) use ($batch) {
                $requests = [];
                foreach ($batch as $id) {
                    $requests[] = $pool->as('L' . $id)->timeout(12)->get(
                        self::BASE . '/transit/linies/bus/' . $id . '/parades',
                        $this->auth()
                    );
                }
                return $requests;
            });

            foreach ($responses as $key => $response) {
                $lineId = substr((string)$key, 1);
                if (!($response instanceof \Illuminate\Http\Client\Response) || !$response->successful()) continue;

                // Group stops by recorregut (direction)
                $byRecorregut = [];
                foreach ($response->json('features') ?? [] as $f) {
                    $props  = $f['properties'] ?? [];
                    $coords = $f['geometry']['coordinates'] ?? null;
                    if (!$coords || count($coords) < 2) continue;
                    $stopId     = (string)($props['CODI_PARADA'] ?? '');
                    $recorregut = (string)($props['ID_RECORREGUT'] ?? $props['ID_SENTIT'] ?? '1');
                    if (!$stopId) continue;

                    $byRecorregut[$recorregut][] = [
                        'stop_id'   => $stopId,
                        'stop_name' => $props['NOM_PARADA'] ?? '',
                        'lat'       => (float)$coords[1],
                        'lng'       => (float)$coords[0],
                        'order'     => (int)($props['ORDRE'] ?? $props['ORDRE_PARADA'] ?? 0),
                    ];
                }

                foreach ($byRecorregut as $recId => $stops) {
                    usort($stops, fn($a, $b) => $a['order'] <=> $b['order']);
                    if (count($stops) >= 2) {
                        $recKey = $lineId . '_' . $recId;
                        $recorreguts[$recKey] = [
                            'lineId'   => $lineId,
                            'lineName' => $lines[$lineId]['name'] ?? $lineId,
                            'stops'    => $stops,
                        ];
                    }
                }
            }
        }

        // 3. Build adjacency graph — unidirectional per recorregut
        $stopMap       = [];
        $adjacency     = [];
        $lineData      = [];
        $stopSequences = [];   // recKey => [stop_id, ...]

        foreach ($recorreguts as $recKey => $rec) {
            $lineData[$recKey] = ['id' => $rec['lineId'], 'name' => $rec['lineName']];

            $sequence = [];
            foreach ($rec['stops'] as $stop) {
                $sid = $stop['stop_id'];
                if (!isset($stopMap[$sid])) {
                    $stopMap[$sid] = $stop;
                }
                $sequence[] = $sid;
            }
            $stopSequences[$recKey] = $sequence;

            for ($i = 0; $i < count($sequence) - 1; $i++) {
                $aId = $sequence[$i];
                $bId = $sequence[$i + 1];
                $adjacency[$aId][$bId][$recKey] = $recKey;
            }
        }

        return [
            'stopMap'       => $stopMap,
            'adjacency'     => $adjacency,
            'lineData'      => $lineData,
            'stopSequences' => $stopSequences,
        ];
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
     * A* from $fromStop toward ($destLat, $destLng).
     *
     * The alighting stop is chosen dynamically: any stop within $maxWalkToExit
     * metres of the destination qualifies. The algorithm picks the stop that
     * minimises total cost = bus_travel + transfers + walk_to_destination.
     *
     * Returns ['legs' => [...], 'alight_stop' => [...]] or null if unreachable.
     */
    public function route(
        array $fromStop,
        float $destLat,
        float $destLng,
        float $maxWalkToExit = 700.0
    ): ?array {
        $srcId = $fromStop['stop_id'];
        if (!isset($this->stopMap[$srcId])) return null;

        $straightDist = $this->haversine(
            (float)$fromStop['lat'], (float)$fromStop['lng'],
            $destLat, $destLng
        );
        // Budget: 4× direct bus time + 10 min. Capped at 50 min.
        $maxGCost = min(($straightDist / self::BUS_SPEED_MS) * 4.0 + 600, 3000.0);

        $INF = PHP_FLOAT_MAX;
        $cost = [];
        $prev = [];

        // A* priority queue ordered by f = g + h
        $pq = new \SplMinHeap();
        $h0 = $this->haversine((float)$fromStop['lat'], (float)$fromStop['lng'], $destLat, $destLng) / self::BUS_SPEED_MS;
        $pq->insert([$h0, 0.0, $srcId, null]);
        $cost[$srcId]['__start__'] = 0.0;

        $bestTotalCost  = $INF;
        $bestAlightId   = null;
        $bestAlightLine = null;

        while (!$pq->isEmpty()) {
            [$fCost, $gCost, $curId, $curLine] = $pq->extract();

            // Early exit: nothing in the queue can beat our best solution
            if ($fCost >= $bestTotalCost) break;
            if ($gCost > $maxGCost) continue;

            $lineKey   = $curLine ?? '__start__';
            $bestSoFar = $cost[$curId][$lineKey] ?? $INF;
            if ($gCost > $bestSoFar + 0.01) continue;

            // Check if alighting here is better than our current best
            $curStop  = $this->stopMap[$curId];
            $walkDist = $this->haversine((float)$curStop['lat'], (float)$curStop['lng'], $destLat, $destLng);
            if ($walkDist <= $maxWalkToExit) {
                $totalCost = $gCost + ($walkDist / 1.25); // walk at 1.25 m/s
                if ($totalCost < $bestTotalCost) {
                    $bestTotalCost  = $totalCost;
                    $bestAlightId   = $curId;
                    $bestAlightLine = $lineKey;
                }
            }

            foreach ($this->adjacency[$curId] ?? [] as $nextId => $lines) {
                $nextStop = $this->stopMap[$nextId] ?? null;
                if (!$nextStop) continue;

                $dist       = $this->haversine(
                    (float)$curStop['lat'], (float)$curStop['lng'],
                    (float)$nextStop['lat'], (float)$nextStop['lng']
                );
                $travelTime = $dist / self::BUS_SPEED_MS;

                foreach ($lines as $edgeLine) {
                    $transfer = ($curLine !== null && $curLine !== $edgeLine)
                        ? self::TRANSFER_PENALTY
                        : 0.0;
                    $newGCost = $gCost + $travelTime + $transfer;

                    if ($newGCost > $maxGCost) continue;

                    $prevBest = $cost[$nextId][$edgeLine] ?? $INF;
                    if ($newGCost < $prevBest) {
                        $cost[$nextId][$edgeLine] = $newGCost;
                        $prev[$nextId][$edgeLine] = [$curId, $curLine, $edgeLine];
                        // A* heuristic: haversine to destination / bus speed
                        $h = $this->haversine((float)$nextStop['lat'], (float)$nextStop['lng'], $destLat, $destLng) / self::BUS_SPEED_MS;
                        $pq->insert([$newGCost + $h, $newGCost, $nextId, $edgeLine]);
                    }
                }
            }
        }

        if ($bestAlightId === null) return null;

        // Reconstruct path to best alighting stop
        $path    = [];
        $curId   = $bestAlightId;
        $curLine = $bestAlightLine === '__start__' ? null : $bestAlightLine;

        // Walk back through prev[] — keys use line or '__start__'
        $walkKey = $curLine ?? '__start__';
        while (isset($prev[$curId][$walkKey])) {
            [$prevId, $prevLine, $edgeLine] = $prev[$curId][$walkKey];
            $path[]  = [$prevId, $curId, $edgeLine];
            $curId   = $prevId;
            $walkKey = $prevLine ?? '__start__';
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
                'rec_key'   => $line,   // same as line (= recorregut key)
                'from_stop' => $this->stopMap[$legFrom],
                'to_stop'   => $this->stopMap[$legTo],
            ];
            $i = $j;
        }

        return [
            'legs'        => $legs,
            'alight_stop' => $this->stopMap[$bestAlightId],
        ];
    }

    /**
     * Build geometry for a bus leg by threading through all real stops between
     * from_stop and to_stop on the given recorregut.
     * Falls back to straight line if the sequence cannot be found.
     */
    public function legGeometry(array $from, array $to, string $recKey = ''): array
    {
        $sequence = $this->stopSequences[$recKey] ?? [];
        if (!empty($sequence)) {
            $fromIdx = array_search($from['stop_id'], $sequence, true);
            $toIdx   = array_search($to['stop_id'],   $sequence, true);

            if ($fromIdx !== false && $toIdx !== false && $fromIdx < $toIdx) {
                $coords = [];
                for ($i = $fromIdx; $i <= $toIdx; $i++) {
                    $stop = $this->stopMap[$sequence[$i]] ?? null;
                    if ($stop) {
                        $coords[] = [(float)$stop['lng'], (float)$stop['lat']];
                    }
                }
                if (count($coords) >= 2) {
                    return ['type' => 'LineString', 'coordinates' => $coords];
                }
            }
        }

        // Fallback: straight line
        return ['type' => 'LineString', 'coordinates' => [
            [(float)$from['lng'], (float)$from['lat']],
            [(float)$to['lng'],   (float)$to['lat']],
        ]];
    }

    /**
     * Real distance along the stop sequence for a leg (sum of haversine between consecutive stops).
     */
    public function legDistance(array $from, array $to, string $recKey = ''): float
    {
        $sequence = $this->stopSequences[$recKey] ?? [];
        if (empty($sequence)) {
            return $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
        }

        $fromIdx = array_search($from['stop_id'], $sequence, true);
        $toIdx   = array_search($to['stop_id'],   $sequence, true);

        if ($fromIdx === false || $toIdx === false || $fromIdx >= $toIdx) {
            return $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
        }

        $total = 0.0;
        for ($i = $fromIdx; $i < $toIdx; $i++) {
            $a = $this->stopMap[$sequence[$i]]     ?? null;
            $b = $this->stopMap[$sequence[$i + 1]] ?? null;
            if ($a && $b) {
                $total += $this->haversine((float)$a['lat'], (float)$a['lng'], (float)$b['lat'], (float)$b['lng']);
            }
        }
        return $total ?: $this->haversine((float)$from['lat'], (float)$from['lng'], (float)$to['lat'], (float)$to['lng']);
    }

    /**
     * Returns the ordered stop coordinates (as [{lat, lng}]) for the
     * sub-sequence between $from and $to on the given recorregut.
     * Used by RouteService to request road-following geometry from Valhalla.
     */
    public function getStopsBetween(array $from, array $to, string $recKey): array
    {
        $sequence = $this->stopSequences[$recKey] ?? [];
        if (empty($sequence)) return [];

        $fromIdx = array_search($from['stop_id'], $sequence, true);
        $toIdx   = array_search($to['stop_id'],   $sequence, true);

        if ($fromIdx === false || $toIdx === false || $fromIdx >= $toIdx) return [];

        $stops = [];
        for ($i = $fromIdx; $i <= $toIdx; $i++) {
            $stop = $this->stopMap[$sequence[$i]] ?? null;
            if ($stop) {
                $stops[] = ['lat' => (float)$stop['lat'], 'lng' => (float)$stop['lng']];
            }
        }
        return $stops;
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
