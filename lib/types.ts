export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type ProblemStatus = "unsolved" | "attempted" | "solved";
export type InterviewSessionStatus = "active" | "completed" | "abandoned";
export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  frequency: number;
  acceptance_rate: number;
  link: string;
  topics: string[];
}

export interface UserProblem {
  user_id: string;
  problem_id: string;
  status: ProblemStatus;
  notes: string | null;
  solved_at: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
}

export interface ProblemWithProgress extends Problem {
  user_problem?: UserProblem | null;
  status: ProblemStatus;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  started_at: string;
  ends_at: string;
  status: InterviewSessionStatus;
}

export interface InterviewSessionProblem {
  session_id: string;
  problem_id: string;
  position: number;
  /** Whether this problem was completed in *this* interview session only. */
  completed: boolean;
  notes: string | null;
  problem?: Problem;
  /** Overall catalog progress — display hint only, never drives `completed`. */
  global_status?: ProblemStatus;
}

export interface InterviewSessionSummary {
  session: InterviewSession;
  totalProblems: number;
  totalSolved: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
}

export interface DashboardStats {
  total: number;
  solved: number;
  attempted: number;
  unsolved: number;
  reviewsDue: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
  topicCoverage: { topic: string; solved: number; total: number }[];
}
