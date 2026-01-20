-- Добавить режим парсинга (enum-like text)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS parse_mode TEXT DEFAULT 'telegram_text';

-- Конфигурация YClients (JSONB для гибкости)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS yclients_config JSONB DEFAULT NULL;

-- Мигрировать существующие данные на основе текущих флагов
UPDATE channels SET parse_mode = 'telegram_images' WHERE parse_images = true AND parse_mode = 'telegram_text';
UPDATE channels SET parse_mode = 'telegram_text' WHERE parse_images = false AND parse_mode = 'telegram_text';

-- Добавить комментарии для документации
COMMENT ON COLUMN channels.parse_mode IS 'Тип источника расписания: telegram_text, telegram_images, yclients, webhook';
COMMENT ON COLUMN channels.yclients_config IS 'Конфигурация YClients API: {company_id, user_token}';