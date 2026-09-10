import type { Difficulty } from "@/lib/types";

export type InterviewDifficultyMix = Record<Difficulty, number>;

export type InterviewConfig = {
  difficultyMix: InterviewDifficultyMix;
  durationMinutes: number;
};

export const DEFAULT_INTERVIEW_CONFIG: InterviewConfig = {
  difficultyMix: {
    EASY: 1,
    MEDIUM: 3,
    HARD: 1,
  },
  durationMinutes: 120,
};

export const MAX_INTERVIEW_PROBLEMS = 20;
export const MIN_INTERVIEW_DURATION_MINUTES = 15;
export const MAX_INTERVIEW_DURATION_MINUTES = 480;

export function getInterviewProblemCount(config: InterviewConfig): number {
  return Object.values(config.difficultyMix).reduce(
    (total, count) => total + count,
    0
  );
}

export function validateInterviewConfig(
  config: InterviewConfig
): string | null {
  const counts = Object.values(config.difficultyMix);
  if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
    return "Question counts must be whole numbers of zero or more.";
  }

  const total = getInterviewProblemCount(config);
  if (total < 1 || total > MAX_INTERVIEW_PROBLEMS) {
    return `Choose between 1 and ${MAX_INTERVIEW_PROBLEMS} questions in total.`;
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
