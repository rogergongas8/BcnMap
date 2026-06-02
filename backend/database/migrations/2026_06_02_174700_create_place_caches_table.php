<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('place_caches', function (Blueprint $table) {
            $table->id();
            $table->string('hash_key')->unique();
            $table->string('name');
            $table->decimal('lat', 10, 8);
            $table->decimal('lng', 11, 8);
            $table->string('lang', 10);
            $table->json('data');
            $table->timestamp('last_fetched_at')->nullable();
            $table->timestamps();
            
            $table->index(['lat', 'lng']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('place_caches');
    }
};
