"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/config";
import { getLocalUserId, getMemoryStore } from "@/lib/memory/store";
import {
  getProblemsWithProgress,
  getCurrentUser,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { selectInterviewProblems, selectChosenInterviewProblems } from "@/lib/interview/selectProblems";
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
import { requireUuid, requireBoolean, isSolveSeconds } from "@/lib/validation";

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

async function mutateProgress(problemId: string, operation: string, value: unknown, requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mutate_problem_progress", {
    p_problem_id: problemId, p_operation: operation, p_value: value, p_request_id: requestId,
  });
  if (error) throw error;
  return data as { solvedAt: string; revisionCount: number; bestSeconds: number };
}

export async function updateProblemStatus(problemId: string, status: ProblemStatus, refreshRoutes = true, requestId: string = randomUUID()) {
  requireUuid(problemId);
  requireUuid(requestId);
  requireBoolean(refreshRoutes);
  if (status !== "solved" && status !== "unsolved") throw new Error("Invalid status");
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  let now = new Date().toISOString();

  if (isLocalMode()) {
    const store = getMemoryStore();
    now = store.runProgressRequest(user.id, requestId, [problemId, "status", status], () => {
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
      if (status === "solved") store.awardSolve(getLocalUserId(), problemId);
      return now;
    });
  } else {
    now = (await mutateProgress(problemId, "status", status, requestId)).solvedAt;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  if (refreshRoutes) {
    revalidatePath("/problems");
    revalidatePath("/revise");
    revalidatePath("/leaderboard");
  }
  return { solvedAt: now };
}

export async function setProblemFavorite(problemId: string, favorite: boolean, refreshRoutes = true) {
  requireUuid(problemId);
  requireBoolean(favorite);
  requireBoolean(refreshRoutes);
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    getMemoryStore().setProblemFavorite(getLocalUserId(), problemId, favorite);
  } else {
    await mutateProgress(problemId, "favorite", favorite, randomUUID());
  }

  if (refreshRoutes) {
    revalidatePath("/problems");
    revalidatePath("/revise");
    revalidatePath("/interview", "layout");
  }
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
  seconds: number,
  refreshRoutes = true
): Promise<SaveProblemSolveTimeResult> {
  try {
    requireUuid(problemId);
    requireBoolean(refreshRoutes);
    if (!isSolveSeconds(seconds)) return { ok: false, error: "Solve time must be a whole number between 1 and 86,400 seconds." };
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const clamped = seconds;

    if (isLocalMode()) {
      const bestSeconds = getMemoryStore().saveSolveSeconds(
        getLocalUserId(),
        problemId,
        clamped
      );
      if (refreshRoutes) {
        revalidatePath("/problems");
        revalidatePath("/revise");
        revalidatePath("/interview", "layout");
      }
      return { ok: true, bestSeconds };
    }

    const { bestSeconds } = await mutateProgress(problemId, "time", clamped, randomUUID());

    if (refreshRoutes) {
      revalidatePath("/problems");
      revalidatePath("/revise");
      revalidatePath("/interview", "layout");
    }
    return { ok: true, bestSeconds };
  } catch (error) {
    console.error("Failed to save solve time", error);
    return { ok: false, error: saveSolveTimeErrorMessage(error) };
  }
}

export async function markProblemRevised(problemId: string, refreshRoutes = true, requestId: string = randomUUID()) {
  try {
    requireUuid(problemId);
    requireUuid(requestId);
    requireBoolean(refreshRoutes);
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Not authenticated" };

    if (isLocalMode()) {
      const store = getMemoryStore();
      const revisionCount = store.runProgressRequest(user.id, requestId, [problemId, "revise"],
        () => store.markRevised(user.id, problemId));
      revalidatePath("/settings");
      revalidatePath("/dashboard");
      if (refreshRoutes) {
        revalidatePath("/problems");
        revalidatePath("/revise");
        revalidatePath("/leaderboard");
      }
      return { ok: true as const, revisionCount };
    }

    const { revisionCount } = await mutateProgress(problemId, "revise", {}, requestId);

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    if (refreshRoutes) {
      revalidatePath("/problems");
      revalidatePath("/revise");
      revalidatePath("/leaderboard");
    }
    return {
      ok: true as const,
      revisionCount,
    };
  } catch (error) {
    console.error("Failed to mark problem revised", error);
    return {
      ok: false as const,
      error: "Could not save this revision. Please try again.",
    };
  }
}

