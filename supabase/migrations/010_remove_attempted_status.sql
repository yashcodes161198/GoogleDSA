-- Problems are either unsolved or solved. Revision progress is derived from
-- revision_count rather than stored as another status value.
UPDATE user_problems
SET status = 'unsolved'
WHERE status = 'attempted';

ALTER TABLE user_problems
  DROP CONSTRAINT IF EXISTS user_problems_status_check;

ALTER TABLE user_problems
  ADD CONSTRAINT user_problems_status_check
  CHECK (status IN ('unsolved', 'solved'));

CREATE OR REPLACE FUNCTION get_user_dashboard_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH
  catalog AS (
    SELECT count(*)::int AS total FROM problems
  ),
  progress AS (
    SELECT
      count(*) FILTER (WHERE status = 'solved')::int AS solved,
      count(*) FILTER (
        WHERE status = 'solved'
          AND next_review_at IS NOT NULL
          AND next_review_at <= now()
      )::int AS reviews_due
    FROM user_problems
    WHERE user_id = p_user_id
  ),
  by_diff AS (
    SELECT p.difficulty,
      count(*)::int AS total,
      count(*) FILTER (WHERE up.status = 'solved')::int AS solved
    FROM problems p
    LEFT JOIN user_problems up
      ON up.problem_id = p.id AND up.user_id = p_user_id
    GROUP BY p.difficulty
  ),
  topic_rows AS (
    SELECT t.topic,
      count(*)::int AS total,
      count(*) FILTER (WHERE up.status = 'solved')::int AS solved
    FROM problems p
    LEFT JOIN user_problems up
      ON up.problem_id = p.id AND up.user_id = p_user_id
    CROSS JOIN LATERAL unnest(
      CASE WHEN cardinality(p.topics) = 0 THEN ARRAY['General'] ELSE p.topics END
    ) AS t(topic)
    GROUP BY t.topic
  ),
  topic_top AS (
    SELECT * FROM topic_rows
    ORDER BY solved::float / nullif(total, 0) ASC
    LIMIT 12
  )
  SELECT json_build_object(
    'total', (SELECT total FROM catalog),
    'solved', (SELECT solved FROM progress),
    'unsolved', ((SELECT total FROM catalog) - (SELECT solved FROM progress)),
    'reviewsDue', (SELECT reviews_due FROM progress),
    'byDifficulty', (
      SELECT json_object_agg(
        difficulty,
        json_build_object('solved', solved, 'total', total)
      )
      FROM by_diff
    ),
    'topicCoverage', (
      SELECT json_agg(
        json_build_object('topic', topic, 'solved', solved, 'total', total)
      )
      FROM topic_top
    )
  );
$$;
