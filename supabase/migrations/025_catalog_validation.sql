-- Validate future catalog writes without rewriting previously imported links.
CREATE FUNCTION public.valid_problem_provider_url(provider TEXT, url TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(length(url) <= 2048 AND CASE provider
    WHEN 'leetcode' THEN url ~ '^https://(www\.)?leetcode\.com/problems/[a-zA-Z0-9_-]+/?$'
    WHEN 'gfg' THEN url ~ '^https://(www\.|practice\.)?geeksforgeeks\.org/problems/[a-zA-Z0-9_-]+(/[0-9]+)?/?$'
    WHEN 'tuf' THEN url ~ '^https://(www\.)?takeuforward\.org/plus/dsa/problems/[a-zA-Z0-9_-]+/?$'
    ELSE false END, false);
$$;

CREATE FUNCTION public.validate_problem_catalog_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE entry JSONB;
BEGIN
  IF NEW.title IS NULL OR length(btrim(NEW.title)) NOT BETWEEN 1 AND 200
    OR NEW.frequency IS NULL OR NEW.frequency NOT BETWEEN 0 AND 100
    OR NEW.acceptance_rate IS NULL OR NEW.acceptance_rate NOT BETWEEN 0 AND 100
    OR NEW.topics IS NULL OR cardinality(NEW.topics)>20 OR coalesce(array_ndims(NEW.topics),1)<>1
    OR EXISTS(SELECT 1 FROM unnest(NEW.topics) topic WHERE topic IS NULL OR length(btrim(topic)) NOT BETWEEN 1 AND 80)
    THEN RAISE EXCEPTION 'Invalid catalog fields'; END IF;
  IF NEW.links IS NULL OR jsonb_typeof(NEW.links)<>'array' THEN RAISE EXCEPTION 'Invalid problem links'; END IF;
  IF jsonb_array_length(NEW.links)>3 THEN RAISE EXCEPTION 'Invalid problem links'; END IF;
  IF NOT (public.valid_problem_provider_url('leetcode',NEW.link)
    OR public.valid_problem_provider_url('gfg',NEW.link)
    OR public.valid_problem_provider_url('tuf',NEW.link)) THEN RAISE EXCEPTION 'Invalid provider URL'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.links) LOOP
    IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'provider') IS DISTINCT FROM 'string'
      OR jsonb_typeof(entry->'url') IS DISTINCT FROM 'string'
      OR NOT public.valid_problem_provider_url(entry->>'provider',entry->>'url') THEN
      RAISE EXCEPTION 'Invalid provider URL'; END IF;
  END LOOP;
  IF jsonb_array_length(NEW.links)>0 AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(NEW.links) linked(value) WHERE linked.value->>'url'=NEW.link
  ) THEN RAISE EXCEPTION 'Primary URL must be one of the problem links'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_problem_catalog_write BEFORE INSERT OR UPDATE ON public.problems
FOR EACH ROW EXECUTE FUNCTION public.validate_problem_catalog_write();
