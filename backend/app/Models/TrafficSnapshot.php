<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrafficSnapshot extends Model
{
    protected $fillable = [
        'snapshot_at', 'tramo_id', 'tramo_name',
        'lat_start', 'lng_start', 'lat_end', 'lng_end',
        'estado', 'velocidad_media',
    ];

    protected $casts = [
        'snapshot_at' => 'datetime',
        'lat_start' => 'float',
        'lng_start' => 'float',
        'lat_end' => 'float',
        'lng_end' => 'float',
    ];
}