export async function startInterviewSession(
  forceNew = true,
  config: InterviewConfig = DEFAULT_INTERVIEW_CONFIG
): Promise<StartInterviewResult> {
  try {
    requireBoolean(forceNew);
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const configError = validateInterviewConfig(config);
    if (configError) throw new Error(configError);

    const problems = await getProblemsWithProgress();
    if (config.selectedProblemIds && config.selectedProblemIds.length > problems.length) {
      return { ok: false, error: "Choose questions from the available catalog." };
    }
    const selected =
      config.selectedProblemIds !== undefined
        ? selectChosenInterviewProblems(problems, config.selectedProblemIds)
        : selectInterviewProblems(problems, config.difficultyMix);
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
    const { data: sessionId, error } = await supabase.rpc("start_interview_session", {
      p_problem_ids: problemIds, p_duration_minutes: config.durationMinutes, p_force_new: forceNew,
      p_mode: config.selectedProblemIds !== undefined ? "picked" : "random", p_request_id: randomUUID(),
    });
    if (error) throw error;
    revalidatePath("/interview");
    return { ok: true, sessionId: sessionId as string };
  } catch (error) {
    console.error("Failed to start interview", error);
    return { ok: false, error: startInterviewErrorMessage(error) };
  }
}

export async function startNewInterviewAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  if (!(formData instanceof FormData)) return { error: "Invalid interview form." };
  const customize = formData.get("customize") === "on";
  const selectionMode = formData.get("selectionMode") ?? "random";
  if (customize && selectionMode !== "random" && selectionMode !== "picked") {
    return { error: "Choose random questions or pick your questions." };
  }
  const config: InterviewConfig = customize
    ? {
        difficultyMix: {
          EASY: 0,
          MEDIUM: Number(formData.get("mediumCount")),
          HARD: Number(formData.get("hardCount")),
        },
        durationMinutes: Number(formData.get("durationMinutes")),
        ...(selectionMode === "picked"
          ? { selectedProblemIds: formData.getAll("problemIds").map(String) }
          : {}),
      }
    : DEFAULT_INTERVIEW_CONFIG;

  const result = await startInterviewSession(true, config);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(`/interview/${result.sessionId}`);
}

export async function updateInterviewProblem(
  sessionId: string,
  problemId: string,
  completed: boolean
) {
  requireUuid(sessionId);
  requireUuid(problemId);
  requireBoolean(completed);
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    getMemoryStore().updateInterviewProblem(
      getLocalUserId(),
      sessionId,
      problemId,
      completed
    );
  } else {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_interview_problem_completed", {
      p_session_id: sessionId, p_problem_id: problemId, p_completed: completed,
    });
    if (error) throw error;
  }
  if (isLocalMode() && completed) getMemoryStore().syncSolvedFromInterview(getLocalUserId(), problemId);

  revalidatePath(`/interview/${sessionId}`);
  if (completed) {
    revalidatePath("/settings");
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
  requireUuid(sessionId);
  if (status !== "completed" && status !== "abandoned") throw new Error("Invalid session status");
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isLocalMode()) {
    const completedRows = getMemoryStore().endInterviewSession(
      getLocalUserId(),
      sessionId,
      status
    );
    for (const row of completedRows) getMemoryStore().syncSolvedFromInterview(getLocalUserId(), row.problem_id);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.rpc("finish_interview_session", { p_session_id: sessionId, p_status: status });
    if (error) throw error;
  }

  revalidatePath("/interview");
  revalidatePath(`/interview/${sessionId}`);
  revalidatePath("/settings");
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
  if (!(formData instanceof FormData)) return {
    error: "Invalid question form.", values: formValuesFromFormData(new FormData()),
  };
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
