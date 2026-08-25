import { formatDurationSeconds } from "@/lib/format-duration";

export function BestSolveTimeLabel({
  seconds,
  className,
}: {
  seconds: number | null | undefined;
  className?: string;
}) {
  if (seconds == null || seconds <= 0) return null;

  return (
    <p className={className ?? "mt-1 text-xs text-zinc-500"}>
      Best: {formatDurationSeconds(seconds)}
    </p>
  );
}
