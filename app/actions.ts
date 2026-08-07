"use server";

import { revalidatePath } from "next/cache";
import { isLocalMode } from "@/lib/config";
import { getLocalUserId, getMemoryStore } from "@/lib/memory/store";
import {
  expireStaleInterviewSessions,
  getProblemsWithProgress,
  getCurrentUser,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { selectInterviewProblems } from "@/lib/interview/selectProblems";
import { initialSrsOnSolve } from "@/lib/srs/sm2";
import type { ProblemStatus } from "@/lib/types";

export type StartInterviewResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

function startInterviewErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Not authenticated") {
    return error.message;
  }
  if (
    error instanceof Error &&
    error.message.startsWith("Not enough interview problems")
  ) {
    return error.message;
  }
  return "Could not start the interview. Please verify the Supabase schema and problems catalog, then try again.";
}

export async function updateProblemStatus(problemId: string, status: ProblemStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();

  if (isLocalMode()) {
    const store = getMemoryStore();
    const patch: Parameters<typeof store.upsertUserProblem>[2] = { status };
    if (status === "solved") {
      const srs = initialSrsOnSolve();
      Object.assign(patch, {
        solved_at: now,
        ease_factor: srs.ease_factor,
        interval_days: srs.interval_days,
        repetitions: srs.repetitions,
        next_review_at: srs.next_review_at.toISOString(),
      });
    }
    store.upsertUserProblem(getLocalUserId(), problemId, patch);
  } else {
    const supabase = await createClient();
    const payload: Record<string, unknown> = {
      user_id: user.id,
      problem_id: problemId,
      status,
    };

    if (status === "solved") {
      const srs = initialSrsOnSolve();
      Object.assign(payload, {
        solved_at: now,
        ease_factor: srs.ease_factor,
        interval_days: srs.interval_days,
        repetitions: srs.repetitions,
        next_review_at: srs.next_review_at.toISOString(),
      });
    }

    const { error } = await supabase.from("user_problems").upsert(payload, {
      onConflict: "user_id,problem_id",
    });
    if (error) throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath("/revise");
}

export async function updateProblemNotes(problemId: string, notes: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    const store = getMemoryStore();
    const existing = store
      .getProblemsWithProgress(getLocalUserId())
      .find((p) => p.id === problemId);
    store.upsertUserProblem(getLocalUserId(), problemId, {
      status: existing?.status ?? "unsolved",
      notes,
    });
  } else {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("user_problems")
      .select("status")
      .eq("user_id", user.id)
      .eq("problem_id", problemId)
      .maybeSingle();

    const { error } = await supabase.from("user_problems").upsert(
      {
        user_id: user.id,
        problem_id: problemId,
        notes,
        status: existing?.status ?? "unsolved",
      },
      { onConflict: "user_id,problem_id" }
    );
    if (error) throw error;
  }
  revalidatePath("/problems");
}

export async function markProblemRevised(problemId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    getMemoryStore().markRevised(getLocalUserId(), problemId);
  } else {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("user_problems")
      .select("status, revision_count")
      .eq("user_id", user.id)
      .eq("problem_id", problemId)
      .single();

    if (!existing || existing.status !== "solved") {
      throw new Error("Only solved problems can be revised");
    }

    const { error } = await supabase
      .from("user_problems")
      .update({
        revision_count: (existing.revision_count ?? 0) + 1,
        last_revised_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("problem_id", problemId);

    if (error) throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/revise");
}

export async function startInterviewSession(
  forceNew = true
): Promise<StartInterviewResult> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const problems = await getProblemsWithProgress();
    const selected = selectInterviewProblems(problems, 5);
    const problemIds = selected.map((p) => p.id);

    if (problemIds.length !== 5) {
      throw new Error(
        "Not enough interview problems are available. Please seed the problems catalog and try again."
      );
    }

    if (isLocalMode()) {
      const sessionId = getMemoryStore().createInterviewSession(
        getLocalUserId(),
        problemIds,
        forceNew
      );
      return { ok: true, sessionId };
    }

    const supabase = await createClient();
    await expireStaleInterviewSessions(user.id);

    if (!forceNew) {
      const { data: active } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) return { ok: true, sessionId: active.id as string };
    } else {
      const { error: closeActiveError } = await supabase
        .from("interview_sessions")
        .update({ status: "completed" })
        .eq("user_id", user.id)
        .eq("status", "active");

      if (closeActiveError) throw closeActiveError;
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000);

    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: user.id,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      throw sessionError ?? new Error("Failed to create session");
    }

    const rows = problemIds.map((problemId, i) => ({
      session_id: session.id,
      problem_id: problemId,
      position: i + 1,
      completed: false,
    }));

    const { error: problemsError } = await supabase
      .from("interview_session_problems")
      .insert(rows);

    if (problemsError) throw problemsError;

    return { ok: true, sessionId: session.id as string };
  } catch (error) {
    console.error("Failed to start interview", error);
    return { ok: false, error: startInterviewErrorMessage(error) };
  }
}

async function syncInterviewCompletionToProgress(
  userId: string,
  problemId: string,
  completed: boolean
) {
  if (!completed) return;

  if (isLocalMode()) {
    getMemoryStore().syncSolvedFromInterview(getLocalUserId(), problemId);
    return;
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_problems")
    .select("status")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .maybeSingle();

  if (existing?.status === "solved") return;

  const now = new Date().toISOString();
  const srs = initialSrsOnSolve();
  const { error } = await supabase.from("user_problems").upsert(
    {
      user_id: userId,
      problem_id: problemId,
      status: "solved",
      solved_at: now,
      ease_factor: srs.ease_factor,
      interval_days: srs.interval_days,
      repetitions: srs.repetitions,
      next_review_at: srs.next_review_at.toISOString(),
    },
    { onConflict: "user_id,problem_id" }
  );
  if (error) throw error;
}

export async function updateInterviewProblem(
  sessionId: string,
  problemId: string,
  completed: boolean,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    getMemoryStore().updateInterviewProblem(
      getLocalUserId(),
      sessionId,
      problemId,
      completed,
      notes
    );
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from("interview_session_problems")
      .update({ completed, notes: notes ?? null })
      .eq("session_id", sessionId)
      .eq("problem_id", problemId);

    if (error) throw error;
  }

  await syncInterviewCompletionToProgress(user.id, problemId, completed);

  revalidatePath(`/interview/${sessionId}`);
  if (completed) {
    revalidatePath("/dashboard");
    revalidatePath("/problems");
    revalidatePath("/revise");
  }
}

export async function endInterviewSession(
  sessionId: string,
  status: "completed" | "abandoned" = "completed"
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  let completedRows: { problem_id: string }[] = [];

  if (isLocalMode()) {
    completedRows = getMemoryStore().endInterviewSession(
      getLocalUserId(),
      sessionId,
      status
    );
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from("interview_sessions")
      .update({ status })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) throw error;

    const { data } = await supabase
      .from("interview_session_problems")
      .select("problem_id")
      .eq("session_id", sessionId)
      .eq("completed", true);

    completedRows = data ?? [];
  }

  for (const row of completedRows) {
    await syncInterviewCompletionToProgress(user.id, row.problem_id, true);
  }

  revalidatePath("/interview");
  revalidatePath(`/interview/${sessionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath("/revise");
}
