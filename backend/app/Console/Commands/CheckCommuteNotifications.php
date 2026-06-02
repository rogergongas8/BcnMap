<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\CommuteSchedule;
use App\Services\CommuteService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckCommuteNotifications extends Command
{
    protected $signature   = 'commute:notify';
    protected $description = 'Check commute schedules and dispatch push notifications';

    public function handle(CommuteService $commuteService): void
    {
        $today = (int) now()->format('N');
        $nowMinutes = (int) now()->format('G') * 60 + (int) now()->format('i');

        $schedules = CommuteSchedule::where('is_active', true)->get()->filter(function ($schedule) use ($today, $nowMinutes) {
            if (!in_array($today, $schedule->days_of_week, true)) return false;

            [$h, $m] = explode(':', $schedule->arrival_time);
            $alertAt = (int) $h * 60 + (int) $m - $schedule->alert_minutes_before;

            return $nowMinutes >= $alertAt && $nowMinutes <= $alertAt + 2;
        });

        foreach ($schedules as $schedule) {
            $status = $commuteService->getStatus($schedule);

            // TODO: when mobile app exists, send Web Push to user's push_subscriptions here
            Log::info("commute:notify user={$schedule->user_id} schedule={$schedule->id} leave_by={$status['leave_by']}");
        }

        $this->info("Checked {$schedules->count()} commute(s).");
    }
}
