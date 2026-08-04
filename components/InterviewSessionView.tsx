"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endInterviewSession, updateInterviewProblem } from "@/app/actions";
import { InterviewTimer } from "@/components/InterviewTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { DifficultyBadge } from "@/components/ui/badge";
import type { InterviewSession, InterviewSessionProblem } from "@/lib/types";
import Link from "next/link";

type CompletionUpdate = { problemId: string; completed: boolean };

export function InterviewSessionView({
  session,
  problems,
}: {
  session: InterviewSession;
  problems: InterviewSessionProblem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isActive = session.status === "active";

  const [optimisticProblems, setOptimisticCompletion] = useOptimistic(
    problems,
    (state, update: CompletionUpdate) =>
      state.map((p) =>
        p.problem_id === update.problemId ? { ...p, completed: update.completed } : p
      )
  );

  const completedCount = optimisticProblems.filter((p) => p.completed).length;

  const toggleComplete = (problemId: string, completed: boolean, notes?: string | null) => {
    startTransition(async () => {
      setOptimisticCompletion({ problemId, completed });
      try {
        await updateInterviewProblem(session.id, problemId, completed, notes ?? undefined);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const saveNotes = (problemId: string, completed: boolean, notes: string) => {
    startTransition(async () => {
      try {
        await updateInterviewProblem(session.id, problemId, completed, notes);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const finish = useCallback(
    (status: "completed" | "abandoned") => {
      if (!isActive) return;
      startTransition(async () => {
        try {
          await endInterviewSession(session.id, status);
          router.push("/interview");
          router.refresh();
        } catch (err) {
          console.error(err);
          alert(
            err instanceof Error
              ? err.message
              : "Failed to end interview. Please try again."
          );
        }
      });
    },
    [isActive, router, session.id]
  );

  return (
    <div className="space-y-6">
      {isActive ? (
        <InterviewTimer
          endsAt={session.ends_at}
          onExpire={() => finish("completed")}
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Session ended</p>
          <p className="mt-1 text-lg font-medium capitalize">{session.status}</p>
          <Link
            href="/interview"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Back to interviews
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {completedCount} of {optimisticProblems.length} completed
        </p>
        {isActive && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={pending} onClick={() => finish("abandoned")}>
              Abandon
            </Button>
            <Button disabled={pending} onClick={() => finish("completed")}>
              End session
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {optimisticProblems.map((sp) => {
          const problem = sp.problem;
          if (!problem) return null;
          return (
            <Card key={sp.problem_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <Tooltip label="Mark as done in this interview">
                      <Checkbox
                        checked={sp.completed}
                        aria-label="Mark as done in this interview"
                        onChange={(checked) =>
                          toggleComplete(sp.problem_id, checked, sp.notes)
                        }
                      />
                    </Tooltip>
                    <span className="text-zinc-400">#{sp.position}</span>
                    {problem.title}
                    {sp.global_status === "solved" && (
                      <span className="text-xs font-normal text-zinc-500">
                        Previously solved
                      </span>
                    )}
                  </CardTitle>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-500">{problem.topics.join(", ")}</p>
                <Link
                  href={problem.link}
                  target="_blank"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Open on LeetCode
                </Link>
                <textarea
                  className="w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="Interview notes..."
                  defaultValue={sp.notes ?? ""}
                  onBlur={(e) => saveNotes(sp.problem_id, sp.completed, e.target.value)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
