<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CitySnapshot extends Model
{
    protected $fillable = [
        'snapshot_at', 'weather_temp', 'weather_desc', 'weather_icon',
        'air_quality_index', 'air_quality_level',
        'traffic_congestion_global', 'bicing_availability_global',
    ];

    protected $casts = [
        'snapshot_at' => 'datetime',
        'weather_temp' => 'float',
    ];
}
