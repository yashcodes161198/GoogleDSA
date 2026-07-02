import { revalidateTag, unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type {
  DashboardStats,
  Difficulty,
  InterviewSession,
  InterviewSessionProblem,
  InterviewSessionSummary,
  Problem,
  ProblemStatus,
  ProblemWithProgress,
  UserProblem,
} from "@/lib/types";

export async function getCurrentUser() {
  return getUser();
}

// The problems catalog is identical for every authenticated user and only
// changes via the local seed script (which writes to Postgres directly, never
// through the app). Cache it across requests and invalidate with
// `revalidateTag("problems-catalog")` (see revalidateProblemsCatalog) if it
// ever changes at runtime.
const getProblemsCatalog = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("problems")
      .select("*")
      .order("frequency", { ascending: false });
    return (data as Problem[]) ?? [];
  },
  ["problems-catalog-v1"],
  { tags: ["problems-catalog"], revalidate: false }
);

// Call after any change to the shared catalog (e.g. a future admin re-seed
// endpoint). Not needed by the normal app flow.
export async function revalidateProblemsCatalog() {
  revalidateTag("problems-catalog", "default");
}

export async function getProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  // Catalog comes from the shared cache (no DB hit after first load); only the
  // per-user progress rows are fetched fresh.
  const [problems, { data: userProblems }] = await Promise.all([
    getProblemsCatalog(),
    supabase.from("user_problems").select("*").eq("user_id", user.id),
  ]);

  const progressMap = new Map(
    (userProblems as UserProblem[] | null)?.map((up) => [up.problem_id, up]) ?? []
  );

  return (problems as Problem[]).map((problem) => {
    const user_problem = progressMap.get(problem.id) ?? null;
    return {
      ...problem,
      user_problem,
      status: (user_problem?.status ?? "unsolved") as ProblemStatus,
    };
  });
}

type DashboardStatsRpcRow = {
  total: number;
  solved: number;
  attempted: number;
  unsolved: number;
  reviewsDue: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
  topicCoverage: { topic: string; solved: number; total: number }[];
};

// Single round-trip aggregation in Postgres (migration 002). Returns null if
// the function isn't installed yet so callers can fall back to JS aggregation.
async function getDashboardStatsRpc(
  userId: string
): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_dashboard_stats", {
    p_user_id: userId,
  });
  if (error || !data) return null;
  const d = data as DashboardStatsRpcRow;
  const zero = { solved: 0, total: 0 };
  return {
    total: d.total,
    solved: d.solved,
    attempted: d.attempted,
    unsolved: d.unsolved,
    reviewsDue: d.reviewsDue,
    byDifficulty: {
      EASY: d.byDifficulty?.EASY ?? zero,
      MEDIUM: d.byDifficulty?.MEDIUM ?? zero,
      HARD: d.byDifficulty?.HARD ?? zero,
    },
    topicCoverage: (d.topicCoverage ?? []).slice(0, 12),
  };
}

export function computeStatsFromProblems(
  problems: ProblemWithProgress[]
): DashboardStats {
  const now = Date.now();

  const byDifficulty: DashboardStats["byDifficulty"] = {
    EASY: { solved: 0, total: 0 },
    MEDIUM: { solved: 0, total: 0 },
    HARD: { solved: 0, total: 0 },
  };

  const topicMap = new Map<string, { solved: number; total: number }>();

  let solved = 0;
  let attempted = 0;
  let reviewsDue = 0;

  for (const p of problems) {
    byDifficulty[p.difficulty].total += 1;
    if (p.status === "solved") {
      solved += 1;
      byDifficulty[p.difficulty].solved += 1;
      if (
        p.user_problem?.next_review_at &&
        new Date(p.user_problem.next_review_at).getTime() <= now
      ) {
        reviewsDue += 1;
      }
    } else if (p.status === "attempted") {
      attempted += 1;
    }

    for (const topic of p.topics.length ? p.topics : ["General"]) {
      const entry = topicMap.get(topic) ?? { solved: 0, total: 0 };
      entry.total += 1;
      if (p.status === "solved") entry.solved += 1;
      topicMap.set(topic, entry);
    }
  }

  const topicCoverage = [...topicMap.entries()]
    .map(([topic, stats]) => ({ topic, ...stats }))
    .sort((a, b) => a.solved / a.total - b.solved / b.total)
    .slice(0, 12);

  return {
    total: problems.length,
    solved,
    attempted,
    unsolved: problems.length - solved - attempted,
    reviewsDue,
    byDifficulty,
    topicCoverage,
  };
}

