-- Добавляем колонку для доступных мест
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS spots_available integer;