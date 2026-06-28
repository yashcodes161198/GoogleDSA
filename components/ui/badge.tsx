import { cn } from "@/lib/utils";
import type { Difficulty, ProblemStatus } from "@/lib/types";

const difficultyStyles: Record<Difficulty, string> = {
  EASY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  HARD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const statusStyles: Record<ProblemStatus, string> = {
  unsolved: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  attempted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  solved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
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

export function StatusBadge({ status }: { status: ProblemStatus }) {
  return <Badge className={statusStyles[status]}>{status}</Badge>;
}
