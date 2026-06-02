<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommuteSchedule;
use App\Services\CommuteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommuteController extends Controller
{
    public function __construct(private readonly CommuteService $commuteService) {}

    public function index(Request $request): JsonResponse
    {
        $schedules = $request->user()->hasMany(CommuteSchedule::class)->latest()->get();
        return response()->json($schedules);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                  => 'required|string|max:200',
            'mode'                  => 'required|string|in:foot,bicing,bus,metro,car',
            'origin_label'          => 'required|string|max:300',
            'origin_lat'            => 'required|numeric',
            'origin_lng'            => 'required|numeric',
            'dest_label'            => 'required|string|max:300',
            'dest_lat'              => 'required|numeric',
            'dest_lng'              => 'required|numeric',
            'days_of_week'          => 'required|array|min:1',
            'days_of_week.*'        => 'integer|between:1,7',
            'arrival_time'          => 'required|date_format:H:i',
            'alert_minutes_before'  => 'integer|min:5|max:120',
        ]);

        $schedule = CommuteSchedule::create([...$data, 'user_id' => $request->user()->id]);

        return response()->json($schedule, 201);
    }

    public function update(Request $request, CommuteSchedule $commuteSchedule): JsonResponse
    {
        abort_if($commuteSchedule->user_id !== $request->user()->id, 403);

        $data = $request->validate([
            'name'                  => 'sometimes|string|max:200',
            'mode'                  => 'sometimes|string|in:foot,bicing,bus,metro,car',
            'origin_label'          => 'sometimes|string|max:300',
            'origin_lat'            => 'sometimes|numeric',
            'origin_lng'            => 'sometimes|numeric',
            'dest_label'            => 'sometimes|string|max:300',
            'dest_lat'              => 'sometimes|numeric',
            'dest_lng'              => 'sometimes|numeric',
            'days_of_week'          => 'sometimes|array|min:1',
            'days_of_week.*'        => 'integer|between:1,7',
            'arrival_time'          => 'sometimes|date_format:H:i',
            'alert_minutes_before'  => 'sometimes|integer|min:5|max:120',
            'is_active'             => 'sometimes|boolean',
        ]);

        $commuteSchedule->update($data);

        return response()->json($commuteSchedule->fresh());
    }

    public function destroy(Request $request, CommuteSchedule $commuteSchedule): JsonResponse
    {
        abort_if($commuteSchedule->user_id !== $request->user()->id, 403);
        $commuteSchedule->delete();
        return response()->json(['ok' => true]);
    }

    public function status(Request $request, CommuteSchedule $commuteSchedule): JsonResponse
    {
        abort_if($commuteSchedule->user_id !== $request->user()->id, 403);

        $status = $this->commuteService->getStatus($commuteSchedule);

        return response()->json($status);
    }
}
