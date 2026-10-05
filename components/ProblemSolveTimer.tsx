"use client";

import { Button } from "@/components/ui/button";
import { BestSolveTimeLabel } from "@/components/BestSolveTimeLabel";
import { formatDurationMs } from "@/lib/format-duration";
import { useProblemTimer } from "@/components/ProblemTimerContext";

export function ProblemSolveTimer({ problemId }: { problemId: string }) {
  const {
    getDisplayMs,
    getBestSavedSeconds,
    getSaveError,
    isRunning,
    start,
    stop,
    reset,
  } = useProblemTimer();

  const displayMs = getDisplayMs(problemId);
  const bestSaved = getBestSavedSeconds(problemId);
  const saveError = getSaveError(problemId);
  const running = isRunning(problemId);

  return (
    <div className="practice-timer">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xl font-medium tabular-nums">
            {formatDurationMs(displayMs)}
          </p>
          <BestSolveTimeLabel seconds={bestSaved} />
          {saveError && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {saveError}
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
