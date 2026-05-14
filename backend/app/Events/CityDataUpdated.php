<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class CityDataUpdated implements ShouldBroadcastNow
{
    public function __construct(
        public readonly string $refreshedAt,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('city-data');
    }

    public function broadcastAs(): string
    {
        return 'data.updated';
    }
}
