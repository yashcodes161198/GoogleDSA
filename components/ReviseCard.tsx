"use client";

import { useState } from "react";
import { compareQuestionDifficulty } from "@/components/question-order";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useSessionLibrary, LibraryRefreshStatus } from "@/components/SessionLibraryProvider";
import { PracticeProblemRow } from "@/components/PracticeProblemRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ProblemTimerProvider,
  useProblemTimer,
} from "@/components/ProblemTimerContext";
import { resetRevisionQueue, selectRevisionQueue } from "@/lib/revision/selectRevisionQueue";
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

export function ReviseCard({ dailyLimit }: { dailyLimit: number }) {
  const { problems: library, pendingIds, refreshVersion, refreshing, store } = useSessionLibrary();
  const [queueIds, setQueueIds] = useState(() =>
    selectRevisionQueue(library, { limit: dailyLimit }).map(p => p.id));
  const [previousVersion, setPreviousVersion] = useState(refreshVersion);
  if (previousVersion !== refreshVersion) {
    setPreviousVersion(refreshVersion);
    const eligible = selectRevisionQueue(library, { limit: library.length });
    const eligibleIds = new Set(eligible.map(p => p.id));
    const kept = queueIds.filter(id => eligibleIds.has(id));
    const keptIds = new Set(kept);
    setQueueIds([...kept, ...eligible.filter(p => !keptIds.has(p.id)).map(p => p.id)].slice(0, dailyLimit));
  }
  const byId = new Map(library.map(p => [p.id, p]));
  const queue = queueIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const revisedIds = new Set(queue.filter(isRevisedToday).map(p => p.id));
  const savingIds = new Set(queueIds.filter(id => pendingIds.has(id)));
  const revisedCount = revisedIds.size;
  const toggleRevised = (id: string) => store.revise(id).catch(() => {});
  const toggleFavorite = (id: string) => {
    const problem = byId.get(id);
    if (problem) void store.setFavorite(id, !problem.user_problem?.is_favorite).catch(() => {});
  };
  const resetQueue = () => {
    const replacements = selectRevisionQueue(library, {
      limit: dailyLimit, excludeIds: queueIds, includeRevisedToday: false,
    });
    setQueueIds(resetRevisionQueue(queue, revisedIds, replacements, dailyLimit).map(p => p.id));
  };

  if (queue.length === 0) {
    return (
      <>
      <LibraryRefreshStatus />
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">Nothing to revise today</p>
          <p className="mt-2 text-sm text-zinc-500">
            Solve more problems or come back tomorrow for your next batch of{" "}
            {dailyLimit}.
          </p>
          <Link href="/problems" className="button-link mt-5">
            Browse problems
          </Link>
        </CardContent>
      </Card>
      </>
    );
  }

  const allDone = revisedCount >= queue.length;

  const initialBestSolve = Object.fromEntries(
    queue.map((p) => [p.id, p.user_problem?.best_solve_seconds ?? null]),
  );

  return (
    <ProblemTimerProvider initialBestSolve={initialBestSolve} saveTime={store.saveTime}>
      <ReviseCardContent
        problems={queue}
        revisedCount={revisedCount}
        allDone={allDone}
        revisedIds={revisedIds}
        savingIds={savingIds}
        refreshPending={refreshing}
        resetQueue={resetQueue}
        toggleRevised={toggleRevised}
        toggleFavorite={toggleFavorite}
      />
    </ProblemTimerProvider>
  );
}

function ReviseCardContent({
  problems,
  revisedCount,
  allDone,
  revisedIds,
  savingIds,
  refreshPending,
  resetQueue,
  toggleRevised,
  toggleFavorite,
}: {
  problems: ProblemWithProgress[];
  revisedCount: number;
  allDone: boolean;
  revisedIds: Set<string>;
  savingIds: Set<string>;
  refreshPending: boolean;
  resetQueue: () => void;
  toggleRevised: (problemId: string) => void;
  toggleFavorite: (problemId: string) => void;
}) {
  const { onLeetCodeClick, stopAndPersist } = useProblemTimer();

  const handleRevisedChange = (problemId: string, checked: boolean) => {
    if (!checked) return;
    void toggleRevised(problemId);
    void stopAndPersist(problemId);
  };

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
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
              disabled={refreshPending || savingIds.size > 0}
              onClick={resetQueue}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Replace
              revised
            </Button>
          </Tooltip>
        </div>
      </div>
      <LibraryRefreshStatus />

      <div className="surface practice-row-list">
        {[...problems].sort(compareQuestionDifficulty).map((problem) => {
          const revised = revisedIds.has(problem.id);
          const revisionCount = problem.user_problem?.revision_count ?? 0;

          return (
            <PracticeProblemRow
              key={problem.id}
              problem={problem}
              favorite={problem.user_problem?.is_favorite === true}
              onFavoriteToggle={() => toggleFavorite(problem.id)}
              onLinkClick={() => onLeetCodeClick(problem.id)}
              complete={revised}
              metadata={`${revisionCount} revision${revisionCount === 1 ? "" : "s"}`}
            >
              <Checkbox
                className="h-8 w-8"
                id={`revised-${problem.id}`}
                checked={revised}
                aria-label={`Mark ${problem.title} as revised`}
                disabled={revised || savingIds.has(problem.id)}
                onChange={(checked) =>
                  void handleRevisedChange(problem.id, checked)
                }
              />
              <label
                htmlFor={`revised-${problem.id}`}
                className="cursor-pointer"
              >
                {savingIds.has(problem.id)
                  ? "Saving changes…"
                  : revised
                    ? "Revised today"
                    : "Mark as revised"}
              </label>
            </PracticeProblemRow>
          );
        })}
      </div>
    </div>
  );
}
