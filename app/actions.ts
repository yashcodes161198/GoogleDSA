"use server";

import { revalidatePath } from "next/cache";
import { getProblemsWithProgress, getCurrentUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { selectInterviewProblems } from "@/lib/interview/selectProblems";
import { applyReview, initialSrsOnSolve } from "@/lib/srs/sm2";
import type { ProblemStatus, ReviewRating } from "@/lib/types";

export async function updateProblemStatus(problemId: string, status: ProblemStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();
  const now = new Date().toISOString();

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

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath("/review");
}

export async function updateProblemNotes(problemId: string, notes: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

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
  revalidatePath("/problems");
}

export async function submitReview(problemId: string, rating: ReviewRating) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_problems")
    .select("*")
    .eq("user_id", user.id)
    .eq("problem_id", problemId)
    .single();

  if (!existing) throw new Error("Problem progress not found");

  const result = applyReview(
    {
      ease_factor: Number(existing.ease_factor),
      interval_days: existing.interval_days,
      repetitions: existing.repetitions,
    },
    rating
  );

  const { error } = await supabase
    .from("user_problems")
    .update({
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      repetitions: result.repetitions,
      next_review_at: result.next_review_at.toISOString(),
      last_reviewed_at: new Date().toISOString(),
      status: "solved",
    })
    .eq("user_id", user.id)
    .eq("problem_id", problemId);

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/review");
}

export async function startInterviewSession() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: active } = await supabase
    .from("interview_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (active) return active.id as string;

  const problems = await getProblemsWithProgress();
  const selected = selectInterviewProblems(problems, 5);

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

  if (sessionError || !session) throw sessionError ?? new Error("Failed to create session");

  const rows = selected.map((p, i) => ({
    session_id: session.id,
    problem_id: p.id,
    position: i + 1,
    completed: false,
  }));

  const { error: problemsError } = await supabase
    .from("interview_session_problems")
    .insert(rows);

  if (problemsError) throw problemsError;

  revalidatePath("/interview");
  return session.id as string;
}

export async function updateInterviewProblem(
  sessionId: string,
  problemId: string,
  completed: boolean,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_session_problems")
    .update({ completed, notes: notes ?? null })
    .eq("session_id", sessionId)
    .eq("problem_id", problemId);

  if (error) throw error;
  revalidatePath(`/interview/${sessionId}`);
}

export async function endInterviewSession(
  sessionId: string,
  status: "completed" | "abandoned" = "completed"
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_sessions")
    .update({ status })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/interview");
  revalidatePath(`/interview/${sessionId}`);
}
