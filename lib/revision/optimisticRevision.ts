import type { ProblemWithProgress } from "@/lib/types";

export function applyOptimisticRevision(
  problem: ProblemWithProgress,
  revisedAt: string
): ProblemWithProgress {
  if (!problem.user_problem) return problem;

  return {
    ...problem,
    user_problem: {
      ...problem.user_problem,
      revision_count: problem.user_problem.revision_count + 1,
      last_revised_at: revisedAt,
    },
  };
}

export function reconcileRevisionCount(
  problem: ProblemWithProgress,
  revisionCount: number
): ProblemWithProgress {
  if (!problem.user_problem) return problem;

  return {
    ...problem,
    user_problem: {
      ...problem.user_problem,
      revision_count: revisionCount,
    },
  };
}
