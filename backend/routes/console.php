<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('city:fetch')->everyTwoMinutes();
Schedule::command('bus:refresh')->everyMinute();
Schedule::command('events:refresh')->dailyAt('04:00');
Schedule::command('pois:refresh')->daily();
Schedule::command('beaches:refresh')->everyThirtyMinutes();
