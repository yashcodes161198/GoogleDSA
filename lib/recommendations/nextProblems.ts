import type { ProblemWithProgress } from "@/lib/types";

export interface RecommendedProblem {
  problem: ProblemWithProgress;
  reason: string;
  priority: number;
}

function topicCoverage(problems: ProblemWithProgress[]) {
  const map = new Map<string, { solved: number; total: number }>();
  for (const p of problems) {
    for (const topic of p.topics.length ? p.topics : ["General"]) {
      const entry = map.get(topic) ?? { solved: 0, total: 0 };
      entry.total += 1;
      if (p.status === "solved") entry.solved += 1;
      map.set(topic, entry);
    }
  }
  return [...map.entries()]
    .map(([topic, stats]) => ({
      topic,
      ...stats,
      ratio: stats.total ? stats.solved / stats.total : 0,
    }))
    .sort((a, b) => a.ratio - b.ratio);
}

export function getNextProblems(
  problems: ProblemWithProgress[],
  limit = 10
): RecommendedProblem[] {
  const recommendations: RecommendedProblem[] = [];
  const used = new Set<string>();

  const add = (problem: ProblemWithProgress, reason: string, priority: number) => {
    if (used.has(problem.id) || recommendations.length >= limit) return;
    used.add(problem.id);
    recommendations.push({ problem, reason, priority });
  };

  const dueRevisions = problems
    .filter((p) => p.status === "solved")
    .sort((a, b) => {
      const aCount = a.user_problem?.revision_count ?? 0;
      const bCount = b.user_problem?.revision_count ?? 0;
      if (aCount !== bCount) return aCount - bCount;
      const aTime = a.user_problem?.last_revised_at
        ? new Date(a.user_problem.last_revised_at).getTime()
        : 0;
      const bTime = b.user_problem?.last_revised_at
        ? new Date(b.user_problem.last_revised_at).getTime()
        : 0;
      return aTime - bTime;
    })
    .slice(0, 5);

  for (const p of dueRevisions) {
    const count = p.user_problem?.revision_count ?? 0;
    add(
      p,
      count === 0 ? "Due for first revision" : `Revision round ${count + 1}`,
      1
    );
  }

  const highFreqUnsolved = problems
    .filter((p) => p.status === "unsolved" && p.frequency >= 60)
    .sort((a, b) => b.frequency - a.frequency);

  for (const p of highFreqUnsolved) {
    add(p, `High Google frequency (${p.frequency.toFixed(1)}%)`, 2);
  }

  const weakTopics = topicCoverage(problems).slice(0, 5);
  for (const { topic } of weakTopics) {
    const candidate = problems
      .filter(
        (p) =>
          p.status !== "solved" &&
          (p.topics.includes(topic) || (topic === "General" && p.topics.length === 0))
      )
      .sort((a, b) => b.frequency - a.frequency)[0];
    if (candidate) add(candidate, `Topic gap: ${topic}`, 3);
  }

  const mediumUnsolved = problems
    .filter((p) => p.status === "unsolved" && p.difficulty === "MEDIUM")
    .sort((a, b) => b.frequency - a.frequency);

  for (const p of mediumUnsolved) {
    add(p, "Common medium-difficulty Google question", 4);
  }

  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, limit);
}

export function estimateDaysToFinish(
  problems: ProblemWithProgress[],
  solvedPerDay = 3
): number | null {
  const remaining = problems.filter((p) => p.status !== "solved").length;
  if (remaining === 0) return 0;
  if (solvedPerDay <= 0) return null;
  return Math.ceil(remaining / solvedPerDay);
}
