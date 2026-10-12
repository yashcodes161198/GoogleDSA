import { compareQuestionDifficulty } from "@/components/question-order";
import type { ProblemWithProgress } from "@/lib/types";

export type ProblemSortColumn = "title" | "difficulty" | "frequency" | "progress";
export type ProblemSort = {
  column: ProblemSortColumn;
  direction: "ascending" | "descending";
} | null;

export function nextProblemSort(sort: ProblemSort, column: ProblemSortColumn): ProblemSort {
  if (sort?.column !== column) return { column, direction: "ascending" };
  return sort.direction === "ascending" ? { column, direction: "descending" } : null;
}

function progressRank(problem: ProblemWithProgress): number {
  return problem.status === "unsolved" ? 0 : 1 + (problem.user_problem?.revision_count ?? 0);
}

function progressTime(problem: ProblemWithProgress): number {
  if (problem.status === "unsolved") return 0;
  const date = (problem.user_problem?.revision_count ?? 0) > 0
    ? problem.user_problem?.last_revised_at
    : problem.user_problem?.solved_at;
  return date ? new Date(date).getTime() : 0;
}

export function sortProblems(problems: readonly ProblemWithProgress[], sort: ProblemSort): ProblemWithProgress[] {
  const rows = [...problems];
  if (!sort) return rows.sort(compareQuestionDifficulty);
  const direction = sort.direction === "ascending" ? 1 : -1;
  return rows.sort((a, b) => {
    switch (sort.column) {
      case "title":
        return direction * a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true });
      case "difficulty":
        return direction * compareQuestionDifficulty(a, b);
      case "frequency":
        return direction * (a.frequency - b.frequency);
      case "progress":
        return direction * (progressRank(a) - progressRank(b)) || progressTime(a) - progressTime(b);
    }
  });
}
