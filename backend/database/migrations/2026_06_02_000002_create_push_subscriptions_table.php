<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('endpoint', 2000);
            $table->string('p256dh_key', 500)->nullable();
            $table->string('auth_key', 200)->nullable();
            $table->string('platform')->default('web'); // web, ios, android
            $table->timestamps();

            $table->unique(['user_id', 'endpoint'], 'push_user_endpoint_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
