import { PROBLEM_PROGRESS_FILTERS, type ProblemProgressStatus } from "@/lib/revision/problemProgressStatus";
import { activityDayKey } from "@/lib/activity";
import type { Difficulty, UserProblem } from "@/lib/types";

export type ProblemFilters = {
  search: string;
  difficulty: Difficulty | "ALL";
  status: ProblemProgressStatus | "ALL";
  topic: string;
  frequencyInput: string;
  favoriteFilter: "ALL" | "FAVORITES";
  actionFrom: string;
  actionTo: string;
  page: number;
  pageSize: 25 | 50 | 100 | "all";
};

export const DEFAULT_PROBLEM_FILTERS: ProblemFilters = {
  search: "", difficulty: "ALL", status: "ALL", topic: "ALL",
  frequencyInput: "", favoriteFilter: "ALL", actionFrom: "", actionTo: "", page: 0, pageSize: 50,
};

function choice<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return choices.find(option => option === value) ?? fallback;
}

function readDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function matchesLastActionRange(
  progress: Pick<UserProblem, "solved_at" | "last_revised_at" | "last_reviewed_at"> | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  const times = [progress?.solved_at, progress?.last_revised_at, progress?.last_reviewed_at]
    .map(value => value ? Date.parse(value) : NaN)
    .filter(Number.isFinite);
  if (times.length === 0) return false;
  const day = activityDayKey(new Date(Math.max(...times)));
  return (!from || day >= from) && (!to || day <= to);
}

export function readProblemFilters(params: URLSearchParams, topics?: readonly string[]): ProblemFilters {
  const topic = params.get("topic");
  const frequency = params.get("frequency")?.trim() ?? "";
  const numericFrequency = Number(frequency);
  const page = params.get("page") ?? "1";
  const pageNumber = Number(page);
  const pageSize = choice(params.get("pageSize"), ["25", "50", "100", "all"] as const, "50");
  return {
    search: params.get("search") ?? "",
    difficulty: choice(params.get("difficulty"), ["ALL", "EASY", "MEDIUM", "HARD"] as const, "ALL"),
    status: choice(params.get("status"), ["ALL", ...PROBLEM_PROGRESS_FILTERS.map(([value]) => value)], "ALL"),
    topic: topic && (!topics || topics.includes(topic)) ? topic : "ALL",
    frequencyInput: frequency && Number.isFinite(numericFrequency) && numericFrequency >= 0 && numericFrequency <= 100 ? frequency : "",
    favoriteFilter: params.get("favorites") === "1" ? "FAVORITES" : "ALL",
    actionFrom: readDate(params.get("actionFrom")),
    actionTo: readDate(params.get("actionTo")),
    page: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(pageNumber) ? pageNumber - 1 : 0,
    pageSize: pageSize === "all" ? "all" : pageSize === "25" ? 25 : pageSize === "100" ? 100 : 50,
  };
}

export function writeProblemFilters(params: URLSearchParams, filters: ProblemFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    next.delete(key);
    if (value !== null) next.set(key, value);
  };
  set("search", filters.search || null);
  set("difficulty", filters.difficulty === "ALL" ? null : filters.difficulty);
  set("status", filters.status === "ALL" ? null : filters.status);
  set("topic", filters.topic === "ALL" ? null : filters.topic);
  set("frequency", filters.frequencyInput || null);
  set("favorites", filters.favoriteFilter === "FAVORITES" ? "1" : null);
  set("actionFrom", filters.actionFrom || null);
  set("actionTo", filters.actionTo || null);
  set("page", filters.page > 0 ? String(filters.page + 1) : null);
  set("pageSize", filters.pageSize === 50 ? null : String(filters.pageSize));
  return next;
}
