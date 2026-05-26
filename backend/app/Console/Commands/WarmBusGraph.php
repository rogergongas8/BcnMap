<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\BusRouter;
use Illuminate\Console\Command;

class WarmBusGraph extends Command
{
    protected $signature   = 'bus:warm-graph';
    protected $description = 'Build and cache the bus stop routing graph from TMB API (runs ~20 s, cached 24 h)';

    public function handle(): int
    {
        $this->info('Building bus routing graph from TMB API…');
        $start  = microtime(true);
        $router = new BusRouter();
        $router->buildAndCache();

        $elapsed = round(microtime(true) - $start, 1);
        $this->info("Done in {$elapsed}s — graph ready for bus routing.");

        return self::SUCCESS;
    }
}
