import { randomUUID } from "crypto";
import { LOCAL_ADMIN } from "@/lib/config";
import { loadProblemsFromCsv } from "@/lib/problems-csv";
import { initialSrsOnSolve } from "@/lib/srs/sm2";
import type {
  Difficulty,
  InterviewSession,
  InterviewSessionProblem,
  InterviewSessionStatus,
  Problem,
  ProblemStatus,
  ProblemWithProgress,
  UserProblem,
} from "@/lib/types";

type UserProblemRow = UserProblem;

function userProblemKey(userId: string, problemId: string) {
  return `${userId}:${problemId}`;
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

class MemoryStore {
  problems: Problem[] = [];
  userProblems = new Map<string, UserProblemRow>();
  interviewSessions: InterviewSession[] = [];
  interviewSessionProblems: InterviewSessionProblem[] = [];
  private seeded = false;

  ensureSeeded() {
    if (this.seeded) return;
    this.problems = loadProblemsFromCsv();
    this.seeded = true;
  }

  getProblemsCatalog(): Problem[] {
    this.ensureSeeded();
    return [...this.problems].sort((a, b) => b.frequency - a.frequency);
  }

  getProblemsWithProgress(userId: string): ProblemWithProgress[] {
    const problems = this.getProblemsCatalog();
    return problems.map((problem) => {
      const user_problem =
        this.userProblems.get(userProblemKey(userId, problem.id)) ?? null;
      return {
        ...problem,
        user_problem,
        status: (user_problem?.status ?? "unsolved") as ProblemStatus,
      };
    });
  }

  upsertUserProblem(
    userId: string,
    problemId: string,
    patch: Partial<UserProblemRow> & { status: ProblemStatus }
  ) {
    const key = userProblemKey(userId, problemId);
    const existing = this.userProblems.get(key);
    const row: UserProblemRow = {
      user_id: userId,
      problem_id: problemId,
      notes: patch.notes ?? existing?.notes ?? null,
      solved_at: patch.solved_at ?? existing?.solved_at ?? null,
      ease_factor: patch.ease_factor ?? existing?.ease_factor ?? 2.5,
      interval_days: patch.interval_days ?? existing?.interval_days ?? 0,
      repetitions: patch.repetitions ?? existing?.repetitions ?? 0,
      next_review_at: patch.next_review_at ?? existing?.next_review_at ?? null,
      last_reviewed_at:
        patch.last_reviewed_at ?? existing?.last_reviewed_at ?? null,
      revision_count: patch.revision_count ?? existing?.revision_count ?? 0,
      last_revised_at:
        patch.last_revised_at ?? existing?.last_revised_at ?? null,
      status: patch.status,
    };
    this.userProblems.set(key, row);
    return row;
  }

  expireStaleInterviewSessions(userId: string) {
    const now = Date.now();
    for (const session of this.interviewSessions) {
      if (
        session.user_id === userId &&
        session.status === "active" &&
        new Date(session.ends_at).getTime() <= now
      ) {
        session.status = "completed";
      }
    }
  }

  completeActiveSessions(userId: string, status: InterviewSessionStatus = "completed") {
    for (const session of this.interviewSessions) {
      if (session.user_id === userId && session.status === "active") {
        session.status = status;
      }
    }
  }

  getActiveInterviewSession(userId: string): InterviewSession | null {
    this.expireStaleInterviewSessions(userId);
    return (
      this.interviewSessions
        .filter((s) => s.user_id === userId && s.status === "active")
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0] ?? null
    );
  }

  getInterviewSessions(userId: string, limit = 10): InterviewSession[] {
    return this.interviewSessions
      .filter((s) => s.user_id === userId)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )
      .slice(0, limit);
  }

  getInterviewSessionProblems(sessionIds: string[]) {
    return this.interviewSessionProblems.filter((sp) =>
      sessionIds.includes(sp.session_id)
    );
  }

  getInterviewSession(userId: string, sessionId: string) {
    const session = this.interviewSessions.find(
      (s) => s.id === sessionId && s.user_id === userId
    );
    if (!session) return null;

    if (
      session.status === "active" &&
      new Date(session.ends_at).getTime() <= Date.now()
    ) {
      this.expireStaleInterviewSessions(userId);
      session.status = "completed";
    }

    const rows = this.interviewSessionProblems
      .filter((sp) => sp.session_id === sessionId)
      .sort((a, b) => a.position - b.position)
      .map((sp) => ({
        ...sp,
        problem: this.problems.find((p) => p.id === sp.problem_id),
      }));

    const globalStatusByProblem = new Map<string, ProblemStatus>();
    for (const row of rows) {
      const up = this.userProblems.get(userProblemKey(userId, row.problem_id));
      globalStatusByProblem.set(
        row.problem_id,
        (up?.status ?? "unsolved") as ProblemStatus
      );
    }

    return {
      session,
      problems: rows.map((row) => ({
        ...row,
        global_status: globalStatusByProblem.get(row.problem_id) ?? "unsolved",
      })),
    };
  }

  createInterviewSession(
    userId: string,
    problemIds: string[],
    forceNew: boolean
  ): string {
    this.expireStaleInterviewSessions(userId);
    if (forceNew) {
      this.completeActiveSessions(userId, "completed");
    } else {
      const active = this.getActiveInterviewSession(userId);
      if (active) return active.id;
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000);
    const session: InterviewSession = {
      id: randomUUID(),
      user_id: userId,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
    };
    this.interviewSessions.push(session);

    problemIds.forEach((problemId, i) => {
      this.interviewSessionProblems.push({
        session_id: session.id,
        problem_id: problemId,
        position: i + 1,
        completed: false,
        notes: null,
      });
    });

    return session.id;
  }

  updateInterviewProblem(
    userId: string,
    sessionId: string,
    problemId: string,
    completed: boolean,
    notes?: string
  ) {
    const session = this.interviewSessions.find(
      (s) => s.id === sessionId && s.user_id === userId
    );
    if (!session) throw new Error("Session not found");

    const row = this.interviewSessionProblems.find(
      (sp) => sp.session_id === sessionId && sp.problem_id === problemId
    );
    if (!row) throw new Error("Problem not in session");

    row.completed = completed;
    if (notes !== undefined) row.notes = notes;
  }

  endInterviewSession(
    userId: string,
    sessionId: string,
    status: InterviewSessionStatus
  ) {
    const session = this.interviewSessions.find(
      (s) => s.id === sessionId && s.user_id === userId
    );
    if (!session) throw new Error("Session not found");
    session.status = status;
    return this.interviewSessionProblems.filter(
      (sp) => sp.session_id === sessionId && sp.completed
    );
  }

  getDailyRevisions(userId: string, limit: number): ProblemWithProgress[] {
    const today = startOfToday();
    const solved = this.getProblemsWithProgress(userId).filter(
      (p) => p.status === "solved"
    );

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

  markRevised(userId: string, problemId: string) {
    const key = userProblemKey(userId, problemId);
    const existing = this.userProblems.get(key);
    if (!existing || existing.status !== "solved") {
      throw new Error("Only solved problems can be revised");
    }
    const now = new Date().toISOString();
    this.userProblems.set(key, {
      ...existing,
      revision_count: (existing.revision_count ?? 0) + 1,
      last_revised_at: now,
    });
  }

  syncSolvedFromInterview(userId: string, problemId: string) {
    const existing = this.userProblems.get(userProblemKey(userId, problemId));
    if (existing?.status === "solved") return;

    const now = new Date().toISOString();
    const srs = initialSrsOnSolve();
    this.upsertUserProblem(userId, problemId, {
      status: "solved",
      solved_at: now,
      ease_factor: srs.ease_factor,
      interval_days: srs.interval_days,
      repetitions: srs.repetitions,
      next_review_at: srs.next_review_at.toISOString(),
    });
  }
}

