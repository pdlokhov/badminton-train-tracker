-- Create trainings table
CREATE TABLE public.trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  date DATE,
  time_start TIME,
  time_end TIME,
  coach TEXT,
  level TEXT,
  price NUMERIC,
  location TEXT,
  description TEXT,
  raw_text TEXT NOT NULL,
  message_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, message_id)
);

-- Enable RLS
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

-- RLS policies - public read access
CREATE POLICY "Trainings are viewable by everyone" 
ON public.trainings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert trainings" 
ON public.trainings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update trainings" 
ON public.trainings 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete trainings" 
ON public.trainings 
FOR DELETE 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_trainings_updated_at
BEFORE UPDATE ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_trainings_date ON public.trainings(date);
CREATE INDEX idx_trainings_channel_id ON public.trainings(channel_id);