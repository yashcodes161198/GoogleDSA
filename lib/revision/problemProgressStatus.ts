export type ProblemProgressStatus =
  | "unsolved"
  | "solved"
  | "revised-once"
  | "revised-twice"
  | "revised-three"
  | "revised-many";

export const PROBLEM_PROGRESS_LABELS: Record<ProblemProgressStatus, string> = {
  unsolved: "Unsolved",
  solved: "Solved",
  "revised-once": "Revised once",
  "revised-twice": "Revised twice",
  "revised-three": "Revised 3 times",
  "revised-many": "Revised 4+ times",
};

export const PROBLEM_PROGRESS_FILTERS = Object.entries(
  PROBLEM_PROGRESS_LABELS
) as [ProblemProgressStatus, string][];

export function getProblemProgressStatus(problem: {
  status: "unsolved" | "solved";
  user_problem?: { revision_count: number } | null;
}): ProblemProgressStatus {
  if (problem.status === "unsolved") return "unsolved";

  const revisionCount = problem.user_problem?.revision_count ?? 0;
  if (revisionCount === 0) return "solved";
  if (revisionCount === 1) return "revised-once";
  if (revisionCount === 2) return "revised-twice";
  if (revisionCount === 3) return "revised-three";
  return "revised-many";
}
