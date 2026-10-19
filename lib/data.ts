import { cache } from "react";
import { readAllPages, READ_PAGE_SIZE } from "@/lib/read-all-pages";
import type { LeaderboardComment } from "@/lib/leaderboard/comments";
import { DAILY_REVISION_LIMIT, isLocalMode } from "@/lib/config";
import {
  computeInterviewSummaries,
  getLocalUserId,
  getMemoryStore,
} from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/display-name";
import { isPracticeToday } from "@/lib/practice-day";
import { activityBounds, activityAction, activityDayKey, summarizeActivity, type ActivitySummary, type ActivityFilter, type ActivityPeriod, type ScoreActivity } from "@/lib/activity";
import { beforeCursor, cursorPage, type Cursor } from "@/lib/pagination";
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

export async function getCurrentDisplayName(): Promise<string> {
  if (isLocalMode()) return getMemoryStore().displayName;
  return getDisplayName(await getUser());
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
const getProblemsCatalog = cache(async (supabase: Awaited<ReturnType<typeof createClient>>) => {
  if (isLocalMode()) {
    return getMemoryStore().getProblemsCatalog();
  }

  const problems = await readAllPages<Problem, string>(after => {
    const query = supabase.from("problems")
      .select("id,slug,title,difficulty,frequency,acceptance_rate,link,links,topics")
      .order("id", { ascending: true }).limit(READ_PAGE_SIZE);
    return after === null ? query : query.gt("id", after);
  }, row => row.id);
  return enrichProblemsFromCsv(problems).sort((a, b) => b.frequency - a.frequency || a.id.localeCompare(b.id));
});

export async function getWeeklyLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  unavailable: boolean;
}> {
  if (isLocalMode()) {
    return {
      entries: getMemoryStore().getWeeklyLeaderboard().filter((entry, index) => index < 100 || entry.user_id === getLocalUserId()),
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

export async function getLeaderboardComments(parentId: string | null = null, cursor: Cursor | null = null): Promise<{
  comments: LeaderboardComment[];
  nextCursor: Cursor | null;
  error: string | null;
}> {
  if (isLocalMode()) {
    const all = getMemoryStore().getLeaderboardComments();
    const rows = all.filter(comment => comment.parent_id === parentId && beforeCursor(comment, cursor))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .map(comment => ({ ...comment, reply_count: all.filter(reply => reply.parent_id === comment.id).length }));
    const page = cursorPage(rows, 20);
    return { comments: page.items, nextCursor: page.nextCursor, error: null };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_leaderboard_comments_page", {
      p_parent: parentId, p_before: cursor?.created_at ?? null, p_id: cursor?.id ?? null,
    });
    if (error) throw error;
    const rows = (data ?? []) as (Omit<LeaderboardComment, "media_url"> & { media_path: string | null })[];
    const bucket = supabase.storage.from("leaderboard-comment-media");
    const page = cursorPage(rows, 20);
    return {
      comments: page.items.map(({ media_path, ...comment }) => ({
        ...comment,
        media_kind: comment.media_kind ?? null,
        media_url: media_path ? bucket.getPublicUrl(media_path).data.publicUrl : null,
      })),
      nextCursor: page.nextCursor,
      error: null,
    };
  } catch (error) {
    console.error("Failed to load leaderboard comments", error);
    return { comments: [], nextCursor: null, error: "Discussion could not be loaded. Try refreshing the page." };
  }
}

export async function getScoreActivity(now = new Date(), options: {
  userId?: string;
  period?: ActivityPeriod;
  cursor?: Cursor | null;
  filter?: ActivityFilter;
  day?: string | null;
  includeSummary?: boolean;
} = {}): Promise<{
  events: ScoreActivity[];
  summary: ActivitySummary[];
  nextCursor: Cursor | null;
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { events: [], summary: [], nextCursor: null, error: "Sign in to view score history." };
  // Leaderboard awards are readable by every authenticated user under migration 013.
  const userId = options.userId ?? user.id;
  if (isLocalMode()) {
    const all = getMemoryStore().getScoreActivity(userId, now, options.period);
    const page = cursorPage(all.filter(event => beforeCursor(event, options.cursor ?? null) &&
      (!options.day || activityDayKey(event.created_at) === options.day) &&
      (!options.filter || options.filter === "all" || activityAction(event) === options.filter)), 50);
    return { events: page.items, summary: options.includeSummary === false ? [] : summarizeActivity(all), nextCursor: page.nextCursor, error: null };
  }

  try {
    const supabase = await createClient();
    const { start, end } = activityBounds(now, options.period);
    const { data, error } = await supabase.rpc("get_score_activity_page", {
      p_user: userId, p_start: start.toISOString(), p_end: end.toISOString(),
      p_before: options.cursor?.created_at ?? null, p_id: options.cursor?.id ?? null,
      p_action: options.filter ?? "all", p_day: options.day ?? null, p_summary: options.includeSummary !== false,
    });
    if (error) throw error;
    const result = data as { events: ScoreActivity[]; summary: ActivitySummary[] };
    const page = cursorPage(result.events, 50);
    return { events: page.items, summary: result.summary, nextCursor: page.nextCursor, error: null };
  } catch (error) {
    console.error("Failed to load score activity", error);
    return { events: [], summary: [], nextCursor: null, error: "Score history could not be loaded. Try again in a moment." };
  }
}

export async function getProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getProblemsForUser(user.id, isLocalMode() ? null : await createClient());
}

