-- Create a function that will be called by cron to invoke parse-channels
-- This function will use the service role to call the edge function with a special header
CREATE OR REPLACE FUNCTION public.invoke_parse_channels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_status integer;
BEGIN
  -- Call the edge function with X-Cron-Secret header
  -- The secret will be passed as a header that the edge function can verify
  SELECT status INTO response_status
  FROM net.http_post(
    url := 'https://xqquqrsqtnjnzvyubhzc.supabase.co/functions/v1/parse-channels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Parse channels response status: %', response_status;
END;
$$;