// `problems` is optional: pass it when the caller already fetched the list
// (e.g. the dashboard fetches once for both stats and recommendations). When
// omitted the JS fallback fetches it itself.
export async function getDashboardStats(
  problems?: ProblemWithProgress[]
): Promise<DashboardStats> {
  const user = await getCurrentUser();
  if (user) {
    try {
      const rpc = await getDashboardStatsRpc(user.id);
      if (rpc) return rpc;
    } catch {
      // RPC not installed yet (migration 002 pending) — fall back to JS.
    }
  }
  const list = problems ?? (await getProblemsWithProgress());
  return computeStatsFromProblems(list);
}

export async function getDueReviews(limit = 20): Promise<ProblemWithProgress[]> {
  const problems = await getProblemsWithProgress();
  const now = Date.now();
  return problems
    .filter(
      (p) =>
        p.status === "solved" &&
        p.user_problem?.next_review_at &&
        new Date(p.user_problem.next_review_at).getTime() <= now
    )
    .sort(
      (a, b) =>
        new Date(a.user_problem!.next_review_at!).getTime() -
        new Date(b.user_problem!.next_review_at!).getTime()
    )
    .slice(0, limit);
}

export async function getInterviewSessions(): Promise<InterviewSession[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (data as InterviewSession[]) ?? [];
}

// Recent sessions plus a per-difficulty solved/total breakdown for each, so
// the interview list can show "E 1/1 · M 2/3 · H 0/1" inline without a
// separate query per row.
export async function getInterviewSessionsWithSummary(): Promise<
  InterviewSessionSummary[]
> {
  const supabase = await createClient();
  const sessions = await getInterviewSessions();
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sessionProblems } = await supabase
    .from("interview_session_problems")
    .select("session_id, completed, problem:problems(difficulty)")
    .in("session_id", sessionIds);

  type Row = { session_id: string; completed: boolean; problem: { difficulty: Difficulty } | null };
  const bySession = new Map<string, Row[]>();
  for (const row of (sessionProblems as unknown as Row[] | null) ?? []) {
    const list = bySession.get(row.session_id) ?? [];
    list.push(row);
    bySession.set(row.session_id, list);
  }

  return sessions.map((session) => {
    const rows = bySession.get(session.id) ?? [];
    const byDifficulty: InterviewSessionSummary["byDifficulty"] = {
      EASY: { solved: 0, total: 0 },
      MEDIUM: { solved: 0, total: 0 },
      HARD: { solved: 0, total: 0 },
    };
    let totalSolved = 0;
    for (const row of rows) {
      const difficulty = row.problem?.difficulty;
      if (!difficulty) continue;
      byDifficulty[difficulty].total += 1;
      if (row.completed) {
        byDifficulty[difficulty].solved += 1;
        totalSolved += 1;
      }
    }
    return { session, totalProblems: rows.length, totalSolved, byDifficulty };
  });
}

export async function getInterviewSession(
  sessionId: string
): Promise<{
  session: InterviewSession;
  problems: InterviewSessionProblem[];
} | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return null;

  const { data: sessionProblems } = await supabase
    .from("interview_session_problems")
    .select("*, problem:problems(*)")
    .eq("session_id", sessionId)
    .order("position");

  const rows = (sessionProblems as InterviewSessionProblem[]) ?? [];
  const problemIds = rows.map((r) => r.problem_id);

  let globalStatusByProblem = new Map<string, ProblemStatus>();
  if (problemIds.length > 0) {
    const { data: userProblems } = await supabase
      .from("user_problems")
      .select("problem_id, status")
      .eq("user_id", user.id)
      .in("problem_id", problemIds);

    globalStatusByProblem = new Map(
      (userProblems ?? []).map((up) => [up.problem_id, up.status as ProblemStatus])
    );
  }

  return {
    session: session as InterviewSession,
    problems: rows.map((row) => ({
      ...row,
      global_status: globalStatusByProblem.get(row.problem_id) ?? "unsolved",
    })),
  };
}

export async function getActiveInterviewSession(): Promise<InterviewSession | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as InterviewSession) ?? null;
}

export function difficultyLabel(d: Difficulty) {
  return d.charAt(0) + d.slice(1).toLowerCase();
}
