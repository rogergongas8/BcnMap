<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedRoute extends Model
{
    protected $fillable = [
        'user_id', 'name', 'mode',
        'origin_label', 'origin_lat', 'origin_lng',
        'dest_label',   'dest_lat',   'dest_lng',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
