import { cache } from "react";
import type { LeaderboardComment } from "@/lib/leaderboard/comments";
import { DAILY_REVISION_LIMIT, isLocalMode } from "@/lib/config";
import {
  computeInterviewSummaries,
  getLocalUserId,
  getMemoryStore,
} from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isPracticeToday } from "@/lib/practice-day";
import { activityBounds, type ActivityPeriod, type ScoreActivity } from "@/lib/activity";
import { enrichProblemsFromCsv, enrichProblemFromCsv } from "@/lib/problems-enrich";
import {
  selectRevisionQueue,
  type RevisionQueueOptions,
} from "@/lib/revision/selectRevisionQueue";
import type {
  DashboardStats,
  Difficulty,
  InterviewSession,
  InterviewSessionProblem,
  InterviewSessionSummary,
  LeaderboardEntry,
  Problem,
  ProblemStatus,
  ProblemWithProgress,
  UserProblem,
} from "@/lib/types";

export async function getCurrentUser() {
  return getUser();
}

function revisionStats(problems: ProblemWithProgress[]) {
  const today = new Date();
  let solvedToday = 0;
  let revisionsDoneToday = 0;
  let revisedProblemsToday = 0;
  let notRevisedToday = 0;
  for (const p of problems) {
    const revisedToday = isPracticeToday(p.user_problem?.last_revised_at, today);
    if (revisedToday) {
      revisionsDoneToday += p.user_problem?.daily_revision_count ?? 1;
    }
    if (p.status !== "solved") continue;
    if (isPracticeToday(p.user_problem?.solved_at, today)) solvedToday += 1;
    if (revisedToday) {
      revisedProblemsToday += 1;
    } else {
      notRevisedToday += 1;
    }
  }
  const remainingQuota = Math.max(0, DAILY_REVISION_LIMIT - revisedProblemsToday);
  const revisionsDueToday = Math.min(remainingQuota, notRevisedToday);
  return { solvedToday, revisionsDoneToday, revisionsDueToday };
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
  return enrichProblemsFromCsv((data as Problem[]) ?? []);
});

export async function getWeeklyLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  unavailable: boolean;
}> {
  if (isLocalMode()) {
    return {
      entries: getMemoryStore().getWeeklyLeaderboard(),
      unavailable: false,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_weekly_leaderboard");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      console.error("Weekly leaderboard is not installed", error);
      return { entries: [], unavailable: true };
    }
    throw error;
  }

  const entries = ((data ?? []) as LeaderboardEntry[]).map((entry) => ({
    user_id: entry.user_id,
    display_name: entry.display_name,
    points: Number(entry.points),
    rank: Number(entry.rank),
  }));
  return { entries, unavailable: false };
}

export async function getLeaderboardComments(): Promise<{
  comments: LeaderboardComment[];
  error: string | null;
}> {
  if (isLocalMode()) {
    return { comments: getMemoryStore().getLeaderboardComments(), error: null };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_leaderboard_comments");
    if (error) throw error;
    return { comments: (data ?? []) as LeaderboardComment[], error: null };
  } catch (error) {
    console.error("Failed to load leaderboard comments", error);
    return { comments: [], error: "Discussion could not be loaded. Try refreshing the page." };
  }
}

export async function getScoreActivity(now = new Date(), options: {
  userId?: string;
  period?: ActivityPeriod;
} = {}): Promise<{
  events: ScoreActivity[];
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { events: [], error: "Sign in to view score history." };
  // Leaderboard awards are readable by every authenticated user under migration 013.
  const userId = options.userId ?? user.id;
  if (isLocalMode()) {
    return { events: getMemoryStore().getScoreActivity(userId, now, options.period), error: null };
  }

  try {
    const supabase = await createClient();
    const { start, end } = activityBounds(now, options.period);
    const events: ScoreActivity[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("leaderboard_events")
        .select("id, problem_id, difficulty, event_type, revision_number, points, created_at, problem:problems(title)")
        .eq("user_id", userId)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Omit<ScoreActivity, "problem_title"> & {
        problem: { title: string } | null;
      })[];
      events.push(...rows.map(({ problem, ...event }) => ({
        ...event, problem_title: problem?.title ?? "Unavailable question",
      })));
      if (rows.length < pageSize) break;
    }
    return { events, error: null };
  } catch (error) {
    console.error("Failed to load score activity", error);
    return { events: [], error: "Score history could not be loaded. Try again in a moment." };
  }
}

export async function getProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    return getMemoryStore().getProblemsWithProgress(getLocalUserId());
  }

  const supabase = await createClient();
  const [problems, { data: userProblems, error }] = await Promise.all([
    getProblemsCatalog(),
    supabase.from("user_problems").select("*").eq("user_id", user.id),
  ]);
  if (error) throw error;

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
    unsolved: d.unsolved,
    solvedToday: 0,
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
  const dailyStats = revisionStats(problems);

  const byDifficulty: DashboardStats["byDifficulty"] = {
    EASY: { solved: 0, total: 0 },
    MEDIUM: { solved: 0, total: 0 },
    HARD: { solved: 0, total: 0 },
  };

  const topicMap = new Map<string, { solved: number; total: number }>();

  let solved = 0;
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
    unsolved: problems.length - solved,
    reviewsDue,
    ...dailyStats,
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
  limit = DAILY_REVISION_LIMIT,
  options: Omit<RevisionQueueOptions, "limit"> = {}
): Promise<ProblemWithProgress[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isLocalMode()) {
    return getMemoryStore().getDailyRevisions(
      getLocalUserId(),
      limit,
      options
    );
  }

  const problems = await getProblemsWithProgress();
  return selectRevisionQueue(problems, { limit, ...options });
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

  const globalStatusByProblem = new Map<string, ProblemStatus>();
  const lastSolveByProblem = new Map<string, number | null>();
  const bestSolveByProblem = new Map<string, number | null>();
  const favoriteByProblem = new Map<string, boolean>();
  if (problemIds.length > 0) {
    const { data: userProblems } = await supabase
      .from("user_problems")
      .select(
        "problem_id, status, last_solve_seconds, best_solve_seconds, is_favorite"
      )
      .eq("user_id", user.id)
      .in("problem_id", problemIds);

    for (const up of userProblems ?? []) {
      globalStatusByProblem.set(up.problem_id, up.status as ProblemStatus);
      lastSolveByProblem.set(
        up.problem_id,
        up.last_solve_seconds != null ? Number(up.last_solve_seconds) : null
      );
      bestSolveByProblem.set(
        up.problem_id,
        up.best_solve_seconds != null ? Number(up.best_solve_seconds) : null
      );
      favoriteByProblem.set(up.problem_id, up.is_favorite === true);
    }
  }

  return {
    session: session as InterviewSession,
    problems: rows.map((row) => ({
      ...row,
      problem: row.problem ? enrichProblemFromCsv(row.problem as Problem) : row.problem,
      global_status: globalStatusByProblem.get(row.problem_id) ?? "unsolved",
      last_solve_seconds: lastSolveByProblem.get(row.problem_id) ?? null,
      best_solve_seconds: bestSolveByProblem.get(row.problem_id) ?? null,
      is_favorite: favoriteByProblem.get(row.problem_id) ?? false,
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
