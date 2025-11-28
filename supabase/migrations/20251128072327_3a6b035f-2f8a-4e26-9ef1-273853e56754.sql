-- Add parse_images column to channels table
ALTER TABLE public.channels ADD COLUMN parse_images boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.channels.parse_images IS 'If true, parse images from channel instead of text messages';