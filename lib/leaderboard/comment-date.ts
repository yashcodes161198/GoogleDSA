export function commentDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric",
    minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(date);
}
