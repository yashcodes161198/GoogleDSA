"use client";

import { Button } from "@/components/ui/button";
import { formatDurationMs, formatDurationSeconds } from "@/lib/format-duration";
import { useProblemTimer } from "@/components/ProblemTimerContext";

export function ProblemSolveTimer({ problemId }: { problemId: string }) {
  const {
    getDisplayMs,
    getLastSavedSeconds,
    isRunning,
    start,
    stop,
    reset,
  } = useProblemTimer();

  const displayMs = getDisplayMs(problemId);
  const lastSaved = getLastSavedSeconds(problemId);
  const running = isRunning(problemId);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-2xl font-semibold tracking-wide tabular-nums">
            {formatDurationMs(displayMs)}
          </p>
          {lastSaved != null && (
            <p className="mt-1 text-xs text-zinc-500">
              Last solve: {formatDurationSeconds(lastSaved)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            disabled={running}
            onClick={() => start(problemId)}
          >
            Start
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={!running}
            onClick={() => stop(problemId)}
          >
            Stop
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11"
            onClick={() => reset(problemId)}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
