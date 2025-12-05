-- Переименовываем существующую колонку для игровых тренировок
ALTER TABLE public.channels 
RENAME COLUMN permanent_signup_url TO permanent_signup_url_game;

-- Добавляем колонку для групповых тренировок
ALTER TABLE public.channels 
ADD COLUMN permanent_signup_url_group text DEFAULT NULL;

-- Комментарии
COMMENT ON COLUMN public.channels.permanent_signup_url_game IS 'Постоянная ссылка для записи на игровые тренировки';
COMMENT ON COLUMN public.channels.permanent_signup_url_group IS 'Постоянная ссылка для записи на групповые тренировки';