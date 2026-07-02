"use client";

import { useOptimistic, useTransition } from "react";
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

  // Flip the checkbox instantly; the server action confirms (and
  // revalidates) in the background — previously this round trip made the
  // checkbox feel like it took 1.5-2s to respond.
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
      await updateInterviewProblem(session.id, problemId, completed, notes ?? undefined);
    });
  };

  const saveNotes = (problemId: string, completed: boolean, notes: string) => {
    startTransition(async () => {
      await updateInterviewProblem(session.id, problemId, completed, notes);
    });
  };

  const finish = (status: "completed" | "abandoned") => {
    startTransition(async () => {
      await endInterviewSession(session.id, status);
      router.push("/interview");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <InterviewTimer
        endsAt={session.ends_at}
        onExpire={() => {
          if (session.status === "active") finish("completed");
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {completedCount} of {optimisticProblems.length} completed
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => finish("abandoned")}>
            Abandon
          </Button>
          <Button disabled={pending} onClick={() => finish("completed")}>
            End session
          </Button>
        </div>
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
