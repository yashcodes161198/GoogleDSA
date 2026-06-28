import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/badge";
import type { RecommendedProblem } from "@/lib/recommendations/nextProblems";

export function NextProblemsWidget({
  recommendations,
  daysToFinish,
}: {
  recommendations: RecommendedProblem[];
  daysToFinish: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next up</CardTitle>
        {daysToFinish !== null && (
          <p className="text-sm text-zinc-500">
            ~{daysToFinish} days to finish all at 3/day
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="text-sm text-zinc-500">You&apos;re all caught up!</p>
        ) : (
          recommendations.map(({ problem, reason }) => (
            <div
              key={problem.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={problem.link}
                    target="_blank"
                    className="font-medium hover:text-blue-600"
                  >
                    {problem.title}
                  </Link>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{reason}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
