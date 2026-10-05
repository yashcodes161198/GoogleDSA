"use client";

import { useCallback, useOptimistic, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  endInterviewSession,
  setProblemFavorite,
  updateInterviewProblem,
} from "@/app/actions";
import { FavoriteButton } from "@/components/FavoriteButton";
import { InterviewTimer } from "@/components/InterviewTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DifficultyBadge } from "@/components/ui/badge";
import { ProblemLinks } from "@/components/ProblemLinks";
import { ProblemSolveTimer } from "@/components/ProblemSolveTimer";
import {
  ProblemTimerProvider,
  useProblemTimer,
} from "@/components/ProblemTimerContext";
import { resolveProblemLinks } from "@/lib/problem-links";
import type { InterviewSession, InterviewSessionProblem } from "@/lib/types";
import Link from "next/link";
import { Check } from "lucide-react";

type SessionUpdate =
  | { kind: "complete"; problemId: string; completed: boolean }
  | { kind: "favorite"; problemId: string; favorite: boolean };

export function InterviewSessionView({
  session,
  problems,
}: {
  session: InterviewSession;
  problems: InterviewSessionProblem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const isActive = session.status === "active";

  const [optimisticProblems, applySessionUpdate] = useOptimistic(
    problems,
    (state, update: SessionUpdate) =>
      state.map((p) => {
        if (p.problem_id !== update.problemId) return p;
        if (update.kind === "complete")
          return { ...p, completed: update.completed };
        return { ...p, is_favorite: update.favorite };
      }),
  );

  const completedCount = optimisticProblems.filter((p) => p.completed).length;

  const initialBestSolve = Object.fromEntries(
    optimisticProblems.map((sp) => [
      sp.problem_id,
      sp.best_solve_seconds ?? null,
    ]),
  );

  const toggleComplete = (
    problemId: string,
    completed: boolean,
    notes?: string | null,
  ) => {
    startTransition(async () => {
      setSaveError(null);
      applySessionUpdate({ kind: "complete", problemId, completed });
      try {
        await updateInterviewProblem(
          session.id,
          problemId,
          completed,
          notes ?? undefined,
        );
      } catch (err) {
        console.error(err);
        setSaveError("Could not save this change. Please try again.");
      }
    });
  };

  const saveNotes = (problemId: string, completed: boolean, notes: string) => {
    startTransition(async () => {
      setSaveError(null);
      try {
        await updateInterviewProblem(session.id, problemId, completed, notes);
      } catch (err) {
        console.error(err);
        setSaveError("Could not save this change. Please try again.");
      }
    });
  };

  const toggleFavorite = (problemId: string) => {
    const current = optimisticProblems.find(
      (problem) => problem.problem_id === problemId,
    );
    if (!current) return;
    const next = !(current.is_favorite ?? false);
    startTransition(async () => {
      setSaveError(null);
      applySessionUpdate({ kind: "favorite", problemId, favorite: next });
      try {
        await setProblemFavorite(problemId, next);
      } catch (err) {
        console.error(err);
        setSaveError("Could not save this change. Please try again.");
        applySessionUpdate({ kind: "favorite", problemId, favorite: !next });
      }
    });
  };

  const finish = useCallback(
    (status: "completed" | "abandoned") => {
      if (!isActive) return;
      startTransition(async () => {
        setSaveError(null);
        try {
          await endInterviewSession(session.id, status);
          router.push("/interview");
          router.refresh();
        } catch (err) {
          console.error(err);
          setSaveError(
            err instanceof Error
              ? err.message
              : "Failed to end interview. Please try again.",
          );
        }
      });
    },
    [isActive, router, session.id],
  );

  return (
    <ProblemTimerProvider initialBestSolve={initialBestSolve}>
      {saveError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {saveError}
        </p>
      )}
      <InterviewSessionContent
        session={session}
        isActive={isActive}
        optimisticProblems={optimisticProblems}
        completedCount={completedCount}
        pending={pending}
        finish={finish}
        toggleComplete={toggleComplete}
        toggleFavorite={toggleFavorite}
        saveNotes={saveNotes}
      />
    </ProblemTimerProvider>
  );
}

