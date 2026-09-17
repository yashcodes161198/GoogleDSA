import type { ProblemWithProgress } from "@/lib/types";

export const REVISION_SOLVE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export type RevisionQueueOptions = {
  limit: number;
  now?: Date;
  excludeIds?: Iterable<string>;
  includeRevisedToday?: boolean;
};

function startOfDay(date: Date): number {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function wasRevisedToday(
  problem: ProblemWithProgress,
  todayStart: number
): boolean {
  const value = problem.user_problem?.last_revised_at;
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= todayStart && time < todayStart + 24 * 60 * 60 * 1000;
}

function byRevisionPriority(
  a: ProblemWithProgress,
  b: ProblemWithProgress
): number {
  const countDifference =
    (a.user_problem?.revision_count ?? 0) -
    (b.user_problem?.revision_count ?? 0);
  if (countDifference !== 0) return countDifference;

  const aTime = a.user_problem?.last_revised_at
    ? new Date(a.user_problem.last_revised_at).getTime()
    : 0;
  const bTime = b.user_problem?.last_revised_at
    ? new Date(b.user_problem.last_revised_at).getTime()
    : 0;
  return aTime - bTime;
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
  const todayStart = startOfDay(now);

  const eligible = problems.filter((problem) => {
    if (problem.status !== "solved" || excluded.has(problem.id)) return false;
    const solvedAt = problem.user_problem?.solved_at;
    return !solvedAt || new Date(solvedAt).getTime() <= cooldownCutoff;
  });

  const revisedToday = includeRevisedToday
    ? eligible
        .filter((problem) => wasRevisedToday(problem, todayStart))
        .sort((a, b) => {
          const aTime = new Date(
            a.user_problem?.last_revised_at ?? 0
          ).getTime();
          const bTime = new Date(
            b.user_problem?.last_revised_at ?? 0
          ).getTime();
          return aTime - bTime;
        })
    : [];

  const pending = eligible
    .filter((problem) => !wasRevisedToday(problem, todayStart))
    .sort(byRevisionPriority);

  return [...revisedToday, ...pending].slice(0, limit);
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

  return next.slice(0, limit);
}
