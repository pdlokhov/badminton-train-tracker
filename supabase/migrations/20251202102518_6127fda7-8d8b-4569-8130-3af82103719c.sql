-- Add signup_url column to trainings table for manual registration links
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS signup_url TEXT;

COMMENT ON COLUMN public.trainings.signup_url IS 'Manual registration URL for Telegram redirect (used for manually created trainings)';
