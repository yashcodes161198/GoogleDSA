import type { ProblemWithProgress } from "@/lib/types";
import { practiceDayStart } from "@/lib/practice-day";

export const REVISION_SOLVE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export type RevisionQueueOptions = {
  limit: number;
  now?: Date;
  excludeIds?: Iterable<string>;
  includeRevisedToday?: boolean;
};

function wasRevisedToday(
  problem: ProblemWithProgress,
  todayStart: number
): boolean {
  const value = problem.user_problem?.last_revised_at;
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= todayStart && time < todayStart + 24 * 60 * 60 * 1000;
}

function bySolvedTime(
  a: ProblemWithProgress,
  b: ProblemWithProgress
): number {
  const aTime = a.user_problem?.solved_at
    ? new Date(a.user_problem.solved_at).getTime()
    : Infinity;
  const bTime = b.user_problem?.solved_at
    ? new Date(b.user_problem.solved_at).getTime()
    : Infinity;
  return aTime - bTime || a.id.localeCompare(b.id);
}

export function selectRevisionQueue(
  problems: ProblemWithProgress[],
  {
    limit,
    now = new Date(),
    excludeIds = [],
    includeRevisedToday = true,
  }: RevisionQueueOptions
): ProblemWithProgress[] {
  if (limit <= 0) return [];

  const excluded = new Set(excludeIds);
  const cooldownCutoff = now.getTime() - REVISION_SOLVE_COOLDOWN_MS;
  const todayStart = practiceDayStart(now);

  return problems.filter((problem) => {
    if (problem.status !== "solved" || excluded.has(problem.id)) return false;
    const solvedAt = problem.user_problem?.solved_at;
    if (solvedAt && new Date(solvedAt).getTime() > cooldownCutoff) return false;
    return includeRevisedToday || !wasRevisedToday(problem, todayStart);
  }).sort(bySolvedTime).slice(0, limit);
}

export function resetRevisionQueue(
  current: ProblemWithProgress[],
  checkedIds: ReadonlySet<string>,
  candidates: ProblemWithProgress[],
  limit: number
): ProblemWithProgress[] {
  const currentIds = new Set(current.map((problem) => problem.id));
  const used = new Set(
    current
      .filter((problem) => !checkedIds.has(problem.id))
      .map((problem) => problem.id)
  );
  const replacementIds = new Set(currentIds);
  const replacements = candidates.filter((problem) => {
    if (replacementIds.has(problem.id)) return false;
    replacementIds.add(problem.id);
    return true;
  });
  let replacementIndex = 0;

  const next = current.flatMap((problem) => {
    if (!checkedIds.has(problem.id)) return [problem];
    const replacement = replacements[replacementIndex++];
    if (!replacement) return [];
    used.add(replacement.id);
    return [replacement];
  });

  while (next.length < limit && replacementIndex < replacements.length) {
    const replacement = replacements[replacementIndex++];
    if (used.has(replacement.id)) continue;
    used.add(replacement.id);
    next.push(replacement);
  }

  return next.sort(bySolvedTime).slice(0, limit);
}
