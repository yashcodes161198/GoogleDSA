-- Multi-provider problem links (LeetCode, GFG, TakeUForward)
ALTER TABLE problems ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE problems
SET links = jsonb_build_array(jsonb_build_object('provider', 'leetcode', 'url', link))
WHERE links = '[]'::jsonb
  AND link LIKE '%leetcode.com/problems/%';

UPDATE problems
SET links = jsonb_build_array(jsonb_build_object('provider', 'gfg', 'url', link))
WHERE links = '[]'::jsonb
  AND link LIKE '%geeksforgeeks.org/%';

UPDATE problems
SET links = jsonb_build_array(jsonb_build_object('provider', 'tuf', 'url', link))
WHERE links = '[]'::jsonb
  AND link LIKE '%takeuforward.org/%';

UPDATE problems
SET links = jsonb_build_array(jsonb_build_object('provider', 'leetcode', 'url', link))
WHERE links = '[]'::jsonb
  AND link IS NOT NULL
  AND link <> '';
