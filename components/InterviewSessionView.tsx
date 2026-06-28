"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { endInterviewSession, updateInterviewProblem } from "@/app/actions";
import { InterviewTimer } from "@/components/InterviewTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/badge";
import type { InterviewSession, InterviewSessionProblem } from "@/lib/types";
import Link from "next/link";

export function InterviewSessionView({
  session,
  problems,
}: {
  session: InterviewSession;
  problems: InterviewSessionProblem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const completedCount = problems.filter((p) => p.completed).length;

  const toggleComplete = (problemId: string, completed: boolean, notes?: string | null) => {
    startTransition(async () => {
      await updateInterviewProblem(session.id, problemId, completed, notes ?? undefined);
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
          {completedCount} of {problems.length} completed
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
        {problems.map((sp) => {
          const problem = sp.problem;
          if (!problem) return null;
          return (
            <Card key={sp.problem_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-zinc-400">#{sp.position}</span>
                    {problem.title}
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sp.completed}
                    onChange={(e) =>
                      toggleComplete(sp.problem_id, e.target.checked, sp.notes)
                    }
                  />
                  Mark as done
                </label>
                <textarea
                  className="w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="Interview notes..."
                  defaultValue={sp.notes ?? ""}
                  onBlur={(e) =>
                    toggleComplete(sp.problem_id, sp.completed, e.target.value)
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
