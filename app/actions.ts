"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DAILY_REVISION_LIMIT, isLocalMode } from "@/lib/config";
import { getLocalUserId, getMemoryStore } from "@/lib/memory/store";
import {
  expireStaleInterviewSessions,
  getDailyRevisions,
  getProblemsWithProgress,
  getCurrentUser,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { selectInterviewProblems } from "@/lib/interview/selectProblems";
import {
  DEFAULT_INTERVIEW_CONFIG,
  getInterviewProblemCount,
  type InterviewConfig,
  validateInterviewConfig,
} from "@/lib/interview/config";
import { initialSrsOnSolve } from "@/lib/srs/sm2";
import {
  formValuesFromFormData,
  parseNewProblemForm,
  problemInsertRow,
  type NewProblemFormValues,
} from "@/lib/problems/parseNewProblemInput";
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
    (error.message.startsWith("Not enough") ||
      error.message.startsWith("Question counts") ||
      error.message.startsWith("Choose between") ||
      error.message.startsWith("Duration must"))
  ) {
    return error.message;
  }
  return "Could not start the interview. Please verify the Supabase schema and problems catalog, then try again.";
}

async function awardLeaderboardSolve(problemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_leaderboard_solve", {
    p_problem_id: problemId,
  });
  if (error) console.error("Failed to award leaderboard solve points", error);
}

async function awardLeaderboardRevision(problemId: string, revisionNumber: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_leaderboard_revision", {
    p_problem_id: problemId,
    p_revision_number: revisionNumber,
  });
  if (error) console.error("Failed to award leaderboard revision points", error);
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
    if (status === "solved") {
      store.awardSolve(getLocalUserId(), problemId);
    }
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
    if (status === "solved") {
      await awardLeaderboardSolve(problemId);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath("/revise");
  revalidatePath("/leaderboard");
}

export async function setProblemFavorite(problemId: string, favorite: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    getMemoryStore().setProblemFavorite(getLocalUserId(), problemId, favorite);
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
        status: existing?.status ?? "unsolved",
        is_favorite: favorite,
      },
      { onConflict: "user_id,problem_id" }
    );
    if (error) {
      if (error.code === "42703" || error.message.includes("is_favorite")) {
        throw new Error(
          "Favorites are not available yet. Apply the latest database migration."
        );
      }
      throw error;
    }
  }

  revalidatePath("/problems");
  revalidatePath("/revise");
  revalidatePath("/interview", "layout");
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

export type SaveProblemSolveTimeResult =
  | { ok: true; bestSeconds: number }
  | { ok: false; error: string };

function saveSolveTimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Not authenticated") {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "42703"
  ) {
    return "Solve time tracking is not installed in Supabase. Apply migrations 005 and 006.";
  }
  return "Could not save solve time. Please try again.";
}

export async function saveProblemSolveTime(
  problemId: string,
  seconds: number
): Promise<SaveProblemSolveTimeResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const clamped = Math.max(1, Math.round(seconds));

    if (isLocalMode()) {
      const bestSeconds = getMemoryStore().saveSolveSeconds(
        getLocalUserId(),
        problemId,
        clamped
      );
      revalidatePath("/problems");
      revalidatePath("/revise");
      revalidatePath("/interview", "layout");
      return { ok: true, bestSeconds };
    }

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("user_problems")
      .select("status, best_solve_seconds")
      .eq("user_id", user.id)
      .eq("problem_id", problemId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const existingBest =
      existing?.best_solve_seconds != null
        ? Number(existing.best_solve_seconds)
        : null;
    const bestSeconds =
      existingBest != null ? Math.min(existingBest, clamped) : clamped;

    if (existing) {
      const { error } = await supabase
        .from("user_problems")
        .update({
          last_solve_seconds: clamped,
          best_solve_seconds: bestSeconds,
        })
        .eq("user_id", user.id)
        .eq("problem_id", problemId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("user_problems").insert({
        user_id: user.id,
        problem_id: problemId,
        status: "unsolved",
        last_solve_seconds: clamped,
        best_solve_seconds: bestSeconds,
      });
      if (error) throw error;
    }

    revalidatePath("/problems");
    revalidatePath("/revise");
    revalidatePath("/interview", "layout");
    return { ok: true, bestSeconds };
  } catch (error) {
    console.error("Failed to save solve time", error);
    return { ok: false, error: saveSolveTimeErrorMessage(error) };
  }
}

export async function markProblemRevised(problemId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Not authenticated" };

    if (isLocalMode()) {
      const revisionCount = getMemoryStore().markRevised(
        getLocalUserId(),
        problemId
      );
      revalidatePath("/problems");
      revalidatePath("/revise");
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      return { ok: true as const, revisionCount };
    }

    const supabase = await createClient();
    const { data: revisionCount, error } = await supabase.rpc(
      "increment_user_problem_revision",
      { p_problem_id: problemId }
    );

    if (error) {
      console.error("Failed to increment revision count", error);
      if (error.code === "42703" || error.code === "PGRST202") {
        return {
          ok: false as const,
          error:
            "Revision tracking is not installed in Supabase. Apply migration 004_revision_tracking_rpc.sql.",
        };
      }
      return {
        ok: false as const,
        error: "Could not save this revision. Please try again.",
      };
    }

    await awardLeaderboardRevision(problemId, Number(revisionCount));

    revalidatePath("/problems");
    revalidatePath("/revise");
    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    return {
      ok: true as const,
      revisionCount: Number(revisionCount),
    };
  } catch (error) {
    console.error("Failed to mark problem revised", error);
    return {
      ok: false as const,
      error: "Could not save this revision. Please try again.",
    };
  }
}

