import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";

export function TopicCoverage({
  topics,
}: {
  topics: DashboardStats["topicCoverage"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.map((topic) => {
          const pct = topic.total
            ? Math.round((topic.solved / topic.total) * 100)
            : 0;
          return (
            <div key={topic.topic}>
              <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                <span>{topic.topic}</span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {topic.solved}/{topic.total} ({pct}%)
                </span>
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                role="progressbar"
                aria-label={topic.topic}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
