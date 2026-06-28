-- Problems catalog (shared, read-only for authenticated users)
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  frequency NUMERIC NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC NOT NULL DEFAULT 0,
  link TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_frequency ON problems(frequency DESC);

-- Per-user progress and spaced repetition state
CREATE TABLE IF NOT EXISTS user_problems (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unsolved' CHECK (status IN ('unsolved', 'attempted', 'solved')),
  notes TEXT,
  solved_at TIMESTAMPTZ,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_user_problems_status ON user_problems(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_problems_review ON user_problems(user_id, next_review_at);

-- Mock interview sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON interview_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS interview_session_problems (
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  PRIMARY KEY (session_id, problem_id)
);

-- Row Level Security
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_session_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read problems"
  ON problems FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage own progress"
  ON user_problems FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own interview sessions"
  ON interview_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own session problems"
  ON interview_session_problems FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM interview_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
