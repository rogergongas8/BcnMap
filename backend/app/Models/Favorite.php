<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favorite extends Model
{
    protected $fillable = ['user_id', 'name', 'lat', 'lng', 'address', 'category'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