export async function refreshRevisionQueue(
  currentIds: string[],
  uncheckedIds: string[]
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Not authenticated" };

    const current = new Set(currentIds.slice(0, DAILY_REVISION_LIMIT));
    const preservedCount = new Set(
      uncheckedIds.filter((id) => current.has(id))
    ).size;
    const replacementCount = Math.max(
      0,
      DAILY_REVISION_LIMIT - preservedCount
    );

    const replacements = await getDailyRevisions(replacementCount, {
      excludeIds: current,
      includeRevisedToday: false,
    });

    return { ok: true as const, replacements };
  } catch (error) {
    console.error("Failed to refresh revision queue", error);
    return {
      ok: false as const,
      error: "Could not refresh the revision queue. Please try again.",
    };
  }
}

export async function startInterviewSession(
  forceNew = true,
  config: InterviewConfig = DEFAULT_INTERVIEW_CONFIG
): Promise<StartInterviewResult> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const configError = validateInterviewConfig(config);
    if (configError) throw new Error(configError);

    const problems = await getProblemsWithProgress();
    const selected = selectInterviewProblems(problems, config.difficultyMix);
    const problemIds = selected.map((p) => p.id);
    const requestedCount = getInterviewProblemCount(config);

    if (problemIds.length !== requestedCount) {
      const selectedCounts = selected.reduce(
        (counts, problem) => {
          counts[problem.difficulty] += 1;
          return counts;
        },
        { EASY: 0, MEDIUM: 0, HARD: 0 }
      );
      const missing = (["EASY", "MEDIUM", "HARD"] as const)
        .filter(
          (difficulty) =>
            selectedCounts[difficulty] < config.difficultyMix[difficulty]
        )
        .map(
          (difficulty) =>
            `${config.difficultyMix[difficulty] - selectedCounts[difficulty]} ${difficulty.toLowerCase()}`
        )
        .join(", ");
      throw new Error(
        `Not enough interview problems are available. Missing: ${missing}.`
      );
    }

    if (isLocalMode()) {
      const sessionId = getMemoryStore().createInterviewSession(
        getLocalUserId(),
        problemIds,
        forceNew,
        config.durationMinutes
      );
      revalidatePath("/interview");
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

      if (active) {
        revalidatePath("/interview");
        return { ok: true, sessionId: active.id as string };
      }
    } else {
      const { error: closeActiveError } = await supabase
        .from("interview_sessions")
        .update({ status: "completed" })
        .eq("user_id", user.id)
        .eq("status", "active");

      if (closeActiveError) throw closeActiveError;
    }

    const startedAt = new Date();
    const endsAt = new Date(
      startedAt.getTime() + config.durationMinutes * 60 * 1000
    );

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

    revalidatePath("/interview");
    return { ok: true, sessionId: session.id as string };
  } catch (error) {
    console.error("Failed to start interview", error);
    return { ok: false, error: startInterviewErrorMessage(error) };
  }
}

export async function startNewInterviewAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const customize = formData.get("customize") === "on";
  const config: InterviewConfig = customize
    ? {
        difficultyMix: {
          EASY: 0,
          MEDIUM: Number(formData.get("mediumCount")),
          HARD: Number(formData.get("hardCount")),
        },
        durationMinutes: Number(formData.get("durationMinutes")),
      }
    : DEFAULT_INTERVIEW_CONFIG;

  const result = await startInterviewSession(true, config);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(`/interview/${result.sessionId}`);
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
  await awardLeaderboardSolve(problemId);
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
    revalidatePath("/leaderboard");
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
  revalidatePath("/leaderboard");
}

export type AddQuestionActionState = {
  error: string;
  fieldErrors?: Partial<Record<keyof NewProblemFormValues, string>>;
  values: NewProblemFormValues;
} | null;

function isDuplicateSlugError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export async function addQuestionAction(
  _prevState: AddQuestionActionState,
  formData: FormData
): Promise<AddQuestionActionState> {
  const values = formValuesFromFormData(formData);

  const user = await getCurrentUser();
  if (!user) {
    return {
      error: "Not authenticated",
      values,
    };
  }
  if (!isAdminUser(user)) {
    return {
      error: "Only admins can add questions.",
      values,
    };
  }

  const parsed = parseNewProblemForm(formData);
  if (!parsed.ok) {
    return {
      error: parsed.error,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const id = randomUUID();
  const row = problemInsertRow(parsed.data, id);

  if (isLocalMode()) {
    const result = getMemoryStore().addProblem(row);
    if (!result.ok) {
      return { error: result.error, values };
    }
  } else {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("problems")
      .select("id")
      .eq("slug", parsed.data.slug)
      .maybeSingle();

    if (existing) {
      return {
        error: "A question with the same links or title already exists.",
        values,
      };
    }

    const { error } = await supabase.from("problems").insert({
      id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      difficulty: parsed.data.difficulty,
      frequency: parsed.data.frequency,
      acceptance_rate: parsed.data.acceptance_rate,
      link: parsed.data.link,
      links: parsed.data.links,
      topics: parsed.data.topics,
    });

    if (error) {
      if (isDuplicateSlugError(error)) {
        return {
          error: "A question with the same links or title already exists.",
          values,
        };
      }
      console.error("Failed to add question", error);
      if (error.code === "42501") {
        return {
          error:
            "Adding questions requires admin access. Apply migration 012_problems_admin_insert_policy.sql and set app_metadata.role to admin (see docs/ADMIN_SETUP.md).",
          values,
        };
      }
      return {
        error: "Could not save this question. Please try again.",
        values,
      };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect("/problems?added=1");
}
