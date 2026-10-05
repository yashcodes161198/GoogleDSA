import { cn } from "@/lib/utils";
import {
  PROBLEM_PROGRESS_LABELS,
  type ProblemProgressStatus,
} from "@/lib/revision/problemProgressStatus";
import type { Difficulty } from "@/lib/types";

const difficultyStyles: Record<Difficulty, string> = {
  EASY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  MEDIUM:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  HARD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const statusStyles: Record<ProblemProgressStatus, string> = {
  unsolved: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  solved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "revised-once": "bg-[var(--accent-soft)] text-[var(--accent-text)]",
  "revised-twice": "bg-[var(--accent-soft)] text-[var(--accent-text)]",
  "revised-three": "bg-[var(--accent-soft)] text-[var(--accent-text)]",
  "revised-many": "bg-[var(--accent-soft)] text-[var(--accent-text)]",
};

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge className={difficultyStyles[difficulty]}>
      {difficulty[0] + difficulty.slice(1).toLowerCase()}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProblemProgressStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(statusStyles[status], className)}>
      {PROBLEM_PROGRESS_LABELS[status]}
    </Badge>
  );
}
