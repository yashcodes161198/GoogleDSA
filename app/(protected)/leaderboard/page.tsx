import Link from "next/link";
import { Eye, Trophy, X } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { ScoreHistory } from "@/components/ScoreHistory";
import { LeaderboardDiscussion } from "@/components/LeaderboardDiscussion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getLeaderboardComments, getScoreActivity, getWeeklyLeaderboard, getPreviousWeeklyWinners } from "@/lib/data";
import { formatLeaderboardWeek } from "@/lib/leaderboard/points";
import styles from "./winners.module.css";

const RULES = [
  { event: "Solve a new question", medium: 4, hard: 8 },
  { event: "First revision", medium: 2, hard: 4 },
  { event: "Later revisions", medium: 1, hard: 2 },
];

export default async function LeaderboardPage({ searchParams }: {
  searchParams: Promise<{ user?: string | string[]; week?: string | string[] }>;
}) {
  const now = new Date();
  const [user, leaderboard, discussion, query, past] = await Promise.all([
    getCurrentUser(),
    getWeeklyLeaderboard(),
    getLeaderboardComments(),
    searchParams,
    getPreviousWeeklyWinners(now),
  ]);
  const weekLabel = formatLeaderboardWeek(now);
  const selectedWeek = past.weeks.find(week => week.start === query.week);
  const selectedWinner = selectedWeek?.winners.find(entry => entry.user_id === query.user);
  const selectedEntry = !query.week ? leaderboard.entries.find((entry) => entry.user_id === query.user) : undefined;
  const historyEntry = selectedWinner ?? selectedEntry;
  const historyDate = selectedWinner && selectedWeek ? new Date(selectedWeek.start) : now;
  const history = historyEntry
    ? await getScoreActivity(historyDate, { userId: historyEntry.user_id, period: "week" })
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
                          key={`${entry.user_id}:${now.toISOString()}`}
                          events={history.events}
                          error={history.error}
                          now={now.toISOString()}
                          summary={history.summary}
                          nextCursor={history.nextCursor}
                          userId={entry.user_id}
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
      <section className={`surface ${styles.archive}`} aria-labelledby="past-winners-title">
        <div className={styles.heading}>
          <span className={styles.trophy}><Trophy size={21} aria-hidden="true" /></span>
          <div>
            <h2 id="past-winners-title">Past weekly winners</h2>
            <p>The last three completed weeks. A place for every winning run.</p>
          </div>
        </div>
        {past.error ? <p className={styles.error} role="status">{past.error}</p> : (
          <ol className={styles.weeks}>
            {past.weeks.map((week, index) => (
              <li key={week.start} className={styles.week}>
                <div className={styles.weekHeading}>
                  <h3>{formatLeaderboardWeek(new Date(week.start))}</h3>
                  <span>{index === 0 ? "Last week" : `${index + 1} weeks ago`}</span>
                </div>
                {week.winners.length === 0 ? (
                  <p className={styles.empty}>No scoring activity this week.</p>
                ) : (
                  <ul className={styles.winners}>
                    {week.winners.map(winner => {
                      const selected = selectedWeek?.start === week.start && selectedWinner?.user_id === winner.user_id;
                      const label = `${selected ? "Hide" : "View"} ${winner.display_name}'s winning week of ${formatLeaderboardWeek(new Date(week.start))}`;
                      return (
                        <li key={winner.user_id}>
                          <div className={styles.winner}>
                            <div className={styles.person}>
                              <span className={styles.avatar} aria-hidden="true">{winner.display_name.slice(0, 1).toUpperCase()}</span>
                              <div className={styles.name}>
                                <span>{winner.display_name}{winner.user_id === user?.id ? " (you)" : ""}</span>
                                <small>{week.winners.length > 1 ? "Joint winner" : "Weekly winner"}</small>
                              </div>
                            </div>
                            <div className={styles.score}><strong>{winner.points} <span>pts</span></strong><small>Final score</small></div>
                            <Link href={selected ? "/leaderboard" : `/leaderboard?user=${encodeURIComponent(winner.user_id)}&week=${encodeURIComponent(week.start)}`}
                              scroll={false} prefetch={false} aria-label={label} title={label} aria-expanded={selected}
                              aria-controls={selected ? "winning-week-history" : undefined} className={styles.view}>
                              {selected ? <X size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                            </Link>
                          </div>
                          {selected && history && (
                            <div id="winning-week-history" className={styles.history}>
                              <ScoreHistory key={`${week.start}:${winner.user_id}`} events={history.events} error={history.error}
                                now={week.start} summary={history.summary} nextCursor={history.nextCursor} userId={winner.user_id}
                                period="week" completedWeek title={`${winner.display_name}'s winning week`} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      {user && <LeaderboardDiscussion key={now.toISOString()} comments={discussion.comments} nextCursor={discussion.nextCursor} error={discussion.error} currentUserId={user.id} />}
    </div>
  );
}
