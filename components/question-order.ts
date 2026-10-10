import type { Difficulty } from "@/lib/types";

const difficultyOrder: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

export function compareQuestionDifficulty(
  a: { difficulty?: Difficulty },
  b: { difficulty?: Difficulty },
) {
  return (
    (a.difficulty ? difficultyOrder[a.difficulty] : 3) -
    (b.difficulty ? difficultyOrder[b.difficulty] : 3)
  );
}
