<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bicing_snapshots', function (Blueprint $table) {
            $table->id();
            $table->timestamp('snapshot_at')->index();
            $table->integer('station_id');
            $table->string('station_name');
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->smallInteger('bikes_available')->default(0);
            $table->smallInteger('ebikes_available')->default(0);
            $table->smallInteger('docks_available')->default(0);
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamps();

            $table->index(['snapshot_at', 'station_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bicing_snapshots');
    }
};
