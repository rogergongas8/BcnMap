<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\BeachService;
use Illuminate\Console\Command;

class RefreshBeaches extends Command
{
    protected $signature   = 'beaches:refresh';
    protected $description = 'Refresh derived beach state (flag, water temp, wind) from weather data';

    public function __construct(private BeachService $beaches)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $data = $this->beaches->all();
        $this->info('Beaches refreshed: ' . count($data) . ' platges at ' . now()->toTimeString());

        foreach ($data as $b) {
            $this->line(sprintf(
                '  - %-16s flag=%-6s wind=%-5s wave=%s',
                $b['name'],
                $b['flag'],
                $b['wind_kmh'] !== null ? $b['wind_kmh'] . 'km/h' : 'n/a',
                $b['wave_estimate'],
            ));
        }

        return self::SUCCESS;
    }
}
