import type { Difficulty, ProblemWithProgress } from "@/lib/types";

const TARGET_MIX: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 3,
  HARD: 1,
};

function topicOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

function totalTopicOverlap(selected: ProblemWithProgress[], candidate: ProblemWithProgress): number {
  return selected.reduce((sum, p) => sum + topicOverlap(p.topics, candidate.topics), 0);
}

function weightedPick(candidates: ProblemWithProgress[]): ProblemWithProgress {
  const totalWeight = candidates.reduce((sum, p) => sum + p.frequency, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.frequency;
    if (roll <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

function sortPool(problems: ProblemWithProgress[]): ProblemWithProgress[] {
  // Interview selection ignores global solved/unsolved status so previously
  // solved problems can still appear in a new mock interview.
  return [...problems].sort((a, b) => {
    const aReview = a.user_problem?.next_review_at
      ? new Date(a.user_problem.next_review_at).getTime()
      : 0;
    const bReview = b.user_problem?.next_review_at
      ? new Date(b.user_problem.next_review_at).getTime()
      : 0;
    if (aReview !== bReview) return aReview - bReview;

    return b.frequency - a.frequency;
  });
}

export function selectInterviewProblems(
  problems: ProblemWithProgress[],
  count = 5
): ProblemWithProgress[] {
  const pool = sortPool(problems);
  const selected: ProblemWithProgress[] = [];
  const usedIds = new Set<string>();

  const buckets: Record<Difficulty, ProblemWithProgress[]> = {
    EASY: pool.filter((p) => p.difficulty === "EASY"),
    MEDIUM: pool.filter((p) => p.difficulty === "MEDIUM"),
    HARD: pool.filter((p) => p.difficulty === "HARD"),
  };

  const pickFromBucket = (difficulty: Difficulty) => {
    const available = buckets[difficulty].filter((p) => !usedIds.has(p.id));
    if (available.length === 0) return null;

    const topCandidates = available
      .slice(0, Math.min(15, available.length))
      .sort((a, b) => totalTopicOverlap(selected, a) - totalTopicOverlap(selected, b));

    const diversePool = topCandidates.slice(0, Math.min(5, topCandidates.length));
    const pick = weightedPick(diversePool.length > 0 ? diversePool : available);
    usedIds.add(pick.id);
    selected.push(pick);
    return pick;
  };

  (["EASY", "MEDIUM", "HARD"] as Difficulty[]).forEach((diff) => {
    for (let i = 0; i < TARGET_MIX[diff]; i++) {
      if (selected.length >= count) break;
      pickFromBucket(diff);
    }
  });

  while (selected.length < count) {
    const remaining = pool.filter((p) => !usedIds.has(p.id));
    if (remaining.length === 0) break;
    const pick = weightedPick(remaining.slice(0, 20));
    usedIds.add(pick.id);
    selected.push(pick);
  }

  return selected;
}
