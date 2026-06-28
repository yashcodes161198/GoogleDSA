"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function InterviewTimer({
  endsAt,
  onExpire,
}: {
  endsAt: string;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const warn = remainingMs > 0 && remainingMs <= 15 * 60 * 1000;
  const critical = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  const expired = remainingMs === 0;

  return (
    <div
      className={cn(
        "rounded-xl border px-6 py-4 text-center",
        expired && "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
        critical && !expired && "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
        warn && !critical && "border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30",
        !warn && !expired && "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      )}
    >
      <p className="text-sm text-zinc-500">Time remaining</p>
      <p className="font-mono text-4xl font-bold tracking-wider">{display}</p>
      {critical && !expired && (
        <p className="mt-2 text-sm text-red-600">Less than 5 minutes left!</p>
      )}
      {warn && !critical && (
        <p className="mt-2 text-sm text-yellow-700">Less than 15 minutes left</p>
      )}
      {expired && <p className="mt-2 text-sm text-red-600">Time is up!</p>}
    </div>
  );
}
