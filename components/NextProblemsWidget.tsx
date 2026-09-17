import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/badge";
import { ProblemLinks } from "@/components/ProblemLinks";
import { resolveProblemLinks } from "@/lib/problem-links";
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
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{problem.title}</span>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">{reason}</p>
              <ProblemLinks
                className="mt-2"
                links={resolveProblemLinks(problem)}
                linkClassName="text-xs"
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
