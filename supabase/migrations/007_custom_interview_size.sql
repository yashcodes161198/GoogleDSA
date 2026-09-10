ALTER TABLE interview_session_problems
  DROP CONSTRAINT IF EXISTS interview_session_problems_position_check;

ALTER TABLE interview_session_problems
  ADD CONSTRAINT interview_session_problems_position_check
  CHECK (position BETWEEN 1 AND 20);
