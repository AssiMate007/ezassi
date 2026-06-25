-- RPC function to allow students to rate a writer securely.
-- Since RLS prevents updating another user's profile, we use SECURITY DEFINER to bypass RLS checks.

CREATE OR REPLACE FUNCTION public.submit_writer_rating(p_writer_id UUID, p_user_rating NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_rating NUMERIC;
  current_jobs INT;
  new_rating NUMERIC;
BEGIN
  -- Validate rating
  IF p_user_rating < 1 OR p_user_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Get writer's profile info
  SELECT rating, jobs_completed INTO current_rating, current_jobs
  FROM public.profiles
  WHERE id = p_writer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Writer profile not found';
  END IF;

  -- Compute correct running average
  -- Since jobs_completed is already updated on completion, we use current_jobs as divider.
  IF current_jobs > 0 THEN
    new_rating := (current_rating * (current_jobs - 1) + p_user_rating) / current_jobs;
  ELSE
    new_rating := p_user_rating;
  END IF;

  -- Ensure range is 1 to 5 and round to 2 decimal places
  new_rating := ROUND(GREATEST(1.00, LEAST(5.00, new_rating)), 2);

  -- Update profiles table
  UPDATE public.profiles
  SET rating = new_rating
  WHERE id = p_writer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_writer_rating(UUID, NUMERIC) TO authenticated;
