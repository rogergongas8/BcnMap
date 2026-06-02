<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commute_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('mode');
            $table->string('origin_label');
            $table->decimal('origin_lat', 10, 7);
            $table->decimal('origin_lng', 10, 7);
            $table->string('dest_label');
            $table->decimal('dest_lat', 10, 7);
            $table->decimal('dest_lng', 10, 7);
            $table->json('days_of_week'); // [1,2,3,4,5] — ISO: 1=Mon, 7=Sun
            $table->time('arrival_time');
            $table->unsignedSmallInteger('alert_minutes_before')->default(20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commute_schedules');
    }
};
