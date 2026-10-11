import { practiceDayStart } from "@/lib/practice-day";
import type { Difficulty } from "@/lib/types";
import type { LeaderboardEventType } from "@/lib/leaderboard/points";

const DAY_MS = 24 * 60 * 60 * 1000;
export const ACTIVITY_DAYS = 30;
export const ACTIVITY_ACTIONS = ["solved", "first-revision", "later-revision"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type ActivityFilter = "all" | ActivityAction;
export const ACTION_LABELS: Record<ActivityAction, string> = {
  solved: "Solved",
  "first-revision": "First revision",
  "later-revision": "Second+ revision",
};

export type ScoreActivity = {
  id: string;
  problem_id: string;
  problem_title: string;
  difficulty: Difficulty;
  event_type: LeaderboardEventType;
  revision_number: number | null;
  points: number;
  created_at: string;
};

export function activityAction(event: ScoreActivity): ActivityAction {
  if (event.event_type === "solve") return "solved";
  return event.revision_number === 1 ? "first-revision" : "later-revision";
}

export function activityBounds(now = new Date()) {
  return {
    start: new Date(practiceDayStart(now) - (ACTIVITY_DAYS - 1) * DAY_MS),
    end: new Date(now.getTime() + 1),
  };
}

export function activityDayKey(value: string | Date): string {
  return new Date(practiceDayStart(new Date(value)) + DAY_MS / 2)
    .toISOString().slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function istDate(value: string | Date) {
  return new Date(new Date(value).getTime() + (5 * 60 + 30) * 60 * 1000);
}

// Explicit formatting keeps server and browser ICU versions from producing
// different punctuation or spacing during hydration.
export function formatActivityDate(value: string | Date) {
  const date = istDate(value);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

export function formatActivityFullDate(value: string | Date) {
  const date = istDate(value);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatActivityTime(value: string) {
  const date = istDate(value);
  const hours = date.getUTCHours();
  return `${hours % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

export function buildActivityDays(events: ScoreActivity[], now: Date, filter: ActivityFilter = "all") {
  const { start, end } = activityBounds(now);
  const days = Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return { date: date.toISOString(), key: activityDayKey(date), points: 0, events: [] as ScoreActivity[] };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  for (const event of events) {
    const at = new Date(event.created_at).getTime();
    if (at < start.getTime() || at >= end.getTime()) continue;
    if (filter !== "all" && activityAction(event) !== filter) continue;
    const day = byDay.get(activityDayKey(event.created_at));
    if (!day) continue;
    day.events.push(event);
    day.points += event.points;
  }
  for (const day of days) {
    day.events.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  }
  return days;
}