// Callers must authenticate before supplying this request's user and client.
export async function getProblemsForUser(userId: string, supabase: Awaited<ReturnType<typeof createClient>> | null): Promise<ProblemWithProgress[]> {
  if (isLocalMode()) {
    return getMemoryStore().getProblemsWithProgress(userId).map(problem => ({
      ...problem, user_problem: problem.user_problem ? practiceProgress(problem.user_problem) : null,
    }));
  }

  if (!supabase) throw new Error("Authenticated client required");
  const [problems, userProblems] = await Promise.all([
    getProblemsCatalog(supabase),
    getUserProgress(supabase, userId),
  ]);

  const progressMap = new Map(
    userProblems.map((up) => [up.problem_id, up])
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

function getUserProgress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return readAllPages<UserProblem, string>(after => {
    const query = supabase.from("user_problems")
      .select("user_id,problem_id,status,solved_at,ease_factor,interval_days,repetitions,next_review_at,last_reviewed_at,revision_count,last_revised_at,daily_revision_count,last_solve_seconds,best_solve_seconds,is_favorite")
      .eq("user_id", userId).order("problem_id", { ascending: true }).limit(READ_PAGE_SIZE);
    return after === null ? query : query.gt("problem_id", after);
  }, row => row.problem_id);
}

function practiceProgress(progress: UserProblem): Omit<UserProblem, "notes"> {
  // Keep local fixtures and hosted payloads on the same projection.
  const { user_id, problem_id, status, solved_at, ease_factor, interval_days, repetitions,
    next_review_at, last_reviewed_at, revision_count, last_revised_at, daily_revision_count,
    last_solve_seconds, best_solve_seconds, is_favorite } = progress;
  return { user_id, problem_id, status, solved_at, ease_factor, interval_days, repetitions,
    next_review_at, last_reviewed_at, revision_count, last_revised_at, daily_revision_count,
    last_solve_seconds, best_solve_seconds, is_favorite };
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
  return computeStatsFromProblems(problems ?? (await getProblemsWithProgress()));
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

  type Row = {
    session_id: string;
    position: number;
    completed: boolean;
    problem_id: string;
    problem: { difficulty: Difficulty; title: string } | null;
  };
  const sessionProblems = (await Promise.all(sessions.map(session => readAllPages<Row, number>(after => {
    const query = supabase.from("interview_session_problems")
      .select("session_id,position,completed,problem_id,problem:problems(difficulty,title)")
      .eq("session_id", session.id).order("position").limit(READ_PAGE_SIZE);
    return (after === null ? query : query.gt("position", after)).returns<Row[]>();
  }, row => row.position)))).flat();
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
    session.status = "completed";
  }

  const rows = await readAllPages<InterviewSessionProblem, number>(after => {
    const query = supabase.from("interview_session_problems")
      .select("*, problem:problems(*)").eq("session_id", sessionId)
      .order("position").limit(READ_PAGE_SIZE);
    return after === null ? query : query.gt("position", after);
  }, row => row.position);
  const problemIds = rows.map((r) => r.problem_id);

  const globalStatusByProblem = new Map<string, ProblemStatus>();
  const lastSolveByProblem = new Map<string, number | null>();
  const bestSolveByProblem = new Map<string, number | null>();
  const favoriteByProblem = new Map<string, boolean>();
  if (problemIds.length > 0) {
    const userProblems = await getUserProgress(supabase, user.id);

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

export async function getActiveInterviewSession(): Promise<InterviewSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (isLocalMode()) {
    return getMemoryStore().getActiveInterviewSession(getLocalUserId());
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as InterviewSession) ?? null;
}

export function difficultyLabel(d: Difficulty) {
  return d.charAt(0) + d.slice(1).toLowerCase();
}
