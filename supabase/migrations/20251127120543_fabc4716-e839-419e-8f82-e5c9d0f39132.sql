-- Таблица для хранения Telegram каналов для парсинга
CREATE TABLE public.channels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Комментарии к таблице
COMMENT ON TABLE public.channels IS 'Telegram каналы для парсинга тренировок';
COMMENT ON COLUMN public.channels.url IS 'Полная ссылка на канал (https://t.me/channel_name)';
COMMENT ON COLUMN public.channels.username IS 'Username канала без @';

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Публичный доступ на чтение (расписание доступно всем)
CREATE POLICY "Channels are viewable by everyone"
ON public.channels
FOR SELECT
USING (true);

-- Публичный доступ на добавление (пока без авторизации)
CREATE POLICY "Anyone can add channels"
ON public.channels
FOR INSERT
WITH CHECK (true);

-- Публичный доступ на удаление
CREATE POLICY "Anyone can delete channels"
ON public.channels
FOR DELETE
USING (true);

-- Публичный доступ на обновление
CREATE POLICY "Anyone can update channels"
ON public.channels
FOR UPDATE
USING (true);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();