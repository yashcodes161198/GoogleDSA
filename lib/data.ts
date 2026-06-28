import { createClient } from "@/lib/supabase/server";
import type {
  DashboardStats,
  Difficulty,
  InterviewSession,
  InterviewSessionProblem,
  Problem,
  ProblemStatus,
  ProblemWithProgress,
  UserProblem,
} from "@/lib/types";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const [{ data: problems }, { data: userProblems }] = await Promise.all([
    supabase.from("problems").select("*").order("frequency", { ascending: false }),
    supabase.from("user_problems").select("*").eq("user_id", user.id),
  ]);

  const progressMap = new Map(
    (userProblems as UserProblem[] | null)?.map((up) => [up.problem_id, up]) ?? []
  );

  return ((problems as Problem[]) ?? []).map((problem) => {
    const user_problem = progressMap.get(problem.id) ?? null;
    return {
      ...problem,
      user_problem,
      status: (user_problem?.status ?? "unsolved") as ProblemStatus,
    };
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const problems = await getProblemsWithProgress();
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

  return {
    session: session as InterviewSession,
    problems: (sessionProblems as InterviewSessionProblem[]) ?? [],
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
