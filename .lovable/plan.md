
# Подключение внешнего API расписания

## Что делаем

Добавляем новый тип источника данных "Внешний API" в админке. Администратор сможет добавить клуб с типом "Внешний API", указав URL эндпоинта и API-ключ. Система будет забирать расписание через backend-функцию и сохранять тренировки в базу.

## Данные из скриншота

- URL: `https://yvwxpznjjlsugjbommro.supabase.co/functions/v1/public-trainings`
- Заголовок: `x-api-key`
- Параметр: `?date=14` (количество дней вперед)
- Метод: GET

## Шаги реализации

### 1. Расширить форму добавления клуба (ChannelForm.tsx)

Добавить новый `parse_mode`: `external_api`.

При выборе "Внешний API" показать поля:
- **URL эндпоинта** -- полный URL для GET-запроса
- **API-ключ** -- значение для заголовка `x-api-key`
- **Количество дней** -- опциональный параметр `?date=N` (по умолчанию 14)

Конфигурация будет храниться в существующем поле `yclients_config` (jsonb), переименованном логически в "external config", но технически используем то же поле для обратной совместимости. Либо лучше -- добавить новое поле `external_api_config` (jsonb) в таблицу `channels`.

### 2. Миграция базы данных

Добавить поле `external_api_config` (jsonb) в таблицу `channels`:

```sql
ALTER TABLE public.channels 
ADD COLUMN external_api_config jsonb DEFAULT NULL;
```

Структура JSON:
```json
{
  "endpoint_url": "https://...",
  "api_key": "389e7c91-...",
  "days_ahead": 14,
  "header_name": "x-api-key"
}
```

### 3. Создать Edge Function `external-api-sync`

Новая backend-функция `supabase/functions/external-api-sync/index.ts`:

- Принимает `channel_id` в теле запроса
- Загружает конфигурацию канала из базы
- Делает GET-запрос к внешнему API с заголовком `x-api-key`
- Маппит ответ на структуру `trainings` таблицы
- Удаляет старые тренировки этого канала и вставляет новые
- По аналогии с `yclients-sync`

Маппинг полей будет реализован гибко -- функция попытается распознать стандартные поля (date, time_start, time_end, type, level, location, price, spots и т.д.). Если формат ответа отличается, можно будет доработать позже.

### 4. Обновить ChannelList.tsx

- Показывать бейдж "API" для каналов с `parse_mode === 'external_api'`
- Добавить кнопку "Синхронизировать" (по аналогии с YClients)
- В диалоге редактирования показывать/редактировать URL и API-ключ

### 5. Обновить ChannelForm.tsx

- Добавить опцию "Внешний API" в селект типа источника
- Показывать условные поля при выборе этого типа:
  - URL эндпоинта
  - API-ключ (поле type="password")
  - Кол-во дней вперед (number, по умолчанию 14)
- Валидация: URL обязателен, API-ключ обязателен

## Технические детали

### Файлы для изменения:
- `src/components/ChannelForm.tsx` -- добавить тип `external_api` и поля формы
- `src/components/ChannelList.tsx` -- бейдж и кнопка синхронизации
- Миграция БД -- новое поле `external_api_config`

### Новые файлы:
- `supabase/functions/external-api-sync/index.ts` -- функция синхронизации

### config.toml:
- Добавить секцию `[functions.external-api-sync]` с `verify_jwt = false`

### Безопасность:
- API-ключ хранится в jsonb поле в базе данных, доступ защищен RLS (только админы могут видеть/редактировать каналы)
- Edge Function валидирует авторизацию перед выполнением
