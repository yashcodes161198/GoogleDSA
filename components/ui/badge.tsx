import { cn } from "@/lib/utils";
import {
  PROBLEM_PROGRESS_LABELS,
  type ProblemProgressStatus,
} from "@/lib/revision/problemProgressStatus";
import type { Difficulty } from "@/lib/types";

const difficultyStyles: Record<Difficulty, string> = {
  EASY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  HARD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const statusStyles: Record<ProblemProgressStatus, string> = {
  unsolved: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  solved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "revised-once": "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  "revised-twice": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "revised-three": "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "revised-many": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge className={difficultyStyles[difficulty]}>{difficulty}</Badge>;
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
