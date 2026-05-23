<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\EventsEnrichmentService;
use App\Services\EventsService;
use App\Services\SongkickService;
use App\Services\TicketmasterService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class RefreshEvents extends Command
{
    protected $signature   = 'events:refresh';
    protected $description = 'Refresh BCN and Ticketmaster events (runs every 6 hours)';

    public function __construct(
        private EventsService           $bcnEvents,
        private TicketmasterService     $ticketmaster,
        private SongkickService         $songkick,
        private EventsEnrichmentService $enrichment,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('Refreshing BCN events...');
        $bcn = $this->bcnEvents->fetch();
        $this->info('BCN: ' . count($bcn) . ' events');

        $this->info('Refreshing Ticketmaster events...');
        $tm = $this->ticketmaster->fetch();
        $this->info('Ticketmaster: ' . count($tm) . ' events');

        $this->info('Refreshing Songkick events...');
        $sk = $this->songkick->fetch();
        $this->info('Songkick: ' . count($sk) . ' events');

        // Clear enriched cache so next request rebuilds with fresh data
        Cache::forget('events:enriched:current');

        $merged = $this->enrichment->current();
        $this->info('Merged + enriched: ' . count($merged) . ' events');

        return self::SUCCESS;
    }
}
