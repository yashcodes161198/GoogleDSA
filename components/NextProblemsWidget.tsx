import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/badge";
import { ExternalLink } from "@/components/ui/external-link";
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
            <ExternalLink
              key={problem.id}
              href={problem.link}
              className="group flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/70 dark:border-zinc-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium transition-colors group-hover:text-blue-700">
                    <span className="sr-only">Open on LeetCode: </span>
                    {problem.title}
                  </span>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{reason}</p>
              </div>
            </ExternalLink>
          ))
        )}
      </CardContent>
    </Card>
  );
}