function InterviewSessionContent({
  session,
  isActive,
  optimisticProblems,
  completedCount,
  pending,
  finish,
  toggleComplete,
  toggleFavorite,
  saveNotes,
}: {
  session: InterviewSession;
  isActive: boolean;
  optimisticProblems: InterviewSessionProblem[];
  completedCount: number;
  pending: boolean;
  finish: (status: "completed" | "abandoned") => void;
  toggleComplete: (
    problemId: string,
    completed: boolean,
    notes?: string | null,
  ) => void;
  toggleFavorite: (problemId: string) => void;
  saveNotes: (problemId: string, completed: boolean, notes: string) => void;
}) {
  const { onLeetCodeClick, stopAndPersist } = useProblemTimer();
  const [showQuestions, setShowQuestions] = useState(false);

  const handleCompleteChange = async (
    problemId: string,
    checked: boolean,
    notes?: string | null,
  ) => {
    if (checked) {
      await stopAndPersist(problemId);
    }
    toggleComplete(problemId, checked, notes);
  };

  return (
    <div className="session-layout">
      <aside className="session-rail" aria-label="Interview overview">
        {isActive ? (
          <InterviewTimer
            endsAt={session.ends_at}
            onExpire={() => finish("completed")}
          />
        ) : (
          <div className="surface p-5">
            <p className="text-sm text-muted">Session ended</p>
            <p className="mt-1 font-semibold capitalize">{session.status}</p>
            <Link href="/interview" className="text-link mt-4 inline-block">
              Back to interviews
            </Link>
          </div>
        )}
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Session questions</h2>
            <span className="text-xs tabular-nums text-muted">
              {completedCount} / {optimisticProblems.length}
            </span>
          </div>
          <button
            type="button"
            className="text-link mt-2 min-h-11 xl:hidden"
            aria-expanded={showQuestions}
            aria-controls="session-question-list"
            onClick={() => setShowQuestions((shown) => !shown)}
          >
            {showQuestions ? "Hide question list" : "Show question list"}
          </button>
          <nav
            id="session-question-list"
            aria-label="Session questions"
            className={showQuestions ? "mt-3" : "mt-3 hidden xl:block"}
          >
            {optimisticProblems.map((sp) => (
              <a
                key={sp.problem_id}
                href={`#question-${sp.problem_id}`}
                className="session-question-link"
              >
                <span className="queue-marker">
                  {sp.completed ? (
                    <Check size={13} aria-label="Completed" />
                  ) : (
                    sp.position
                  )}
                </span>
                <span className="min-w-0 leading-relaxed">
                  {sp.problem?.title ?? "Question"}
                  {sp.completed && (
                    <span className="mt-1 block text-xs text-[var(--success)]">
                      Completed
                    </span>
                  )}
                </span>
              </a>
            ))}
          </nav>
        </div>
        {isActive && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => finish("abandoned")}
            >
              Abandon
            </Button>
            <Button disabled={pending} onClick={() => finish("completed")}>
              End session
            </Button>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted">
          {completedCount} of {optimisticProblems.length} completed. Session
          completion is tracked separately from your problem library.
        </p>
      </aside>
      <div className="grid min-w-0 gap-5">
        {optimisticProblems.map((sp) => {
          const problem = sp.problem;
          if (!problem) return null;
          return (
            <Card
              key={sp.problem_id}
              id={`question-${sp.problem_id}`}
              className="practice-card"
              data-complete={sp.completed}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-3 text-xs text-muted">
                      Question {sp.position} of {optimisticProblems.length}
                      {sp.global_status === "solved"
                        ? " · Previously solved"
                        : ""}
                    </p>
                    <CardTitle className="leading-snug">
                      {problem.title}
                    </CardTitle>
                  </div>
                  <FavoriteButton
                    favorite={sp.is_favorite === true}
                    onToggle={() => toggleFavorite(sp.problem_id)}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <DifficultyBadge difficulty={problem.difficulty} />
                  <p className="text-xs leading-relaxed text-muted">
                    {problem.topics.join(", ")}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ProblemLinks
                  links={resolveProblemLinks(problem)}
                  onLinkClick={() => onLeetCodeClick(sp.problem_id)}
                />
                <ProblemSolveTimer problemId={sp.problem_id} />
                <label className="block space-y-2 text-sm font-medium">
                  Approach &amp; notes
                  <textarea
                    className="notes-field mt-2 block font-normal"
                    placeholder="Capture your approach, complexity, and edge cases…"
                    defaultValue={sp.notes ?? ""}
                    onBlur={(e) =>
                      saveNotes(sp.problem_id, sp.completed, e.target.value)
                    }
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <Checkbox
                      id={`complete-${sp.problem_id}`}
                      checked={sp.completed}
                      aria-label={`Mark ${problem.title} as done in this interview`}
                      onChange={(checked) =>
                        void handleCompleteChange(sp.problem_id, checked)
                      }
                    />
                    <label
                      htmlFor={`complete-${sp.problem_id}`}
                      className="cursor-pointer"
                    >
                      {sp.completed
                        ? "Completed in this interview"
                        : "Mark as completed"}
                    </label>
                  </div>
                  <span className="text-xs text-muted">
                    {pending
                      ? "Saving…"
                      : "Notes save when you leave the field"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
