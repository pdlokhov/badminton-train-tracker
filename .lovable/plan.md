
# Выделение тренировок клуба цветом + измерение эффективности

## Что будет сделано

### 1. Новая таблица `channel_promotions` в базе данных

Таблица для управления промо-акциями клубов:
- `channel_id` -- какой клуб выделяем
- `highlight_color` -- цвет выделения (например, "blue", "green", "purple", "gold")
- `label` -- текст бейджа (например, "Партнер", "Рекомендуем", или пустой)
- `starts_at` / `expires_at` -- период действия акции
- `is_active` -- возможность быстро включить/выключить
- `created_at`

RLS: публичное чтение, управление только для админов.

### 2. Отслеживание эффективности через аналитику

Новое событие `promotion_click` в существующей системе аналитики:
- При клике на выделенную тренировку отправляется событие с `channel_id`, `promotion_id`, `training_id`
- Это позволит сравнить CTR (click-through rate) выделенных карточек vs обычных

Дополнительно -- новый раздел в админ-панели аналитики:
- Таблица промо-акций с метриками: показы, клики, CTR
- Сравнение с обычными карточками за тот же период

### 3. Визуальное выделение в карточках

Компоненты `TrainingCard` и `MobileTrainingItem` получат новый проп `promotion`:
- Цветная левая полоска или рамка (цвет из настройки)
- Опциональный бейдж с текстом (например, "Партнер")
- Мягкий фоновый градиент для привлечения внимания, но без раздражения

Поддерживаемые цвета:
```text
blue   -- синяя рамка + фон
green  -- зеленая рамка + фон  
purple -- фиолетовая рамка + фон
gold   -- золотая рамка + фон
```

### 4. Админ-интерфейс для управления промо

На вкладке "Каналы" -- кнопка для настройки промо у каждого клуба:
- Выбор цвета
- Текст бейджа (опционально)
- Период действия
- Переключатель вкл/выкл

### 5. Как измерить эффективность

Метрики, которые будут доступны в панели аналитики:

| Метрика | Описание |
|---------|----------|
| Показы промо-карточек | Сколько раз карточки выделенного клуба были показаны |
| Клики на промо-карточки | Сколько раз кликнули на выделенные карточки |
| CTR промо | Клики / Показы для выделенных карточек |
| CTR обычных | Клики / Показы для обычных карточек |
| Дельта CTR | Разница -- насколько выделение увеличило кликабельность |
| Telegram-переходы | Сколько переходов в Telegram из промо-карточек |

---

## Технические детали

### Миграция БД

```sql
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
-- Публичное чтение (для рендера карточек)
-- Управление только для админов
```

Реалтайм включается для таблицы, чтобы промо применялись мгновенно.

### Загрузка данных

В `TrainingsList` -- один дополнительный запрос к `channel_promotions` где `is_active = true` и текущая дата в диапазоне `starts_at..expires_at`. Результат передается в карточки через проп.

### Аналитика

Используется существующая инфраструктура (`sendEvent` + `track-event` edge function + `analytics_events` таблица). Новые типы событий:
- `promotion_impression` -- показ промо-карточки (отправляется один раз при рендере)
- `promotion_click` -- клик на промо-карточку

В `AnalyticsDashboard` добавляется новый компонент `PromotionEffectivenessTable`.

### Изменяемые файлы

1. Миграция БД -- новая таблица `channel_promotions`
2. `src/components/TrainingsList.tsx` -- загрузка промо-данных, передача в карточки
3. `src/components/TrainingCard.tsx` -- визуальное выделение + трекинг показов
4. `src/components/MobileTrainingItem.tsx` -- визуальное выделение + трекинг показов
5. `src/hooks/useAnalytics.ts` -- новые методы `trackPromotionImpression`, `trackPromotionClick`
6. `src/components/analytics/PromotionEffectivenessTable.tsx` -- новый компонент
7. `src/components/analytics/AnalyticsDashboard.tsx` -- добавление таблицы промо-эффективности
8. `src/components/ChannelList.tsx` -- кнопка управления промо у клуба
9. Новый компонент `src/components/ChannelPromotionForm.tsx` -- форма настройки промо
