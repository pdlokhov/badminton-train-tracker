-- Remove the policy that allows anyone to insert
DROP POLICY IF EXISTS "Service role can insert analytics events" ON public.analytics_events;

-- Create a policy that only allows service role (bypasses RLS anyway, but explicit is better)
-- Since service role bypasses RLS, we can simply have no INSERT policy for anon users
-- The edge function uses service role which bypasses RLS