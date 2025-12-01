-- Create analytics_events table for raw event tracking
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  page_path text,
  referrer text,
  user_agent text,
  device_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_visitor_id ON public.analytics_events(visitor_id);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);

-- Create analytics_daily table for aggregated statistics
CREATE TABLE public.analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  page_views integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,
  new_visitors integer DEFAULT 0,
  returning_visitors integer DEFAULT 0,
  telegram_clicks integer DEFAULT 0,
  training_views jsonb DEFAULT '{}',
  popular_types jsonb DEFAULT '{}',
  popular_levels jsonb DEFAULT '{}',
  popular_channels jsonb DEFAULT '{}',
  search_queries jsonb DEFAULT '{}',
  avg_session_duration integer DEFAULT 0,
  bounce_rate numeric DEFAULT 0,
  device_breakdown jsonb DEFAULT '{}',
  peak_hours jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_events
-- Anyone can insert events (anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);

-- Only admins can read events
CREATE POLICY "Admins can read analytics events"
ON public.analytics_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete events
CREATE POLICY "Admins can delete analytics events"
ON public.analytics_events
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for analytics_daily
-- Only admins can read aggregated data
CREATE POLICY "Admins can read analytics daily"
ON public.analytics_daily
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert/update (for edge function)
CREATE POLICY "Service can insert analytics daily"
ON public.analytics_daily
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update analytics daily"
ON public.analytics_daily
FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_analytics_daily_updated_at
BEFORE UPDATE ON public.analytics_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();