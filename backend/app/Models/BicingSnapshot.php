<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BicingSnapshot extends Model
{
    protected $fillable = [
        'snapshot_at', 'station_id', 'station_name',
        'lat', 'lng', 'bikes_available', 'ebikes_available',
        'docks_available', 'status',
    ];

    protected $casts = [
        'snapshot_at' => 'datetime',
        'lat' => 'float',
        'lng' => 'float',
    ];
}
