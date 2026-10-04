import type { ProblemWithProgress, UserProblem } from "@/lib/types";

export function withProblemFavorite(
  problem: ProblemWithProgress,
  favorite: boolean
): ProblemWithProgress {
  const current = problem.user_problem;
  const user_problem: UserProblem = current
    ? { ...current, is_favorite: favorite }
    : {
        user_id: "",
        problem_id: problem.id,
        status: problem.status,
        notes: null,
        solved_at: null,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        revision_count: 0,
        last_revised_at: null,
        last_solve_seconds: null,
        best_solve_seconds: null,
        is_favorite: favorite,
      };

  return { ...problem, user_problem };
}
