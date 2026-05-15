<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\PoiService;
use Illuminate\Console\Command;

class RefreshPois extends Command
{
    protected $signature   = 'pois:refresh';
    protected $description = 'Refresh OpenStreetMap POIs cache for all supported categories';

    public function __construct(private PoiService $service)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        foreach (PoiService::categories() as $category) {
            $count = count($this->service->refresh($category));
            $this->info(sprintf('  %-12s %d POIs', $category, $count));
        }

        $this->info('POIs refreshed at ' . now()->toTimeString());
        return self::SUCCESS;
    }
}
