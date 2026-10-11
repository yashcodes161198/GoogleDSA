import Link from "next/link";
import { Eye, X } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { ScoreHistory } from "@/components/ScoreHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getScoreActivity, getWeeklyLeaderboard } from "@/lib/data";
import { formatLeaderboardWeek } from "@/lib/leaderboard/points";

const RULES = [
  { event: "Solve a new question", medium: 4, hard: 8 },
  { event: "First revision", medium: 2, hard: 4 },
  { event: "Later revisions", medium: 1, hard: 2 },
];

export default async function LeaderboardPage({ searchParams }: {
  searchParams: Promise<{ user?: string | string[] }>;
}) {
  const now = new Date();
  const [user, leaderboard, query] = await Promise.all([
    getCurrentUser(),
    getWeeklyLeaderboard(),
    searchParams,
  ]);
  const weekLabel = formatLeaderboardWeek(now);
  const selectedEntry = leaderboard.entries.find((entry) => entry.user_id === query.user);
  const history = selectedEntry
    ? await getScoreActivity(now, { userId: selectedEntry.user_id, period: "week" })
    : null;

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
          <p className="text-sm text-zinc-500">Select the eye beside any player to see their daily points and scoring activity.</p>
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
                const isSelected = entry.user_id === selectedEntry?.user_id;
                return (
                  <li
                    key={entry.user_id}
                    className="min-w-0"
                  >
                    <div className={
                      isCurrentUser
                        ? "flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950"
                        : "flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    }>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 text-sm font-semibold text-zinc-500">
                          {entry.rank}
                        </span>
                        <span className="truncate font-medium">
                          {entry.display_name}
                          {isCurrentUser ? " (you)" : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">{entry.points} pts</span>
                        <Link
                          href={isSelected ? "/leaderboard" : `/leaderboard?user=${encodeURIComponent(entry.user_id)}`}
                          scroll={false}
                          prefetch={false}
                          aria-label={`${isSelected ? "Hide" : "View"} ${entry.display_name}'s score history`}
                          aria-expanded={isSelected}
                          aria-controls={isSelected ? "leaderboard-score-history" : undefined}
                          title={`${isSelected ? "Hide" : "View"} ${entry.display_name}'s score history`}
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-500"}`}
                        >
                          {isSelected ? <X size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </Link>
                      </div>
                    </div>
                    {isSelected && history && (
                      <div id="leaderboard-score-history" className="my-3">
                        <ScoreHistory
                          key={entry.user_id}
                          events={history.events}
                          error={history.error}
                          now={now.toISOString()}
                          period="week"
                          title={`${entry.display_name}'s score history`}
                        />
                      </div>
                    )}
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
