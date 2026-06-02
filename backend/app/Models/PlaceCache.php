<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlaceCache extends Model
{
    protected $fillable = [
        'hash_key',
        'name',
        'lat',
        'lng',
        'lang',
        'data',
        'last_fetched_at'
    ];

    protected $casts = [
        'data' => 'array',
        'last_fetched_at' => 'datetime',
    ];
}
