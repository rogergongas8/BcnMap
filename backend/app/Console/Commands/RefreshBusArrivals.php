<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\BusService;
use Illuminate\Console\Command;

class RefreshBusArrivals extends Command
{
    protected $signature   = 'bus:refresh';
    protected $description = 'Refresh real-time bus arrivals cache from TMB iBus API';

    public function __construct(private BusService $bus)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->bus->refreshGlobalArrivals();
        $this->info('Bus arrivals refreshed at ' . now()->toTimeString());
        return self::SUCCESS;
    }
}
