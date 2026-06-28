import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: "Solved", value: stats.solved, sub: `of ${stats.total}` },
    { label: "Attempted", value: stats.attempted, sub: "in progress" },
    { label: "Remaining", value: stats.unsolved, sub: "to cover" },
    { label: "Reviews due", value: stats.reviewsDue, sub: "today" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{item.value}</div>
            <p className="text-sm text-zinc-500">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
