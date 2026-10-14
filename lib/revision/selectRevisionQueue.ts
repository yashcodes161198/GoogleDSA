import type { ProblemWithProgress } from "@/lib/types";

export const REVISION_SOLVE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export type RevisionQueueOptions = {
  limit: number;
  now?: Date;
  excludeIds?: Iterable<string>;
};

function timestamp(value: string | null | undefined): number {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Infinity : time;
}

export function compareRevisionPriority(
  a: ProblemWithProgress,
  b: ProblemWithProgress
): number {
  const aUnrevised = (a.user_problem?.revision_count ?? 0) === 0;
  const bUnrevised = (b.user_problem?.revision_count ?? 0) === 0;
  if (aUnrevised !== bUnrevised) return aUnrevised ? -1 : 1;

  const aTime = timestamp(aUnrevised
    ? a.user_problem?.solved_at
    : a.user_problem?.last_revised_at);
  const bTime = timestamp(bUnrevised
    ? b.user_problem?.solved_at
    : b.user_problem?.last_revised_at);
  return aTime - bTime ||
    timestamp(a.user_problem?.solved_at) - timestamp(b.user_problem?.solved_at) ||
    a.id.localeCompare(b.id);
}

export function selectRevisionQueue(
  problems: ProblemWithProgress[],
  {
    limit,
    now = new Date(),
    excludeIds = [],
  }: RevisionQueueOptions
): ProblemWithProgress[] {
  if (limit <= 0) return [];

  const excluded = new Set(excludeIds);
  const cooldownCutoff = now.getTime() - REVISION_SOLVE_COOLDOWN_MS;

  return problems.filter((problem) => {
    if (problem.status !== "solved" || excluded.has(problem.id)) return false;
    const progress = problem.user_problem;
    return (!progress?.solved_at || timestamp(progress.solved_at) <= cooldownCutoff) &&
      (!progress?.last_revised_at || timestamp(progress.last_revised_at) <= cooldownCutoff);
  }).sort(compareRevisionPriority).slice(0, limit);
}

export function materializeRevisionQueue(
  queueIds: readonly string[],
  library: ProblemWithProgress[]
): ProblemWithProgress[] {
  const byId = new Map(library.map(problem => [problem.id, problem]));
  return queueIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
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

  return next.sort(compareRevisionPriority).slice(0, limit);
}
