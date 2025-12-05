-- Create RPC function to check disclaimer status (prevents public access to all visitor_ids)
CREATE OR REPLACE FUNCTION public.check_disclaimer(p_visitor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.disclaimer_acknowledgments
    WHERE visitor_id = p_visitor_id
  )
$$;

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can check disclaimer status" ON public.disclaimer_acknowledgments;