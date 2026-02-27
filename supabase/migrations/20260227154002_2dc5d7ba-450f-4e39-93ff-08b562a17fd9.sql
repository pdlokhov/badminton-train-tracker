
CREATE TABLE public.channel_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  highlight_color text NOT NULL DEFAULT 'blue',
  label text,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_promotions ENABLE ROW LEVEL SECURITY;

-- Public read access for rendering cards
CREATE POLICY "Public read access for channel_promotions"
ON public.channel_promotions
FOR SELECT
USING (true);

-- Admins can insert
CREATE POLICY "Admins can insert channel_promotions"
ON public.channel_promotions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update channel_promotions"
ON public.channel_promotions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete channel_promotions"
ON public.channel_promotions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_promotions;
