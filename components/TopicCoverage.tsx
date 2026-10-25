import { ProgressBar } from "@/components/interior/progress-bar";
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
              <ProgressBar value={pct} label={topic.topic} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
