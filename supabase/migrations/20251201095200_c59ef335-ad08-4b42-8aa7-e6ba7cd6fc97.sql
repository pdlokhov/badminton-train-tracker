
-- Create table to track disclaimer acknowledgments
CREATE TABLE public.disclaimer_acknowledgments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL UNIQUE,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check and insert their acknowledgment
CREATE POLICY "Anyone can check disclaimer status"
ON public.disclaimer_acknowledgments
FOR SELECT
USING (true);

CREATE POLICY "Anyone can acknowledge disclaimer"
ON public.disclaimer_acknowledgments
FOR INSERT
WITH CHECK (true);
