"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markProblemRevised } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { DifficultyBadge } from "@/components/ui/badge";
import type { ProblemWithProgress } from "@/lib/types";

type RevisionUpdate = { problemId: string; revised: boolean };

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

  const initialRevised = new Set(
    problems.filter(isRevisedToday).map((p) => p.id)
  );

  const [optimisticRevised, setOptimisticRevised] = useOptimistic(
    initialRevised,
    (state, update: RevisionUpdate) => {
      const next = new Set(state);
      if (update.revised) next.add(update.problemId);
      else next.delete(update.problemId);
      return next;
    }
  );

  const revisedCount = optimisticRevised.size;

  const toggleRevised = (problemId: string, revised: boolean) => {
    if (!revised) return;
    startTransition(async () => {
      setOptimisticRevised({ problemId, revised: true });
      try {
        await markProblemRevised(problemId);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  if (problems.length === 0) {
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

  const allDone = revisedCount >= problems.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {revisedCount} of {problems.length} revised today
        </p>
        {allDone && (
          <p className="text-sm font-medium text-emerald-600">
            Today&apos;s revision complete
          </p>
        )}
      </div>

      <div className="grid gap-4">
        {problems.map((problem, index) => {
          const revised = optimisticRevised.has(problem.id);
          const revisionCount = problem.user_problem?.revision_count ?? 0;

          return (
            <Card key={problem.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <Tooltip label="Mark as revised">
                      <Checkbox
                        checked={revised}
                        aria-label="Mark as revised"
                        disabled={revised || pending}
                        onChange={(checked) =>
                          toggleRevised(problem.id, checked)
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
                <Link
                  href={problem.link}
                  target="_blank"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Open on LeetCode
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
