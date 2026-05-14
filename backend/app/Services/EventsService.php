<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EventsService
{
    private const RESOURCE_ID   = '3abb2414-1ee0-446e-9c25-380e938adb73';
    private const API_URL       = 'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search';
    private const CACHE_KEY     = 'bcn:events:current';
    private const CACHE_TTL     = 3600;
    // Only include events that start within this many days from now
    private const MAX_FUTURE_DAYS = 30;

    public function fetch(): array
    {
        try {
            $response = Http::timeout(15)->get(self::API_URL, [
                'resource_id' => self::RESOURCE_ID,
                'limit'       => 20,
            ]);

            if (!$response->successful()) {
                Log::warning('EventsService: API returned ' . $response->status());
                return [];
            }

            $records  = $response->json('result.records', []);
            $now      = now();
            $cutoff   = $now->copy()->addDays(self::MAX_FUTURE_DAYS);
            $events   = [];

            foreach ($records as $r) {
                $name = $this->cleanText($r['name'] ?? '');
                if (!$name) continue;

                $startRaw = $r['start_date'] ?? '';
                $endRaw   = $r['end_date']   ?? '';

                $start = $startRaw ? $now->copy()->parse($startRaw) : null;
                $end   = $endRaw   ? $now->copy()->parse($endRaw)   : null;

                // Skip events already ended
                if ($end && $end->isPast()) continue;

                // Skip events that start more than MAX_FUTURE_DAYS away
                if ($start && $start->isAfter($cutoff)) continue;

                // Skip events with no date info at all
                if (!$start && !$end) continue;

                $category = $this->cleanText($r['secondary_filters_name'] ?? '');
                $place    = $this->cleanText($r['institution_name'] ?? '');
                $district = $this->cleanText($r['addresses_district_name'] ?? '');

                $events[] = [
                    'title'    => $name,
                    'category' => $category,
                    'place'    => $place,
                    'district' => $district,
                    'start'    => $start?->format('Y-m-d'),
                    'end'      => $end?->format('Y-m-d'),
                ];
            }

            Cache::put(self::CACHE_KEY, $events, self::CACHE_TTL);
            return $events;

        } catch (\Throwable $e) {
            Log::warning('EventsService exception: ' . $e->getMessage());
            return [];
        }
    }

    public function getCurrent(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    public function getSummaryForContext(): string
    {
        $events = $this->getCurrent();
        if (empty($events)) return '';

        $today = now()->format('Y-m-d');
        $lines = [];

        foreach (array_slice($events, 0, 6) as $e) {
            $line = $e['title'];

            // Add temporal context so the AI can say "este fin de semana" vs "en junio"
            if ($e['start'] && $e['start'] > $today) {
                $line .= ' (a partir del ' . $e['start'] . ')';
            } elseif ($e['end']) {
                $line .= ' (hasta el ' . $e['end'] . ')';
            }

            $loc = array_filter([$e['place'], $e['district']]);
            if ($loc) $line .= ' — ' . implode(', ', $loc);

            $lines[] = $line;
        }

        return implode('. ', $lines);
    }

    private function cleanText(string $text): string
    {
        $text = trim($text);
        // Remove only surrounding double-quotes (CSV artefact); single quotes are part of BCN event title format
        $text = preg_replace('/^"+|"+$/', '', $text);
        $text = str_replace('""', '', $text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Skip values that are just a numeric district code
        if (preg_match('/^\d+$/', trim($text))) return '';
        return trim(preg_replace('/\s+/', ' ', $text));
    }
}