const globalForMemory = globalThis as unknown as {
  __googleDsaMemoryStore?: MemoryStore;
};

export function getMemoryStore(): MemoryStore {
  if (!globalForMemory.__googleDsaMemoryStore) {
    globalForMemory.__googleDsaMemoryStore = new MemoryStore();
  }
  return globalForMemory.__googleDsaMemoryStore;
}

export function getLocalUserId(): string {
  return LOCAL_ADMIN.id;
}

export function computeInterviewSummaries(
  sessions: InterviewSession[],
  sessionProblems: InterviewSessionProblem[],
  problems: Problem[]
) {
  const problemById = new Map(problems.map((p) => [p.id, p]));

  return sessions.map((session) => {
    const rows = sessionProblems.filter((sp) => sp.session_id === session.id);
    const byDifficulty: Record<Difficulty, { solved: number; total: number }> =
      {
        EASY: { solved: 0, total: 0 },
        MEDIUM: { solved: 0, total: 0 },
        HARD: { solved: 0, total: 0 },
      };
    let totalSolved = 0;
    const problemTitles: string[] = [];

    for (const row of rows) {
      const problem = problemById.get(row.problem_id);
      if (!problem) continue;
      problemTitles.push(problem.title);
      byDifficulty[problem.difficulty].total += 1;
      if (row.completed) {
        byDifficulty[problem.difficulty].solved += 1;
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
