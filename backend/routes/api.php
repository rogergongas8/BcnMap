<?php

use App\Http\Controllers\Api\AirQualityController;
use App\Http\Controllers\Api\BeachController;
use App\Http\Controllers\Api\BicingController;
use App\Http\Controllers\Api\BusController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\CityContextController;
use App\Http\Controllers\Api\EventsController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\MetroController;
use App\Http\Controllers\Api\PlaceEnrichController;
use App\Http\Controllers\Api\PoiController;
use App\Http\Controllers\Api\RouteController;
use App\Http\Controllers\Api\TrafficController;
use App\Http\Controllers\Api\WeatherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/traffic',         [TrafficController::class, 'current']);
    Route::get('/traffic/history', [TrafficController::class, 'history']);

    Route::get('/bicing',          [BicingController::class, 'current']);
    Route::get('/bicing/history',  [BicingController::class, 'history']);

    Route::get('/bus',                  [BusController::class, 'current']);
    Route::get('/bus/{stopId}/arrivals',[BusController::class, 'arrivals']);
    Route::post('/bus/refresh',         [BusController::class, 'fetch']);

    Route::get('/metro',                        [MetroController::class, 'current']);
    Route::get('/metro/lines',                  [MetroController::class, 'lines']);
    Route::get('/metro/{stationId}/arrivals',   [MetroController::class, 'arrivals']);
    Route::post('/metro/refresh',               [MetroController::class, 'fetch']);

    Route::get('/weather',         [WeatherController::class, 'current']);
    Route::get('/air-quality',     [AirQualityController::class, 'current']);
    Route::get('/city-context',    [CityContextController::class, 'index']);

    Route::post('/chat',           [ChatController::class, 'send']);
    Route::get('/route',           [RouteController::class, 'calculate']);

    Route::get('/pois/nearby',     [PoiController::class, 'nearby']);
    Route::get('/pois/search',     [PoiController::class, 'search']);
    Route::get('/pois/categories', [PoiController::class, 'categories']);
    Route::get('/pois/enrich',     [PlaceEnrichController::class, 'enrich']);

    Route::get('/beaches',         [BeachController::class, 'index']);

    Route::get('/events',          [EventsController::class, 'current']);
    Route::get('/events/today',    [EventsController::class, 'today']);
    Route::get('/events/nearby',   [EventsController::class, 'nearby']);

    Route::get('/history/timeline', [HistoryController::class, 'timeline']);
    Route::get('/history/snapshot', [HistoryController::class, 'snapshot']);
    Route::get('/history/range',    [HistoryController::class, 'range']);

    Route::fallback(fn (Request $r) => response()->json([
        'error' => 'Endpoint not found',
        'path'  => $r->path(),
    ], 404));
});
