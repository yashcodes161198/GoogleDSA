import { cache } from "react";
import { DAILY_REVISION_LIMIT, isLocalMode } from "@/lib/config";
import {
  computeInterviewSummaries,
  getLocalUserId,
  getMemoryStore,
} from "@/lib/memory/store";
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: string | null | undefined, day: Date): boolean {
  if (!a) return false;
  const d = new Date(a);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function revisionStats(problems: ProblemWithProgress[]) {
  const today = startOfToday();
  const solved = problems.filter((p) => p.status === "solved");
  let revisionsDoneToday = 0;
  let notRevisedToday = 0;
  for (const p of solved) {
    if (isSameDay(p.user_problem?.last_revised_at, today)) {
      revisionsDoneToday += 1;
    } else {
      notRevisedToday += 1;
    }
  }
  const remainingQuota = Math.max(0, DAILY_REVISION_LIMIT - revisionsDoneToday);
  const revisionsDueToday = Math.min(remainingQuota, notRevisedToday);
  return { revisionsDoneToday, revisionsDueToday };
}

// This query must stay outside unstable_cache: the server Supabase client
// reads the auth session from cookies, and Next.js does not allow request APIs
// such as cookies() inside an unstable_cache scope. React cache() still
// deduplicates the catalog lookup for the current request without breaking
// authentication in production.
const getProblemsCatalog = cache(async () => {
  if (isLocalMode()) {
    return getMemoryStore().getProblemsCatalog();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("frequency", { ascending: false });

  if (error) throw error;
  return (data as Problem[]) ?? [];
});

export async function getProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    return getMemoryStore().getProblemsWithProgress(getLocalUserId());
  }

  const supabase = await createClient();
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

async function getDashboardStatsRpc(
  userId: string
): Promise<DashboardStats | null> {
  if (isLocalMode()) return null;
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
    revisionsDueToday: 0,
    revisionsDoneToday: 0,
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
  const { revisionsDoneToday, revisionsDueToday } = revisionStats(problems);

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
    revisionsDueToday,
    revisionsDoneToday,
    byDifficulty,
    topicCoverage,
  };
}

export async function getDashboardStats(
  problems?: ProblemWithProgress[]
): Promise<DashboardStats> {
  const user = await getCurrentUser();
  if (user && !isLocalMode()) {
    try {
      const rpc = await getDashboardStatsRpc(user.id);
      if (rpc) {
        const list = problems ?? (await getProblemsWithProgress());
        const rev = revisionStats(list);
        return { ...rpc, ...rev };
      }
    } catch {
      // RPC not installed yet — fall back to JS.
    }
  }
  const list = problems ?? (await getProblemsWithProgress());
  return computeStatsFromProblems(list);
}

export async function getDailyRevisions(
  limit = DAILY_REVISION_LIMIT
): Promise<ProblemWithProgress[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    return getMemoryStore().getDailyRevisions(getLocalUserId(), limit);
  }

  const problems = await getProblemsWithProgress();
  const today = startOfToday();
  // Unsolved problems have a logical revision count of zero but never enter
  // this queue. Solved problems with count zero are eligible for their first
  // revision and correctly appear before already-revised problems.
  const solved = problems.filter((p) => p.status === "solved");

  const byRoundRobin = (a: ProblemWithProgress, b: ProblemWithProgress) => {
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
  };

  const revisedToday = solved
    .filter((p) => isSameDay(p.user_problem?.last_revised_at, today))
    .sort(
      (a, b) =>
        new Date(a.user_problem!.last_revised_at!).getTime() -
        new Date(b.user_problem!.last_revised_at!).getTime()
    );

  const pending = solved
    .filter((p) => !isSameDay(p.user_problem?.last_revised_at, today))
    .sort(byRoundRobin);

  const remainingSlots = Math.max(0, limit - revisedToday.length);
  return [...revisedToday, ...pending.slice(0, remainingSlots)].slice(0, limit);
}

export async function getInterviewSessions(): Promise<InterviewSession[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    return getMemoryStore().getInterviewSessions(getLocalUserId());
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (data as InterviewSession[]) ?? [];
}

export async function getInterviewSessionsWithSummary(): Promise<
  InterviewSessionSummary[]
> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    const store = getMemoryStore();
    const sessions = store.getInterviewSessions(getLocalUserId());
    if (sessions.length === 0) return [];
    const sessionIds = sessions.map((s) => s.id);
    const sessionProblems = store.getInterviewSessionProblems(sessionIds);
    return computeInterviewSummaries(
      sessions,
      sessionProblems,
      store.getProblemsCatalog()
    );
  }

  const supabase = await createClient();
  const sessions = await getInterviewSessions();
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sessionProblems } = await supabase
    .from("interview_session_problems")
    .select("session_id, completed, problem_id, problem:problems(difficulty, title)")
    .in("session_id", sessionIds);

  type Row = {
    session_id: string;
    completed: boolean;
    problem_id: string;
    problem: { difficulty: Difficulty; title: string } | null;
  };
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
    const problemTitles: string[] = [];
    for (const row of rows) {
      const difficulty = row.problem?.difficulty;
      if (!difficulty) continue;
      if (row.problem?.title) problemTitles.push(row.problem.title);
      byDifficulty[difficulty].total += 1;
      if (row.completed) {
        byDifficulty[difficulty].solved += 1;
        totalSolved += 1;
      }
    }
    return {
      session,
      totalProblems: rows.length,
      totalSolved,
      byDifficulty,
      problemTitles,
    };
  });
}

export async function getInterviewSession(
  sessionId: string
): Promise<{
  session: InterviewSession;
  problems: InterviewSessionProblem[];
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (isLocalMode()) {
    return getMemoryStore().getInterviewSession(getLocalUserId(), sessionId);
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return null;

  if (
    session.status === "active" &&
    new Date(session.ends_at).getTime() <= Date.now()
  ) {
    await expireStaleInterviewSessions(user.id);
    session.status = "completed";
  }

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

export async function expireStaleInterviewSessions(userId: string): Promise<void> {
  if (isLocalMode()) {
    getMemoryStore().expireStaleInterviewSessions(userId);
    return;
  }
  const supabase = await createClient();
  await supabase
    .from("interview_sessions")
    .update({ status: "completed" })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString());
}

export async function getActiveInterviewSession(): Promise<InterviewSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (isLocalMode()) {
    return getMemoryStore().getActiveInterviewSession(getLocalUserId());
  }

  await expireStaleInterviewSessions(user.id);

  const supabase = await createClient();
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
