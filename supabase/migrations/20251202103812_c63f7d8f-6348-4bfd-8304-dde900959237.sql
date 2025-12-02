-- Add recurring training fields to trainings table
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER CHECK (recurrence_day_of_week BETWEEN 0 AND 6),
ADD COLUMN IF NOT EXISTS recurring_until DATE,
ADD COLUMN IF NOT EXISTS recurring_template_id UUID;

COMMENT ON COLUMN public.trainings.is_recurring IS 'Whether this is a recurring training';
COMMENT ON COLUMN public.trainings.recurrence_day_of_week IS 'Day of week for recurring trainings (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN public.trainings.recurring_until IS 'End date for recurring trainings';
COMMENT ON COLUMN public.trainings.recurring_template_id IS 'ID of the template training for recurring series';

-- Create index for recurring trainings lookup
CREATE INDEX IF NOT EXISTS idx_trainings_recurring_template ON public.trainings(recurring_template_id) WHERE recurring_template_id IS NOT NULL;
