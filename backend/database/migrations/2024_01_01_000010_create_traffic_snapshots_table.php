<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('traffic_snapshots', function (Blueprint $table) {
            $table->id();
            $table->timestamp('snapshot_at')->index();
            $table->string('tramo_id');
            $table->string('tramo_name');
            $table->decimal('lat_start', 10, 7);
            $table->decimal('lng_start', 10, 7);
            $table->decimal('lat_end', 10, 7);
            $table->decimal('lng_end', 10, 7);
            $table->enum('estado', ['fluido', 'lento', 'congestionado', 'cortado']);
            $table->smallInteger('velocidad_media')->nullable();
            $table->timestamps();

            $table->index(['snapshot_at', 'tramo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('traffic_snapshots');
    }
};
