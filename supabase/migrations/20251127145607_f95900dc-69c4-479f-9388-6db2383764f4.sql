-- Добавляем колонку type для хранения типа тренировки
ALTER TABLE public.trainings 
ADD COLUMN type text;