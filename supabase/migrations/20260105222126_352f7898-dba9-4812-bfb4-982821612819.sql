-- Удалить дубликаты, оставив только одну запись для каждой уникальной комбинации
DELETE FROM trainings a
USING trainings b
WHERE a.id > b.id 
  AND a.channel_id = b.channel_id 
  AND a.date IS NOT DISTINCT FROM b.date
  AND COALESCE(a.time_start, '00:00:00') = COALESCE(b.time_start, '00:00:00')
  AND a.message_id = b.message_id;

-- Обновить null time_start на 00:00:00 для консистентности
UPDATE trainings SET time_start = '00:00:00' WHERE time_start IS NULL;

-- Создать уникальный индекс для предотвращения дублей в будущем
CREATE UNIQUE INDEX IF NOT EXISTS trainings_channel_date_time_message_unique 
ON trainings (channel_id, date, time_start, message_id);