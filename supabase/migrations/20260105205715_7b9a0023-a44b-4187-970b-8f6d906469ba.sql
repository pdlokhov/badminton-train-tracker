-- Add AI text parsing flag to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS use_ai_text_parsing boolean NOT NULL DEFAULT false;

-- Create table to track processed text messages (similar to processed_images)
CREATE TABLE IF NOT EXISTS public.processed_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  message_hash text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  trainings_count integer DEFAULT 0,
  UNIQUE(channel_id, message_id)
);

-- Enable RLS
ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as processed_images)
CREATE POLICY "Public read access for processed_messages" 
ON public.processed_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert processed_messages" 
ON public.processed_messages 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update processed_messages" 
ON public.processed_messages 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete processed_messages" 
ON public.processed_messages 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_processed_messages_channel_message ON public.processed_messages(channel_id, message_id);