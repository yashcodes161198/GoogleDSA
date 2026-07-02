-- Single-query dashboard aggregation (migration 002).
-- Returns one json row with totals, per-difficulty counts, reviews due, and
-- the weakest-12 topic coverage for a user. Powers getDashboardStats() in
-- lib/data.ts; the app falls back to JS aggregation if this function is absent.
create or replace function get_user_dashboard_stats(p_user_id uuid)
returns json
language sql
stable
as $$
  with
    catalog as (
      select count(*)::int as total from problems
    ),
    progress as (
      select
        count(*) filter (where status = 'solved')::int as solved,
        count(*) filter (where status = 'attempted')::int as attempted,
        count(*) filter (
          where status = 'solved'
            and next_review_at is not null
            and next_review_at <= now()
        )::int as reviews_due
      from user_problems
      where user_id = p_user_id
    ),
    by_diff as (
      select p.difficulty,
        count(*)::int as total,
        count(*) filter (where up.status = 'solved')::int as solved
      from problems p
      left join user_problems up
        on up.problem_id = p.id and up.user_id = p_user_id
      group by p.difficulty
    ),
    topic_rows as (
      select t.topic,
        count(*)::int as total,
        count(*) filter (where up.status = 'solved')::int as solved
      from problems p
      left join user_problems up
        on up.problem_id = p.id and up.user_id = p_user_id
      cross join lateral unnest(
        case when cardinality(p.topics) = 0 then array['General'] else p.topics end
      ) as t(topic)
      group by t.topic
    ),
    topic_top as (
      select * from topic_rows
      order by solved::float / nullif(total, 0) asc
      limit 12
    )
  select json_build_object(
    'total', (select total from catalog),
    'solved', (select solved from progress),
    'attempted', (select attempted from progress),
    'unsolved', ((select total from catalog) - (select solved from progress) - (select attempted from progress)),
    'reviewsDue', (select reviews_due from progress),
    'byDifficulty', (
      select json_object_agg(difficulty, json_build_object('solved', solved, 'total', total))
      from by_diff
    ),
    'topicCoverage', (
      select json_agg(json_build_object('topic', topic, 'solved', solved, 'total', total))
      from topic_top
    )
  );
$$;
