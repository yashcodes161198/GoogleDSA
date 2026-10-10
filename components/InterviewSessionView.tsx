"use client";

import { useCallback, useOptimistic, useTransition, useState } from "react";
import { compareQuestionDifficulty } from "@/components/question-order";
import { useRouter } from "next/navigation";
import {
  endInterviewSession,
  setProblemFavorite,
  updateInterviewProblem,
} from "@/app/actions";
import { PracticeProblemRow } from "@/components/PracticeProblemRow";
import { InterviewTimer } from "@/components/InterviewTimer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ProblemTimerProvider,
  useProblemTimer,
} from "@/components/ProblemTimerContext";
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

  const toggleComplete = (problemId: string, completed: boolean) => {
    startTransition(async () => {
      setSaveError(null);
      applySessionUpdate({ kind: "complete", problemId, completed });
      try {
        await updateInterviewProblem(session.id, problemId, completed);
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
}: {
  session: InterviewSession;
  isActive: boolean;
  optimisticProblems: InterviewSessionProblem[];
  completedCount: number;
  pending: boolean;
  finish: (status: "completed" | "abandoned") => void;
  toggleComplete: (problemId: string, completed: boolean) => void;
  toggleFavorite: (problemId: string) => void;
}) {
  const { onLeetCodeClick, stopAndPersist } = useProblemTimer();
  const [showQuestions, setShowQuestions] = useState(false);
  const displayedProblems = [...optimisticProblems].sort((a, b) =>
    compareQuestionDifficulty(a.problem ?? {}, b.problem ?? {}),
  );

  const handleCompleteChange = async (problemId: string, checked: boolean) => {
    if (checked) {
      await stopAndPersist(problemId);
    }
    toggleComplete(problemId, checked);
  };

  return (
    <div className="session-layout gap-4 sm:gap-6">
      <aside
        className="session-rail gap-2 sm:gap-4"
        aria-label="Interview overview"
      >
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
        <div className="surface grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2 xl:block xl:p-4">
          <div className="flex items-center gap-2 xl:justify-between xl:gap-3">
            <h2 className="text-sm font-semibold">Session questions</h2>
            <span className="text-xs tabular-nums text-muted">
              {completedCount} / {optimisticProblems.length}
            </span>
          </div>
          <button
            type="button"
            className="text-link min-h-11 text-xs xl:hidden"
            aria-expanded={showQuestions}
            aria-controls="session-question-list"
            onClick={() => setShowQuestions((shown) => !shown)}
          >
            {showQuestions ? "Hide list" : "Show list"}
          </button>
          <nav
            id="session-question-list"
            aria-label="Session questions"
            className={
              showQuestions
                ? "col-span-2 mt-3"
                : "col-span-2 mt-3 hidden xl:block"
            }
          >
            {displayedProblems.map((sp, index) => (
              <a
                key={sp.problem_id}
                href={`#question-${sp.problem_id}`}
                className="session-question-link"
              >
                <span className="queue-marker">
                  {sp.completed ? (
                    <Check size={13} aria-label="Completed" />
                  ) : (
                    index + 1
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
              className="min-h-11"
              disabled={pending}
              onClick={() => finish("abandoned")}
            >
              Abandon
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => finish("completed")}
            >
              End session
            </Button>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted">
          {completedCount} of {optimisticProblems.length} completed. Completed
          questions are also marked solved in your problem library.
        </p>
      </aside>
      <div className="surface practice-row-list min-w-0">
        {displayedProblems.map((sp, index) => {
          const problem = sp.problem;
          if (!problem) return null;
          return (
            <PracticeProblemRow
              key={sp.problem_id}
              id={`question-${sp.problem_id}`}
              problem={problem}
              favorite={sp.is_favorite === true}
              onFavoriteToggle={() => toggleFavorite(sp.problem_id)}
              onLinkClick={() => onLeetCodeClick(sp.problem_id)}
              complete={sp.completed}
              metadata={`Question ${index + 1} of ${optimisticProblems.length}${sp.global_status === "solved" ? " (previously solved)" : ""}`}
            >
              <Checkbox
                className="h-8 w-8"
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
              {pending && <span className="text-xs text-muted">Saving…</span>}
            </PracticeProblemRow>
          );
        })}
      </div>
    </div>
  );
}
