import type { Difficulty } from "@/lib/types";

export type InterviewDifficultyMix = Record<Difficulty, number>;

export type InterviewConfig = {
  difficultyMix: InterviewDifficultyMix;
  durationMinutes: number;
  selectedProblemIds?: string[];
};

export const DEFAULT_INTERVIEW_CONFIG: InterviewConfig = {
  difficultyMix: {
    EASY: 0,
    MEDIUM: 3,
    HARD: 2,
  },
  durationMinutes: 120,
};

export const MAX_INTERVIEW_PROBLEMS = 20;
export const MIN_INTERVIEW_DURATION_MINUTES = 15;
export const MAX_INTERVIEW_DURATION_MINUTES = 480;

export function getInterviewProblemCount(config: InterviewConfig): number {
  if (config.selectedProblemIds !== undefined)
    return config.selectedProblemIds.length;
  return Object.values(config.difficultyMix).reduce(
    (total, count) => total + count,
    0,
  );
}

export function validateInterviewConfig(
  config: InterviewConfig,
): string | null {
  if (config.selectedProblemIds !== undefined) {
    const ids = config.selectedProblemIds;
    if (!Array.isArray(ids) || ids.length === 0)
      return "Select at least one question.";
    if (ids.some((id) => typeof id !== "string" || !id.trim()))
      return "Choose valid questions from the list.";
    if (new Set(ids).size !== ids.length)
      return "Each question can only be selected once.";
  } else {
    const counts = Object.values(config.difficultyMix);
    if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
      return "Question counts must be whole numbers of zero or more.";
    }

    const total = getInterviewProblemCount(config);
    if (total < 1 || total > MAX_INTERVIEW_PROBLEMS) {
      return `Choose between 1 and ${MAX_INTERVIEW_PROBLEMS} questions in total.`;
    }
  }

  if (
    !Number.isInteger(config.durationMinutes) ||
    config.durationMinutes < MIN_INTERVIEW_DURATION_MINUTES ||
    config.durationMinutes > MAX_INTERVIEW_DURATION_MINUTES
  ) {
    return `Duration must be between ${MIN_INTERVIEW_DURATION_MINUTES} and ${MAX_INTERVIEW_DURATION_MINUTES} minutes.`;
  }

  return null;
}
