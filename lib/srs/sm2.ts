import type { ReviewRating } from "@/lib/types";

export interface SrsState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SrsResult extends SrsState {
  next_review_at: Date;
}

const MIN_EASE = 1.3;

export function initialSrsOnSolve(): SrsResult {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return {
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_at: next,
  };
}

export function applyReview(
  state: SrsState,
  rating: ReviewRating,
  now = new Date()
): SrsResult {
  let { ease_factor, interval_days, repetitions } = state;

  if (rating === "again") {
    repetitions = 0;
    interval_days = 1;
    ease_factor = Math.max(MIN_EASE, ease_factor - 0.2);
  } else {
    if (rating === "hard") {
      ease_factor = Math.max(MIN_EASE, ease_factor - 0.15);
      interval_days = Math.max(1, Math.round(interval_days * 1.2));
    } else if (rating === "easy") {
      ease_factor = ease_factor + 0.15;
      if (repetitions === 0) {
        interval_days = 4;
      } else if (repetitions === 1) {
        interval_days = Math.round(interval_days * 1.3 * ease_factor);
      } else {
        interval_days = Math.round(interval_days * ease_factor * 1.3);
      }
    } else {
      // good — standard SM-2
      if (repetitions === 0) {
        interval_days = 1;
      } else if (repetitions === 1) {
        interval_days = 6;
      } else {
        interval_days = Math.round(interval_days * ease_factor);
      }
    }
    repetitions += 1;
  }

  const next_review_at = new Date(now);
  next_review_at.setDate(next_review_at.getDate() + Math.max(1, interval_days));

  return { ease_factor, interval_days, repetitions, next_review_at };
}
