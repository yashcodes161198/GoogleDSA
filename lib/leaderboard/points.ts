import type { Difficulty } from "@/lib/types";

export type LeaderboardEventType = "solve" | "revision";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function leaderboardPoints(
  difficulty: Difficulty,
  eventType: LeaderboardEventType,
  revisionNumber?: number
): number {
  if (difficulty !== "MEDIUM" && difficulty !== "HARD") return 0;

  if (eventType === "solve") {
    return difficulty === "MEDIUM" ? 4 : 8;
  }

  if (revisionNumber == null || revisionNumber < 1) return 0;
  if (revisionNumber === 1) return difficulty === "MEDIUM" ? 2 : 4;
  return difficulty === "MEDIUM" ? 1 : 2;
}

export function leaderboardWeekBounds(now = new Date()): {
  start: Date;
  end: Date;
} {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const mondayUtc = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate() - daysSinceMonday
  );
  const start = new Date(mondayUtc - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + WEEK_MS) };
}

export function formatLeaderboardWeek(now = new Date()): string {
  const { start, end } = leaderboardWeekBounds(now);
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
  });
  const lastMoment = new Date(end.getTime() - 1);
  return `${fmt.format(start)} – ${fmt.format(lastMoment)}`;
}

export function rankLeaderboardTotals(
  rows: { user_id: string; display_name: string; points: number }[]
): { user_id: string; display_name: string; points: number; rank: number }[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name)
  );
  let rank = 0;
  let previousPoints: number | null = null;
  return sorted.map((row, index) => {
    if (row.points !== previousPoints) {
      rank = index + 1;
      previousPoints = row.points;
    }
    return { ...row, rank };
  });
}
