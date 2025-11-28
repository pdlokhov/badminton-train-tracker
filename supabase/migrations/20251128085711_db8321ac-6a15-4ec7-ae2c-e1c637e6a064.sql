-- Create table to track processed images
CREATE TABLE public.processed_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trainings_count INTEGER DEFAULT 0,
  UNIQUE(channel_id, message_id)
);

-- Enable RLS
ALTER TABLE public.processed_images ENABLE ROW LEVEL SECURITY;

-- Policies for public access (parser uses service role)
CREATE POLICY "Allow public read" ON public.processed_images FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.processed_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.processed_images FOR DELETE USING (true);

-- Index for faster lookups
CREATE INDEX idx_processed_images_channel_message ON public.processed_images(channel_id, message_id);