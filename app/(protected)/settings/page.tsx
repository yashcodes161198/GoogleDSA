import { UserRound } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { ScoreHistory } from "@/components/ScoreHistory";
import { DisplayNameForm } from "@/components/DisplayNameForm";
import { ThemeSettings } from "@/components/ThemeSettings";
import { getCurrentDisplayName, getCurrentUser, getScoreActivity } from "@/lib/data";
import { leaderboardPoints } from "@/lib/leaderboard/points";
import styles from "@/components/ScoreHistory.module.css";

export const metadata = { title: "Settings & activity | Google DSA" };

const rules = [
  { label: "Solved", type: "solve", revision: undefined },
  { label: "First revision", type: "revision", revision: 1 },
  { label: "Second+ revision", type: "revision", revision: 2 },
] as const;

export default async function SettingsPage() {
  const now = new Date();
  const [user, activity, displayName] = await Promise.all([
    getCurrentUser(), getScoreActivity(now), getCurrentDisplayName(),
  ]);
  return (
    <div>
      <PageHeading title="Settings & activity" description="Make this workspace yours and see the points you’ve earned over the past month." />
      <ThemeSettings />
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Account settings and scoring rules">
          <details className={`surface ${styles.account}`} open>
            <summary><UserRound size={17} aria-hidden="true" />Your account</summary>
            <dl>
              <div><dt>Signed in as</dt><dd>{user?.email}</dd></div>
              <div><dt>Activity time zone</dt><dd>India Standard Time (UTC+5:30)</dd></div>
            </dl>
            <DisplayNameForm name={displayName} />
          </details>
          <section className={`surface ${styles.rules}`} aria-labelledby="scoring-rules-title">
            <h2 id="scoring-rules-title">How points work</h2>
            <table>
              <caption className="sr-only">Leaderboard points awarded for each action and difficulty</caption>
              <thead><tr><th scope="col">Action</th><th scope="col">Medium</th><th scope="col">Hard</th></tr></thead>
              <tbody>{rules.map((rule) => <tr key={rule.label}>
                <th scope="row">{rule.label}</th>
                <td>+{leaderboardPoints("MEDIUM", rule.type, rule.revision)}</td>
                <td>+{leaderboardPoints("HARD", rule.type, rule.revision)}</td>
              </tr>)}</tbody>
            </table>
            <p>History covers the last 30 days. The leaderboard counts only the current week, starting Monday at 00:00 IST.</p>
          </section>
        </aside>
        <ScoreHistory events={activity.events} error={activity.error} now={now.toISOString()} canDelete />
      </div>
    </div>
  );
}
