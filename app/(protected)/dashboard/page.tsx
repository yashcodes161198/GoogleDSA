import { NextProblemsWidget } from "@/components/NextProblemsWidget";
import { StatsCards } from "@/components/StatsCards";
import { TopicCoverage } from "@/components/TopicCoverage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats, getProblemsWithProgress } from "@/lib/data";
import {
  estimateDaysToFinish,
  getNextProblems,
} from "@/lib/recommendations/nextProblems";

export default async function DashboardPage() {
  const [stats, problems] = await Promise.all([
    getDashboardStats(),
    getProblemsWithProgress(),
  ]);

  const recommendations = getNextProblems(problems, 8);
  const daysToFinish = estimateDaysToFinish(problems, 3);

  const progressPct = stats.total
    ? Math.round((stats.solved / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-zinc-500">
            {progressPct}% complete · {stats.solved} solved of {stats.total} Google questions
          </p>
        </div>

        <StatsCards stats={stats} />

        <div className="grid gap-6 lg:grid-cols-2">
          <NextProblemsWidget
            recommendations={recommendations}
            daysToFinish={daysToFinish}
          />
          <TopicCoverage topics={stats.topicCoverage} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Difficulty breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => {
              const { solved, total } = stats.byDifficulty[d];
              const pct = total ? Math.round((solved / total) * 100) : 0;
              return (
                <div key={d} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500">{d}</p>
                  <p className="text-2xl font-bold">
                    {solved}/{total}
                  </p>
                  <p className="text-sm text-zinc-500">{pct}% solved</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
    </div>
  );
}
