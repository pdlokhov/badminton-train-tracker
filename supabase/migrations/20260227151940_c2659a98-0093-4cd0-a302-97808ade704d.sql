
ALTER TABLE public.trainings
  ADD COLUMN discount_percent integer,
  ADD COLUMN original_price numeric,
  ADD COLUMN discounted_price numeric,
  ADD COLUMN discount_expires_at timestamptz;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  visitor_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can read subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
