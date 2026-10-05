import { PageHeading } from "@/components/PageHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getWeeklyLeaderboard } from "@/lib/data";
import { formatLeaderboardWeek } from "@/lib/leaderboard/points";

const RULES = [
  { event: "Solve a new question", medium: 4, hard: 8 },
  { event: "First revision", medium: 2, hard: 4 },
  { event: "Later revisions", medium: 1, hard: 2 },
];

export default async function LeaderboardPage() {
  const [user, leaderboard] = await Promise.all([
    getCurrentUser(),
    getWeeklyLeaderboard(),
  ]);
  const weekLabel = formatLeaderboardWeek();

  return (
    <div className="space-y-6">
      <div>
        <PageHeading
          title="Weekly leaderboard"
          description={`Week of ${weekLabel}. Resets Monday at 00:00 IST.`}
        />
        <details className="mt-3 text-sm text-zinc-500">
          <summary className="w-fit cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
            How points work
          </summary>
          <div className="mt-3 max-w-md rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Medium</th>
                  <th className="pb-2 font-medium">Hard</th>
                </tr>
              </thead>
              <tbody>
                {RULES.map((rule) => (
                  <tr
                    key={rule.event}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-2 text-zinc-700 dark:text-zinc-300">
                      {rule.event}
                    </td>
                    <td className="py-2">{rule.medium}</td>
                    <td className="py-2">{rule.hard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.unavailable ? (
            <p className="text-sm text-zinc-500">
              The leaderboard is not available yet. You can continue solving and
              revising questions.
            </p>
          ) : leaderboard.entries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No points yet this week. Solve or revise a medium or hard question
              to appear here.
            </p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.entries.map((entry) => {
                const isCurrentUser = entry.user_id === user?.id;
                return (
                  <li
                    key={entry.user_id}
                    className={
                      isCurrentUser
                        ? "flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950"
                        : "flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    }
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-6 text-sm font-semibold text-zinc-500">
                        {entry.rank}
                      </span>
                      <span className="truncate font-medium">
                        {entry.display_name}
                        {isCurrentUser ? " (you)" : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {entry.points} pts
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
