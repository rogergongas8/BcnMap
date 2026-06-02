<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommuteSchedule extends Model
{
    protected $fillable = [
        'user_id', 'name', 'mode',
        'origin_label', 'origin_lat', 'origin_lng',
        'dest_label',   'dest_lat',   'dest_lng',
        'days_of_week', 'arrival_time', 'alert_minutes_before', 'is_active',
    ];

    protected $casts = [
        'days_of_week'         => 'array',
        'origin_lat'           => 'float',
        'origin_lng'           => 'float',
        'dest_lat'             => 'float',
        'dest_lng'             => 'float',
        'alert_minutes_before' => 'integer',
        'is_active'            => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActiveToday(): bool
    {
        $today = (int) now()->format('N'); // 1=Mon, 7=Sun
        return $this->is_active && in_array($today, $this->days_of_week, true);
    }
}
