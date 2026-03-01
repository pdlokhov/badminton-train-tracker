
# Исправление отображения скидок + отдельная секция акций

## Проблема

В компонентах `TrainingCard` и `MobileTrainingItem` проверка активности скидки требует, чтобы `discount_expires_at` было заполнено:

```typescript
const hasActiveDiscount = !!(
  discountPercent &&
  discountedPrice != null &&
  discountExpiresAt &&              // <-- null = скидка не показывается!
  new Date(discountExpiresAt) > new Date()
);
```

У тренировки "ЛБ Бадминтон" 17:30 скидка 30% (980 вместо 1400), но `discount_expires_at = null` -- скидка есть, но UI её не показывает.

## Что будет сделано

### 1. Исправить логику проверки скидки

Если `discount_expires_at` = null, считать скидку бессрочно активной (достаточно наличия `discount_percent` и `discounted_price`):

```typescript
const hasActiveDiscount = !!(
  discountPercent &&
  discountedPrice != null &&
  (!discountExpiresAt || new Date(discountExpiresAt) > new Date())
);
```

Изменения в двух файлах: `TrainingCard.tsx` и `MobileTrainingItem.tsx`.

### 2. Отдельная секция "Акции" над основным расписанием

Добавить блок перед списком тренировок, который показывает карточки с активными скидками и/или промо-выделением. Секция отображается только если есть хотя бы одна акция.

Визуально:
- Заголовок "Акции и спецпредложения" с иконкой огня
- Горизонтальная прокрутка на мобильных, ряд карточек на десктопе
- Те же карточки (TrainingCard / MobileTrainingItem), но собранные в отдельный блок
- Тренировки с акциями также остаются в основном списке на своём месте по времени

### 3. Разделение данных в TrainingsList

В `TrainingsList.tsx` добавить `useMemo` для выделения "акционных" тренировок:
- Тренировки с активной скидкой (`discount_percent > 0` и `discounted_price != null`)
- Тренировки с активным промо-выделением (из `promotions` Map)
- Объединить без дубликатов для секции акций

## Изменяемые файлы

1. `src/components/TrainingCard.tsx` -- исправить проверку `hasActiveDiscount`
2. `src/components/MobileTrainingItem.tsx` -- исправить проверку `hasActiveDiscount`
3. `src/components/TrainingsList.tsx` -- добавить секцию акций над основным расписанием
