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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Leaderboard</h1>
        <p className="mt-1 text-zinc-500">
          Week of {weekLabel} · resets Monday 00:00 IST
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Medium</th>
                  <th className="pb-2 font-medium">Hard</th>
                </tr>
              </thead>
              <tbody>
                {RULES.map((rule) => (
                  <tr key={rule.event} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2">{rule.event}</td>
                    <td className="py-2">{rule.medium}</td>
                    <td className="py-2">{rule.hard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            A solve scores once. Each revision of that question scores again, with the first revision worth more than later ones.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.unavailable ? (
            <p className="text-sm text-zinc-500">
              Leaderboard scoring is not installed in Supabase yet. Apply migration 013_leaderboard.sql.
            </p>
          ) : leaderboard.entries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No points yet this week. Solve or revise a medium or hard question to appear here.
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
