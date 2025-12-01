-- Add default_location_id column to channels table
ALTER TABLE public.channels 
ADD COLUMN default_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;