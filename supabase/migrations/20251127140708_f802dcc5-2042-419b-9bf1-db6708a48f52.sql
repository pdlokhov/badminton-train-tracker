-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Locations are viewable by everyone" 
ON public.locations FOR SELECT USING (true);

CREATE POLICY "Anyone can add locations" 
ON public.locations FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update locations" 
ON public.locations FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete locations" 
ON public.locations FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add location_id to trainings
ALTER TABLE public.trainings ADD COLUMN location_id UUID REFERENCES public.locations(id);

-- Pre-populate known locations
INSERT INTO public.locations (name, address, aliases) VALUES
  ('Цех №1', 'Оптиков 4', ARRAY['Цех', 'Цех №1', 'Цех#1', 'цех']),
  ('Печатный двор', 'Гатчинская 28', ARRAY['Печатный', 'ПД', 'печатный двор']);