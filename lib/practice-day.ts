const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function practiceDayStart(now = new Date()): number {
  return Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export function isPracticeToday(value: string | null | undefined, now = new Date()): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  const start = practiceDayStart(now);
  return time >= start && time < start + DAY_MS;
}
