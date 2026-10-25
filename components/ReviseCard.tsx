"use client";

import { PressButton } from "@/components/interior/press-depth";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useSessionLibrary } from "@/components/SessionLibraryProvider";
import { PracticeProblemRow } from "@/components/PracticeProblemRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ProblemTimerProvider,
  useProblemTimer,
} from "@/components/ProblemTimerContext";
import { loadRevisionSession, replaceRevisionSession } from "@/app/revision-actions";
import { materializeRevisionQueue } from "@/lib/revision/selectRevisionQueue";
import { revisedSessionIds, type RevisionSession } from "@/lib/revision/session";
import type { ProblemWithProgress } from "@/lib/types";

export function ReviseCard({ dailyLimit }: { dailyLimit: number }) {
  const { problems: library, pendingIds, refreshing, refreshVersion, store } = useSessionLibrary();
  const [session, setSession] = useState<RevisionSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const request = useRef(0);
  const replacingRef = useRef(false);

  useEffect(() => {
    if (replacingRef.current) return;
    let active = true;
    const currentRequest = ++request.current;
    void loadRevisionSession().then(result => {
      if (!active || request.current !== currentRequest) return;
      if (result.ok) { setSession(result.session); setError(null); }
      else setError(result.error);
    }).catch(() => {
      if (active && request.current === currentRequest) setError("Could not load your saved revision list. Please try again.");
    });
    return () => { active = false; };
  }, [refreshVersion, retryVersion]);

  const queueIds = session?.entries.map(entry => entry.id) ?? [];
  const queue = materializeRevisionQueue(queueIds, library);
  const revisedIds = session ? revisedSessionIds(session, queue) : new Set<string>();
  const savingIds = new Set(queueIds.filter(id => pendingIds.has(id)));
  const revisedCount = revisedIds.size;
  const toggleRevised = (id: string) => store.revise(id).catch(() => {});
  const toggleFavorite = (id: string) => {
    const problem = queue.find(p => p.id === id);
    if (problem) void store.setFavorite(id, !problem.user_problem?.is_favorite).catch(() => {});
  };
  const resetQueue = async () => {
    if (!session || replacingRef.current) return;
    replacingRef.current = true;
    ++request.current;
    setReplacing(true);
    setError(null);
    try {
      const result = await replaceRevisionSession(session.version);
      if (!result.ok) { setError(result.error); return; }
      setSession(result.session);
      void store.refresh();
    } catch {
      setError("Could not replace revised questions. Your saved list has been kept. Please try again.");
    } finally {
      replacingRef.current = false;
      setReplacing(false);
    }
  };

  const errorMessage = error && <p className="surface p-4 text-sm text-destructive" role="alert">
    {error}{" "}<PressButton type="button" className="underline" onClick={() => setRetryVersion(v => v + 1)}>Reload saved list</PressButton>
  </p>;
  if (!session) {
    return errorMessage || <div className="surface p-6" role="status">Loading your saved revision list…</div>;
  }

  const allDone = queue.length > 0 && revisedCount >= queue.length;

  const initialBestSolve = Object.fromEntries(
    queue.map((p) => [p.id, p.user_problem?.best_solve_seconds ?? null]),
  );

  return (
    <ProblemTimerProvider initialBestSolve={initialBestSolve} saveTime={store.saveTime}>
      {errorMessage}
      <ReviseCardContent
        problems={queue}
        revisedCount={revisedCount}
        allDone={allDone}
        revisedIds={revisedIds}
        savingIds={savingIds}
        refreshPending={refreshing || replacing}
        resetQueue={resetQueue}
        toggleRevised={toggleRevised}
        toggleFavorite={toggleFavorite}
      />
      {queue.length === 0 && <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">No questions in this revision list</p>
          <p className="mt-2 text-sm text-zinc-500">
            Press Replace revised to check for up to {dailyLimit} eligible questions. Questions need a 48-hour break after solving or revising.
          </p>
          <Link href="/problems" className="button-link mt-5">Browse problems</Link>
        </CardContent>
      </Card>}
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
          {revisedCount} of {problems.length} revised in this list
        </p>
        <div className="flex items-center gap-3">
          {allDone && (
            <p className="text-sm font-medium text-emerald-600">
              Revision list complete
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
      <div className="surface practice-row-list">
        {problems.map((problem) => {
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
                disabled={revised || savingIds.has(problem.id) || refreshPending}
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
                    ? "Revised"
                    : "Mark as revised"}
              </label>
            </PracticeProblemRow>
          );
        })}
      </div>
    </div>
  );
}
