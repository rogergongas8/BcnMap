<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('city_snapshots', function (Blueprint $table) {
            $table->id();
            $table->timestamp('snapshot_at')->index();
            $table->decimal('weather_temp', 4, 1)->nullable();
            $table->string('weather_desc')->nullable();
            $table->string('weather_icon')->nullable();
            $table->smallInteger('air_quality_index')->nullable();
            $table->string('air_quality_level')->nullable();
            $table->tinyInteger('traffic_congestion_global')->default(0)->comment('0-100');
            $table->tinyInteger('bicing_availability_global')->default(0)->comment('0-100');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('city_snapshots');
    }
};
