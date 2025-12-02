-- Remove public INSERT access to analytics_events
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

-- Only allow service role to insert analytics events
CREATE POLICY "Service role can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);