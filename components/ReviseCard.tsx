"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { markProblemRevised, refreshRevisionQueue } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { DifficultyBadge } from "@/components/ui/badge";
import { ProblemLinks } from "@/components/ProblemLinks";
import { ProblemSolveTimer } from "@/components/ProblemSolveTimer";
import { ProblemTimerProvider, useProblemTimer } from "@/components/ProblemTimerContext";
import { resolveProblemLinks } from "@/lib/problem-links";
import { resetRevisionQueue } from "@/lib/revision/selectRevisionQueue";
import type { ProblemWithProgress } from "@/lib/types";

function isRevisedToday(problem: ProblemWithProgress): boolean {
  const at = problem.user_problem?.last_revised_at;
  if (!at) return false;
  const d = new Date(at);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function ReviseCard({
  problems,
  dailyLimit,
}: {
  problems: ProblemWithProgress[];
  dailyLimit: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState(problems);
  const [revisedIds, setRevisedIds] = useState(
    () => new Set(problems.filter(isRevisedToday).map((p) => p.id))
  );

  const revisedCount = queue.filter((problem) =>
    revisedIds.has(problem.id)
  ).length;

  const toggleRevised = (problemId: string, revised: boolean) => {
    if (!revised) return;
    startTransition(async () => {
      setErrorMessage(null);
      setRevisedIds((current) => new Set(current).add(problemId));
      try {
        const result = await markProblemRevised(problemId);
        if (!result.ok) {
          setErrorMessage(result.error);
          setRevisedIds((current) => {
            const next = new Set(current);
            next.delete(problemId);
            return next;
          });
          return;
        }
        router.refresh();
      } catch (err) {
        console.error(err);
        setErrorMessage("Could not save this revision. Please try again.");
        setRevisedIds((current) => {
          const next = new Set(current);
          next.delete(problemId);
          return next;
        });
        router.refresh();
      }
    });
  };

  const resetQueue = () => {
    startTransition(async () => {
      setErrorMessage(null);
      const checkedIds = new Set(
        queue
          .filter((problem) => revisedIds.has(problem.id))
          .map((problem) => problem.id)
      );
      const uncheckedIds = queue
        .filter((problem) => !checkedIds.has(problem.id))
        .map((problem) => problem.id);
      const result = await refreshRevisionQueue(
        queue.map((problem) => problem.id),
        uncheckedIds
      );

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      const next = resetRevisionQueue(
        queue,
        checkedIds,
        result.replacements,
        dailyLimit
      );
      setQueue(next);
      setRevisedIds(
        new Set(next.filter(isRevisedToday).map((problem) => problem.id))
      );
    });
  };

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">Nothing to revise today</p>
          <p className="mt-2 text-sm text-zinc-500">
            Solve more problems or come back tomorrow for your next batch of{" "}
            {dailyLimit}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allDone = revisedCount >= queue.length;

  const initialBestSolve = Object.fromEntries(
    queue.map((p) => [p.id, p.user_problem?.best_solve_seconds ?? null])
  );

  return (
    <ProblemTimerProvider initialBestSolve={initialBestSolve}>
      <ReviseCardContent
        problems={queue}
        revisedCount={revisedCount}
        allDone={allDone}
        errorMessage={errorMessage}
        revisedIds={revisedIds}
        pending={pending}
        resetQueue={resetQueue}
        toggleRevised={toggleRevised}
      />
    </ProblemTimerProvider>
  );
}

function ReviseCardContent({
  problems,
  revisedCount,
  allDone,
  errorMessage,
  revisedIds,
  pending,
  resetQueue,
  toggleRevised,
}: {
  problems: ProblemWithProgress[];
  revisedCount: number;
  allDone: boolean;
  errorMessage: string | null;
  revisedIds: Set<string>;
  pending: boolean;
  resetQueue: () => void;
  toggleRevised: (problemId: string, revised: boolean) => void;
}) {
  const { onLeetCodeClick, stopAndPersist } = useProblemTimer();

  const handleRevisedChange = async (problemId: string, checked: boolean) => {
    if (!checked) return;
    await stopAndPersist(problemId);
    toggleRevised(problemId, checked);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {revisedCount} of {problems.length} revised today
        </p>
        <div className="flex items-center gap-3">
          {allDone && (
            <p className="text-sm font-medium text-emerald-600">
              Today&apos;s revision complete
            </p>
          )}
          <Tooltip label="Replace revised questions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Replace revised questions"
              disabled={pending}
              onClick={resetQueue}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div className="grid gap-4">
        {problems.map((problem, index) => {
          const revised = revisedIds.has(problem.id);
          const revisionCount = problem.user_problem?.revision_count ?? 0;

          return (
            <Card key={problem.id}>
              <CardHeader>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <Tooltip label="Mark as revised">
                      <Checkbox
                        checked={revised}
                        aria-label="Mark as revised"
                        disabled={revised || pending}
                        onChange={(checked) =>
                          void handleRevisedChange(problem.id, checked)
                        }
                      />
                    </Tooltip>
                    <span className="text-zinc-400">#{index + 1}</span>
                    {problem.title}
                    {revisionCount > 0 && (
                      <span className="text-xs font-normal text-zinc-500">
                        Revised {revisionCount} time
                        {revisionCount === 1 ? "" : "s"} total
                      </span>
                    )}
                  </CardTitle>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-500">
                  {problem.topics.join(", ") || "General"}
                </p>
                <ProblemSolveTimer problemId={problem.id} />
                <ProblemLinks
                  links={resolveProblemLinks(problem)}
                  onLinkClick={() => onLeetCodeClick(problem.id)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
