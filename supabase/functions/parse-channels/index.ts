import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

interface Channel {
  id: string
  username: string
  name: string
  is_active: boolean
  parse_images: boolean
  use_ai_text_parsing: boolean
  topic_id: number | null
  default_coach: string | null
  permanent_signup_url_game: string | null
  permanent_signup_url_group: string | null
}

interface Location {
  id: string
  name: string
  address: string | null
  aliases: string[] | null
}

interface ParsedTraining {
  title: string | null
  date: string | null
  time_start: string | null
  time_end: string | null
  coach: string | null
  level: string | null
  type: string | null
  price: number | null
  location: string | null
  location_id: string | null
  description: string | null
  raw_text: string
  message_id: string
  spots: number | null
}

interface ImageScheduleTraining {
  type: string | null
  level: string | null
  coach: string | null
  day: string
  time_start: string
  time_end: string | null
}

interface ImageScheduleResult {
  location: string | null
  trainings: ImageScheduleTraining[]
}

// Определение типа тренировки: игровая, мини-группа, мини-игровая, групповая
function parseTrainingType(text: string): string | null {
  // Порядок важен: сначала проверяем составные типы
  // "мини-игровая" или "мини игровая"
  if (/мини[\s-]?игров/i.test(text)) {
    return 'мини-игровая'
  }
  
  // "мини-группа" или "мини группа"
  if (/мини[\s-]?групп/i.test(text)) {
    return 'мини-группа'
  }
  
  // "детская группа"
  if (/детск[а-яё]*\s+групп/i.test(text)) {
    return 'детская группа'
  }
  
  // "групповая тренировка" или "групповая" или "группа"
  if (/групповая|(?<!мини[\s-]?)группа(?!\w)/i.test(text)) {
    return 'групповая'
  }
  
  // "игровая" (но не "мини-игровая" - уже проверили выше)
  if (/игров/i.test(text)) {
    return 'игровая'
  }
  
  // Для картинок: техника
  if (/техник/i.test(text)) {
    return 'техника'
  }
  
  // Турниры и командные события
  if (/турнир|командник|микстер/i.test(text)) {
    return 'турнир'
  }
  
  // Игра (используем negative lookahead вместо \b, т.к. \b не работает с кириллицей)
  if (/игра(?![а-яё])/i.test(text)) {
    return 'игровая'
  }
  
  return null
}

// Проверка: содержит ли текст валидную дату тренировки DD.MM
function containsTrainingDate(text: string): { valid: boolean; day: number; month: number } {
  const dateMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\b/)
  if (!dateMatch) return { valid: false, day: 0, month: 0 }
  
  const day = parseInt(dateMatch[1])
  const month = parseInt(dateMatch[2])
  
  // Валидация: день 1-31, месяц 1-12
  const valid = day >= 1 && day <= 31 && month >= 1 && month <= 12
  return { valid, day, month }
}

// Валидация времени HH:MM
function isValidTime(time: string | null): boolean {
  if (!time) return true // null допустим
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return false
  const hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

// Нормализация буквенного уровня: русские → латинские, унификация разделителей
function normalizeLevel(levelStr: string): string {
  const rusToLat: Record<string, string> = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E', 'Ф': 'F',
    'а': 'A', 'в': 'B', 'с': 'C', 'д': 'D', 'е': 'E', 'ф': 'F'
  }
  
  let normalized = levelStr.toUpperCase()
  
  // Заменяем русские буквы на латинские
  for (const [rus, lat] of Object.entries(rusToLat)) {
    normalized = normalized.replace(new RegExp(rus, 'g'), lat)
  }
  
  // Унифицируем разделители: все варианты → дефис
  normalized = normalized.replace(/\s*[-–—\/]\s*/g, '-')
  
  return normalized.trim()
}

// Поиск локации из справочника
function findLocation(text: string, knownLocations: Location[]): { name: string; id: string } | null {
  const textLower = text.toLowerCase()
  
  for (const loc of knownLocations) {
    // Проверяем основное имя
    if (textLower.includes(loc.name.toLowerCase())) {
      console.log(`Found location by name: ${loc.name}`)
      return { name: loc.address ? `${loc.name} (${loc.address})` : loc.name, id: loc.id }
    }
    
    // Проверяем алиасы
    if (loc.aliases) {
      for (const alias of loc.aliases) {
        if (textLower.includes(alias.toLowerCase())) {
          console.log(`Found location by alias "${alias}": ${loc.name}`)
          return { name: loc.address ? `${loc.name} (${loc.address})` : loc.name, id: loc.id }
        }
      }
    }
  }
  
  // Fallback: вторая строка если содержит адрес в скобках
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines[1] && /\(.+\)/.test(lines[1])) {
    console.log(`Found location from second line: ${lines[1]}`)
    return { name: lines[1], id: '' }
  }
  
  return null
}

// Определяет, является ли сообщение недельным расписанием
function isWeeklySchedule(text: string): boolean {
  // Проверяем ключевые слова (с учётом промежуточных слов, например "расписание тренировок на неделю")
  const hasWeeklyKeywords = /(?:на\s+)?(?:следующ[уюа]+|текущ[уюа]+)\s+недел[юу]/i.test(text)
    || /расписание(?:\s+\S+)*\s+на\s+недел[юу]/i.test(text)
    || /расписание\s+(?:на\s+)?недел[юу]/i.test(text)
  
  // Проверяем наличие диапазона дат DD.MM - DD.MM (индикатор недельного расписания)
  const hasDateRange = /\d{1,2}\.\d{1,2}\s*[-–—]\s*\d{1,2}\.\d{1,2}/.test(text)
  
  // Проверяем наличие нескольких дней недели
  const dayNames = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
  const foundDays = dayNames.filter(day => new RegExp(day, 'i').test(text))
  
  // Проверяем наличие нескольких дат в формате (DD.MM)
  const dateMatches = text.match(/\((\d{1,2}\.\d{1,2})\)/g)
  
  return hasWeeklyKeywords || hasDateRange || foundDays.length >= 2 || (dateMatches !== null && dateMatches.length >= 2)
}

// Парсит недельное расписание и возвращает массив тренировок
function parseWeeklySchedule(text: string, messageId: string, knownLocations: Location[]): ParsedTraining[] {
  console.log(`Parsing weekly schedule for message ${messageId}`)
  
  const trainings: ParsedTraining[] = []
  
  // Извлекаем общие цены из текста
  const groupPriceMatch = text.match(/стоимость\s+(?:групповых|группов\w*)\s+тренировок\s*[-–—:]\s*(\d+)/i)
  const gamePriceMatch = text.match(/стоимость\s+игровых\s+тренировок\s*[-–—:]\s*(\d+)/i)
  const groupPrice = groupPriceMatch ? parseInt(groupPriceMatch[1]) : null
  const gamePrice = gamePriceMatch ? parseInt(gamePriceMatch[1]) : null
  
  console.log(`Extracted prices: group=${groupPrice}, game=${gamePrice}`)
  
  // Разбиваем текст по дням недели с датой
  // Паттерн: эмодзи (опционально) + день недели + (DD.MM)
  const dayBlockRegex = /(?:[⭐️😀☄️💌🤙🔥❤️💙💚💛💜🧡🖤🤍🤎💖💗💓💞💕💟❣️💔❤️‍🔥❤️‍🩹]+\s*)?([А-Яа-я]+)\s*\((\d{1,2}\.\d{1,2})\)([\s\S]*?)(?=(?:[⭐️😀☄️💌🤙🔥❤️💙💚💛💜🧡🖤🤍🤎💖💗💓💞💕💟❣️💔❤️‍🔥❤️‍🩹]+\s*)?[А-Яа-я]+\s*\(\d{1,2}\.\d{1,2}\)|$)/g
  
  let match
  while ((match = dayBlockRegex.exec(text)) !== null) {
    const dayName = match[1].trim()
    const dateStr = match[2]
    const dayContent = match[3].trim()
    
    // Парсим дату
    const [day, month] = dateStr.split('.').map(d => d.padStart(2, '0'))
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const parsedMonth = parseInt(month)
    const year = parsedMonth < currentMonth - 1 ? currentYear + 1 : currentYear
    const date = `${year}-${month}-${day}`
    
    console.log(`Processing day: ${dayName} (${dateStr}) -> ${date}`)
    console.log(`Day content: ${dayContent.substring(0, 100)}...`)
    
    // Разбиваем содержимое дня на тренировки
    // Паттерн: строка с локацией и временем
    const trainingBlocks = dayContent.split(/\n\s*\n/)
    
    let trainingIndex = 0
    for (const block of trainingBlocks) {
      if (!block.trim()) continue
      
      console.log(`\nProcessing training block:\n${block}`)
      
      // Извлекаем время и локацию из первой строки
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) continue
      
      const firstLine = lines[0]
      
      // Паттерн: "Локация время" или "Локация, время"
      // Пример: "Динамит 17:00 - 18:30" или "Питерленд, 21:00 - 22:30"
      const timeMatch = firstLine.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/)
      if (!timeMatch) {
        console.log('No time found in first line, skipping')
        continue
      }
      
      const time_start = timeMatch[1]
      const time_end = timeMatch[2]
      
      // Извлекаем локацию (всё до времени)
      const locationText = firstLine.substring(0, timeMatch.index).trim().replace(/[,،]/g, '').trim()
      const locationResult = findLocation(locationText, knownLocations)
      
      console.log(`Extracted: location="${locationText}", time=${time_start}-${time_end}`)
      
      // Извлекаем тренера
      let coach: string | null = null
      const coachLine = lines.find(l => /тренер/i.test(l))
      if (coachLine) {
        const coachMatch = coachLine.match(/тренер\s*[-–—:]\s*([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)/i)
        if (coachMatch) {
          coach = coachMatch[1]
          console.log(`Found coach: ${coach}`)
        }
      }
      
      // Определяем тип тренировки из всего блока
      let type = parseTrainingType(block)
      
      // Если тип не определён и это не похоже на игровую, ставим "групповая" по умолчанию
      if (!type && !/игровая|игров\w*/i.test(block)) {
        type = 'групповая'
        console.log(`Assigned default type: групповая`)
      }
      
      console.log(`Training type: ${type}`)
      
      // Определяем цену на основе типа
      let price: number | null = null
      if (type === 'игровая') {
        price = gamePrice
      } else if (type === 'групповая' || type === 'мини-группа' || type === 'детская группа') {
        price = groupPrice
      } else if (groupPrice) {
        // Fallback: если тип не определён, используем цену групповых по умолчанию
        price = groupPrice
        console.log(`Using default group price for training without explicit type`)
      }
      
      // Fallback: пробуем извлечь цену из блока тренировки
      if (!price) {
        const blockPriceMatch = block.match(/(\d+)\s*(руб|₽|rub|р\.?)/i)
        if (blockPriceMatch) {
          price = parseInt(blockPriceMatch[1])
          console.log(`Extracted price from training block: ${price}`)
        }
      }
      
      // Извлекаем уровень
      let level: string | null = null
      const levelMatch = block.match(/(?:уровень|level|ур\.?)\s*:?\s*([A-FА-Е](?:\s*[-–—\/]\s*[A-FА-Е])?)/i)
      if (levelMatch) {
        level = normalizeLevel(levelMatch[1])
      }
      
      // Создаём запись тренировки
      const training: ParsedTraining = {
        title: `${type || 'Тренировка'} ${level || ''}`.trim(),
        date,
        time_start,
        time_end,
        coach,
        level,
        type,
        price,
        location: locationResult?.name || locationText || null,
        location_id: locationResult?.id || null,
        description: lines.slice(1).join(' ') || null,
        raw_text: block,
        message_id: `${messageId}_${dayName}_${trainingIndex}`,
        spots: null
      }
      
      trainings.push(training)
      trainingIndex++
      
      console.log(`Added training: ${training.title} at ${training.time_start}-${training.time_end}`)
    }
  }
  
  console.log(`Weekly schedule parsing complete: ${trainings.length} trainings extracted`)
  return trainings
}

function parseTrainingFromText(text: string, messageId: string, knownLocations: Location[]): ParsedTraining | null {
  // Проверяем, является ли это недельным расписанием
  if (isWeeklySchedule(text)) {
    console.log(`Detected weekly schedule in message ${messageId}`)
    return null // Вернём null, чтобы вызывающая функция знала, что нужно использовать другой метод
  }
  // ШАГ 1: Проверяем наличие валидной даты DD.MM
  const dateCheck = containsTrainingDate(text)
  if (!dateCheck.valid) {
    console.log(`Message ${messageId}: SKIP - no valid date found`)
    return null
  }
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  
  // ШАГ 2: Извлекаем дату (сначала дата, потом время!)
  const dateRegex = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/
  const dateMatch = text.match(dateRegex)
  let date: string | null = null
  
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    let year: string
    
    if (dateMatch[3]) {
      year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]
    } else {
      // Определяем год автоматически
      const currentMonth = new Date().getMonth() + 1
      const parsedMonth = parseInt(month)
      const currentYear = new Date().getFullYear()
      
      // Если месяц меньше текущего, скорее всего это следующий год
      year = parsedMonth < currentMonth - 1 ? (currentYear + 1).toString() : currentYear.toString()
    }
    
    date = `${year}-${month}-${day}`
    console.log(`Message ${messageId}: extracted date = ${date}`)
  }
  
  // ШАГ 3: Извлекаем время
  let time_start: string | null = null
  let time_end: string | null = null
  
  // Функция нормализации времени: заменяем точки на двоеточия (13.00 -> 13:00)
  const normalizeTime = (t: string): string => t.replace('.', ':')
  
  // ВАЖНО: Удаляем даты из текста перед поиском времени, чтобы "08.12" не парсилось как "08:12"
  let textForTimeSearch = text
  
  // Удаляем найденную дату DD.MM(.YYYY)
  if (dateMatch) {
    textForTimeSearch = textForTimeSearch.replace(dateMatch[0], ' ')
  }
  
  // Удаляем диапазоны дат типа "08.12 - 14.12" или "8.12-14.12"
  textForTimeSearch = textForTimeSearch.replace(/\d{1,2}\.\d{1,2}\s*[-–—]\s*\d{1,2}\.\d{1,2}/g, ' ')
  
  // Удаляем все оставшиеся даты DD.MM (БЕЗ word boundary, чтобы матчить даты после | и других символов)
  textForTimeSearch = textForTimeSearch.replace(/\d{1,2}\.\d{1,2}/g, ' ')
  
  console.log(`Message ${messageId}: text for time search = "${textForTimeSearch.substring(0, 100)}..."`)

  // 1. Ищем структурированный формат "Время: HH:MM-HH:MM" или "Время: HH.MM – HH.MM"
  const structuredTimeMatch = textForTimeSearch.match(/время\s*:?\s*(\d{1,2}[.:]\d{2})\s*[-–—]\s*(\d{1,2}[.:]\d{2})/i)
  if (structuredTimeMatch) {
    time_start = normalizeTime(structuredTimeMatch[1])
    time_end = normalizeTime(structuredTimeMatch[2])
    console.log(`Message ${messageId}: structured time = ${time_start} - ${time_end}`)
  }
  
  // 2. Пробуем найти диапазон времени: "21:00-23:00" или "21.00 – 23.00"
  if (!time_start) {
    const timeRangeMatch = textForTimeSearch.match(/(\d{1,2}[.:]\d{2})\s*[-–—до]\s*(\d{1,2}[.:]\d{2})/)
    if (timeRangeMatch) {
      time_start = normalizeTime(timeRangeMatch[1])
      time_end = normalizeTime(timeRangeMatch[2])
      console.log(`Message ${messageId}: time range = ${time_start} - ${time_end}`)
    }
  }
  
  // 3. Если не нашли, ищем формат "с X до Y" (часы без минут): "с 21 до 23"
  if (!time_start) {
    const timeHoursOnlyMatch = textForTimeSearch.match(/с\s*(\d{1,2})\s*до\s*(\d{1,2})/i)
    if (timeHoursOnlyMatch) {
      const startHour = parseInt(timeHoursOnlyMatch[1])
      const endHour = parseInt(timeHoursOnlyMatch[2])
      // Проверяем что это валидные часы (0-23)
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = startHour.toString().padStart(2, '0') + ':00'
        time_end = endHour.toString().padStart(2, '0') + ':00'
        console.log(`Message ${messageId}: time hours only = ${time_start} - ${time_end}`)
      }
    }
  }
  
  // 3.5. Ищем формат "с X-Y" (например "с 21-23", "с 10-12") - без слова "до"
  if (!time_start) {
    const timeHoursWithSMatch = textForTimeSearch.match(/с\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})/i)
    if (timeHoursWithSMatch) {
      const startHour = parseInt(timeHoursWithSMatch[1])
      const endHour = parseInt(timeHoursWithSMatch[2])
      // Проверяем что это валидные часы (0-23)
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = startHour.toString().padStart(2, '0') + ':00'
        time_end = endHour.toString().padStart(2, '0') + ':00'
        console.log(`Message ${messageId}: time hours 's X-Y' = ${time_start} - ${time_end}`)
      }
    }
  }
  
  // 3.6. Ищем формат "X до Y" без "с" (например "21 до 23", "10 до 12")
  if (!time_start) {
    const timeHoursOnlyNoSMatch = textForTimeSearch.match(/\b(\d{1,2})\s*до\s*(\d{1,2})\b/i)
    if (timeHoursOnlyNoSMatch) {
      const startHour = parseInt(timeHoursOnlyNoSMatch[1])
      const endHour = parseInt(timeHoursOnlyNoSMatch[2])
      // Проверяем что это валидные часы (0-23) и что это не даты
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = startHour.toString().padStart(2, '0') + ':00'
        time_end = endHour.toString().padStart(2, '0') + ':00'
        console.log(`Message ${messageId}: time hours only (no 's') = ${time_start} - ${time_end}`)
      }
    }
  }
  
  // 4. Если всё ещё не нашли, ищем отдельные времена с двоеточием или точкой
  if (!time_start) {
    const timeRegex = /\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/g
    const timeMatches = [...textForTimeSearch.matchAll(timeRegex)]
    
    if (timeMatches.length >= 1) {
      time_start = `${timeMatches[0][1]}:${timeMatches[0][2]}`
      if (timeMatches.length >= 2) {
        time_end = `${timeMatches[1][1]}:${timeMatches[1][2]}`
      }
      console.log(`Message ${messageId}: individual times found = ${time_start}${time_end ? ' - ' + time_end : ''}`)
    }
  }
  
  // ШАГ 4: Валидация времени перед сохранением
  if (!isValidTime(time_start)) {
    console.log(`Message ${messageId}: invalid time_start=${time_start}, setting to null`)
    time_start = null
  }
  if (!isValidTime(time_end)) {
    console.log(`Message ${messageId}: invalid time_end=${time_end}, setting to null`)
    time_end = null
  }
  
  // Извлекаем цену
  const priceMatch = text.match(/(\d+)\s*(руб|₽|rub|р\.?)/i) || text.match(/(₽|руб|rub)\s*(\d+)/i)
  const price = priceMatch ? parseInt(priceMatch[1] || priceMatch[2]) : null
  
  // Извлекаем уровень (приоритет: числовой → буквенный → "все уровни" → текстовый)
  let level: string | null = null
  
  // 1. Ищем числовой уровень: "1.0", "2.0", "3.0", "4.0", "1.5", "2.5" и диапазоны "1.0-2.0", "2.0/3.0"
  const numericLevelRangeMatch = text.match(/\b([1-5][.,][05])\s*[-–—\/]\s*([1-5][.,][05])\b/)
  if (numericLevelRangeMatch) {
    const lvl1 = numericLevelRangeMatch[1].replace(',', '.')
    const lvl2 = numericLevelRangeMatch[2].replace(',', '.')
    level = `${lvl1}-${lvl2}`
    console.log(`Message ${messageId}: found numeric level range = ${level}`)
  }
  
  // Одиночный числовой уровень
  if (!level) {
    const numericLevelMatch = text.match(/(?:уровень|level|ур\.?|lvl)?\s*\b([1-5][.,][05])\b/i)
    if (numericLevelMatch) {
      level = numericLevelMatch[1].replace(',', '.')
      console.log(`Message ${messageId}: found numeric level = ${level}`)
    }
  }
  
  // 2. Ищем буквенный уровень: "уровень D-E", "level C", "ур. B-C", или просто "D-E" рядом с контекстом
  if (!level) {
    // Сначала проверяем формат "X и выше" или "X+"
    const levelAndAboveMatch = text.match(/(?:уровень|level|ур\.?)\s*:?\s*([A-FА-Е])\s*(?:и\s*выше|\+)/i)
    if (levelAndAboveMatch) {
      level = normalizeLevel(levelAndAboveMatch[1]) + ' и выше'
      console.log(`Message ${messageId}: found level "X и выше" = ${level}`)
    }
    
    // Затем обычный буквенный уровень
    if (!level) {
      const letterLevelMatch = text.match(/(?:уровень|level|ур\.?)\s*:?\s*([A-FА-Е](?:\s*[-–—\/]\s*[A-FА-Е])?)/i)
      if (letterLevelMatch) {
        level = normalizeLevel(letterLevelMatch[1])
        console.log(`Message ${messageId}: found letter level from context = ${level}`)
      }
    }
  }
  
  // 3. Ищем буквы уровня в формате "D-E", "C/D", "EC", "ED" без явного слова "уровень"
  if (!level) {
    // Сначала проверяем двухбуквенные комбинации без разделителя (EC, ED и т.д.)
    const twoLetterMatch = text.match(/\b([A-FА-Е]{2})\b/i)
    if (twoLetterMatch) {
      const letters = normalizeLevel(twoLetterMatch[1])
      // Разделяем на две буквы
      level = letters[0] + '-' + letters[1]
      console.log(`Message ${messageId}: found two-letter level = ${level}`)
    }
    
    // Затем проверяем с разделителем
    if (!level) {
      const standaloneLevelMatch = text.match(/\b([A-FА-Е])\s*[-–—\/]\s*([A-FА-Е])\b/i)
      if (standaloneLevelMatch) {
        level = normalizeLevel(standaloneLevelMatch[1] + '-' + standaloneLevelMatch[2])
        console.log(`Message ${messageId}: found standalone letter level = ${level}`)
      }
    }
  }
  
  // 4. Проверяем "ВСЕ УРОВНИ"
  if (!level && /все\s*уровни|all\s*levels/i.test(text)) {
    level = 'Все уровни'
    console.log(`Message ${messageId}: found "все уровни"`)
  }
  
  // 4.5. Ищем "уровень: Любой", "level: Any"
  if (!level) {
    const anyLevelMatch = text.match(/(?:уровень|level|ур\.?)\s*:?\s*(любой|любые|любая|all|any)/i)
    if (anyLevelMatch) {
      level = 'Любой'
      console.log(`Message ${messageId}: found level "Любой"`)
    }
  }
  
  // 4.6. Ищем текстовые уровни ВМЯЧ: «Старт», «Комфорт», «Прайм», Смешанная
  if (!level) {
    const vmyachLevelMatch = text.match(/(?:уровень|level|ур\.?)\s*:?\s*[«"]?(\s*(?:старт|комфорт|прайм|смешанн[а-я]*)\s*)[»"]?/i)
    if (vmyachLevelMatch) {
      // Нормализуем: убираем кавычки и лишние пробелы, приводим к стандартному виду
      const rawLevel = vmyachLevelMatch[1].trim().toLowerCase()
      if (rawLevel.includes('старт')) {
        level = 'Старт'
      } else if (rawLevel.includes('комфорт')) {
        level = 'Комфорт'
      } else if (rawLevel.includes('прайм')) {
        level = 'Прайм'
      } else if (rawLevel.includes('смешанн')) {
        level = 'Смешанная'
      }
      console.log(`Message ${messageId}: found VMYACH text level = ${level}`)
    }
  }
  
  // 5. Ищем уровень в контексте "НОВИЧКИ E-F"
  if (!level) {
    const noviceMatch = text.match(/(?:новичк[иа]?|начинающ[ие]+)\s*([A-FА-Е](?:\s*[-–—\/]\s*[A-FА-Е])?)/i)
    if (noviceMatch) {
      level = normalizeLevel(noviceMatch[1]) + ' (новички)'
      console.log(`Message ${messageId}: found novice level = ${level}`)
    }
  }
  
  // 6. Fallback на текстовые описания
  if (!level) {
    if (/начин|beginner|новичк/i.test(text)) {
      level = 'Начинающий'
      console.log(`Message ${messageId}: found text level "Начинающий"`)
    } else if (/средн|intermediate|middle/i.test(text)) {
      level = 'Средний'
      console.log(`Message ${messageId}: found text level "Средний"`)
    } else if (/продвин|advanced|профи/i.test(text)) {
      level = 'Продвинутый'
      console.log(`Message ${messageId}: found text level "Продвинутый"`)
    }
  }
  
  if (!level) {
    console.log(`Message ${messageId}: no level found`)
  }
  
  // Извлекаем тренера
  let coach: string | null = null

  // Паттерн 1: После слова "тренер", "coach", "ведущий/ведущая"
  const coachMatch1 = text.match(/(?:тренер|coach|ведущ[ий|ая])[:\s]+([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)/i)
  if (coachMatch1) {
    coach = coachMatch1[1]
    console.log(`Message ${messageId}: found coach by keyword = ${coach}`)
  }

  // Паттерн 2: Формат "DD.MM | HH:MM – HH:MM | ИмяТренера" (канал "бадминтон прост")
  if (!coach) {
    const coachMatch2 = text.match(/\d{1,2}\.\d{1,2}\s*\|\s*\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}\s*\|\s*([А-ЯЁA-Z][а-яёa-z]+)/i)
    if (coachMatch2) {
      coach = coachMatch2[1]
      console.log(`Message ${messageId}: found coach by pipe format = ${coach}`)
    }
  }
  
  // ШАГ 5: Извлекаем локацию из справочника
  const locationResult = findLocation(text, knownLocations)
  const location = locationResult?.name || null
  const location_id = locationResult?.id || null
  
  // Заголовок - первая строка
  const title = lines[0] || null
  
  // Извлекаем тип тренировки
  const type = parseTrainingType(text)
  if (type) {
    console.log(`Message ${messageId}: found training type = ${type}`)
  }
  
  // Извлекаем количество мест с приоритетом и выбором большего значения
  let spots: number | null = null
  
  // Шаг 1: Ищем все упоминания "X чел." (приоритет 1)
  const chelMatches = text.matchAll(/(\d+)\s*чел\.?/gi)
  const chelNumbers = Array.from(chelMatches, m => parseInt(m[1]))
  
  if (chelNumbers.length > 0) {
    // Если нашли "чел.", берем максимальное значение
    spots = Math.max(...chelNumbers)
    console.log(`Message ${messageId}: found ${chelNumbers.length} "чел." values: ${chelNumbers.join(', ')}, taking max = ${spots}`)
  } else {
    // Шаг 2: Если "чел." не нашли, ищем все "X мест" (число ПЕРЕД словом)
    const mestMatches = text.matchAll(/(\d+)\s*мест/gi)
    const mestNumbers = Array.from(mestMatches, m => parseInt(m[1]))
    
    if (mestNumbers.length > 0) {
      spots = Math.max(...mestNumbers)
      console.log(`Message ${messageId}: found ${mestNumbers.length} "мест" values: ${mestNumbers.join(', ')}, taking max = ${spots}`)
    } else {
      // Шаг 3: Ищем "Количество мест: X" и "Мест: X" (число ПОСЛЕ слова)
      const mestColonMatches = text.matchAll(/(?:количество\s+)?мест[а]?[:\s]+(\d+)/gi)
      const mestColonNumbers = Array.from(mestColonMatches, m => parseInt(m[1]))
      
      if (mestColonNumbers.length > 0) {
        spots = Math.max(...mestColonNumbers)
        console.log(`Message ${messageId}: found ${mestColonNumbers.length} "мест:" values: ${mestColonNumbers.join(', ')}, taking max = ${spots}`)
      }
    }
  }
  
  if (spots) {
    console.log(`Message ${messageId}: final spots = ${spots}`)
  }
  
  const result: ParsedTraining = {
    title,
    date,
    time_start,
    time_end,
    coach,
    level,
    type,
    price,
    location,
    location_id: location_id || null,
    description: lines.slice(1, 3).join(' ') || null,
    raw_text: text,
    message_id: messageId,
    spots
  }
  
  console.log(`Message ${messageId}: PARSED - date=${date}, time=${time_start}-${time_end}, price=${price}, level=${level}, type=${type}, location=${location}, spots=${spots}`)
  
  return result
}

async function fetchTelegramChannel(username: string, topicId?: number | null): Promise<{ text: string, messageId: string, postDate: Date | null }[]> {
  const url = `https://t.me/s/${username}`
  console.log(`Fetching channel: ${url}${topicId ? ` (topic: ${topicId})` : ''}`)
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.status}`)
    return []
  }
  
  const html = await response.text()
  const messages: { text: string, messageId: string, postDate: Date | null }[] = []
  
  // Parse message blocks to extract date and text
  // Формат data-post для супергрупп с топиками: "username/topicId/messageId"
  // Формат для обычных каналов: "username/messageId"
  const messageBlockRegex = topicId
    ? new RegExp(`data-post="${username}/${topicId}/(\\d+)"[^>]*>[\\s\\S]*?(?=data-post="|$)`, 'g')
    : /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?(?=data-post="|$)/g
  
  let blockMatch
  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const messageId = blockMatch[1]
    const block = blockMatch[0]
    
    // Извлекаем дату публикации
    const dateMatch = block.match(/datetime="([^"]+)"/)
    let postDate: Date | null = null
    if (dateMatch) {
      postDate = new Date(dateMatch[1])
    }
    
    // Извлекаем текст сообщения
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (textMatch) {
      let text = textMatch[1]
      // Clean HTML tags
      text = text.replace(/<br\s*\/?>/gi, '\n')
      text = text.replace(/<[^>]+>/g, '')
      text = text.replace(/&nbsp;/g, ' ')
      text = text.replace(/&amp;/g, '&')
      text = text.replace(/&lt;/g, '<')
      text = text.replace(/&gt;/g, '>')
      text = text.replace(/&quot;/g, '"')
      text = text.trim()
      
      if (text.length > 10) {
        messages.push({ text, messageId: topicId ? `${topicId}_${messageId}` : messageId, postDate })
      }
    }
  }
  
  console.log(`Found ${messages.length} total messages in ${username}${topicId ? ` (topic ${topicId})` : ''}`)
  
  // Фильтруем только сообщения с датой DD.MM
  const trainingMessages = messages.filter(msg => containsTrainingDate(msg.text).valid)
  console.log(`Filtered to ${trainingMessages.length} training messages (with DD.MM date)`)
  
  return trainingMessages
}

// Извлечение URL изображений из HTML канала с фильтрацией по дате
async function fetchTelegramChannelImages(username: string, topicId?: number | null): Promise<{ imageUrl: string, messageId: string, postDate: Date | null }[]> {
  const url = `https://t.me/s/${username}`
  console.log(`Fetching channel images: ${url}${topicId ? ` (topic: ${topicId})` : ''}`)
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.status}`)
    return []
  }
  
  const html = await response.text()
  const images: { imageUrl: string, messageId: string, postDate: Date | null }[] = []
  
  // Ищем сообщения с изображениями
  // Формат для супергрупп с топиками: data-post="username/topicId/messageId"
  // Формат для обычных каналов: data-post="channel/123"
  const messageBlockRegex = topicId
    ? new RegExp(`data-post="${username}/${topicId}/(\\d+)"[^>]*>[\\s\\S]*?(?=data-post="|$)`, 'g')
    : /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?(?=data-post="|$)/g
  let blockMatch
  
  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const messageId = blockMatch[1]
    const block = blockMatch[0]
    
    // Извлекаем дату поста
    const dateMatch = block.match(/datetime="([^"]+)"/)
    let postDate: Date | null = null
    if (dateMatch) {
      postDate = new Date(dateMatch[1])
    }
    
    // Ищем изображения в блоке
    const imageMatches = block.matchAll(/background-image:url\('([^']+)'\)/g)
    for (const imgMatch of imageMatches) {
      const imageUrl = imgMatch[1]
      // Фильтруем только реальные изображения (не аватарки и т.д.)
      if (imageUrl && !imageUrl.includes('userpic') && imageUrl.includes('cdn')) {
        images.push({ imageUrl, messageId: topicId ? `${topicId}_${messageId}` : messageId, postDate })
      }
    }
    
    // Также ищем img теги
    const imgTagMatches = block.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)
    for (const imgMatch of imgTagMatches) {
      const imageUrl = imgMatch[1]
      if (imageUrl && !imageUrl.includes('userpic') && imageUrl.includes('cdn')) {
        images.push({ imageUrl, messageId: topicId ? `${topicId}_${messageId}` : messageId, postDate })
      }
    }
  }
  
  console.log(`Found ${images.length} total images in ${username}${topicId ? ` (topic ${topicId})` : ''}`)
  
  // Фильтруем по дате: только текущий и прошлый месяц
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
  
  const filteredImages = images.filter(img => {
    if (!img.postDate) return true // Если нет даты, берём
    const imgMonth = img.postDate.getMonth()
    const imgYear = img.postDate.getFullYear()
    
    return (imgYear === currentYear && imgMonth === currentMonth) ||
           (imgYear === lastMonthYear && imgMonth === lastMonth)
  })
  
  console.log(`Filtered to ${filteredImages.length} images from current/last month`)
  
  return filteredImages
}

// Получение всех дат для дня недели в месяце
function getDatesForDayInMonth(dayName: string, year: number, month: number): string[] {
  const dayMap: Record<string, number> = {
    'понедельник': 1,
    'вторник': 2,
    'среда': 3,
    'четверг': 4,
    'пятница': 5,
    'суббота': 6,
    'воскресенье': 0
  }
  
  const dayIndex = dayMap[dayName.toLowerCase()]
  if (dayIndex === undefined) {
    console.log(`Unknown day name: ${dayName}`)
    return []
  }
  
  const dates: string[] = []
  const date = new Date(year, month, 1)
  
  while (date.getMonth() === month) {
    if (date.getDay() === dayIndex) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    date.setDate(date.getDate() + 1)
  }
  
  return dates
}

// Анализ изображения с расписанием через Lovable AI
async function analyzeScheduleImage(imageUrl: string): Promise<ImageScheduleResult | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured')
    return null
  }
  
  console.log(`Analyzing image: ${imageUrl}`)
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Проанализируй изображение расписания тренировок по бадминтону.

Извлеки данные и верни JSON в формате:
{
  "location": "название локации из заголовка изображения (например: М. Петроградская, Приморская и т.д.)",
  "trainings": [
    {
      "type": "тип тренировки (техника/игра/групповая/мини-игровая и т.д.)",
      "level": "уровень ТОЧНО КАК НАПИСАНО в изображении (например: Б1-Б2, ВСЕ УРОВНИ, A-B, С-Е, Е-Н начинающие, Е-F)",
      "coach": "имя тренера если указано (например: Екатерина, Егор, Александр)",
      "day": "день недели на русском в нижнем регистре (понедельник, вторник, среда...)",
      "time_start": "время начала в формате HH:MM",
      "time_end": "время окончания в формате HH:MM (если есть)"
    }
  ]
}

КРИТИЧЕСКИ ВАЖНО:
1. Если в ОДНО ВРЕМЯ проходит НЕСКОЛЬКО тренировок (разные типы/уровни/тренеры) - создавай ОТДЕЛЬНУЮ запись для КАЖДОЙ тренировки!
   Например, если в 19:00-20:30 идут "Игра (С-Е)", "Группа (Е-Н) Екатерина" и "Мини-группа (Е-F) Егор" - это ТРИ разные записи!
2. Уровни оставляй ТОЧНО как написано в изображении, НЕ преобразовывай и НЕ нормализуй!
3. Если уровень не указан, оставь null
4. Если тренер не указан, оставь coach как null (например "Игра (С-Е) без тренера")
5. Если на изображении нет расписания тренировок, верни пустой массив trainings
6. Локацию бери из заголовка изображения`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_schedule',
            description: 'Извлечь расписание тренировок из изображения',
            parameters: {
              type: 'object',
              properties: {
                location: { 
                  type: 'string',
                  description: 'Название локации из заголовка'
                },
                trainings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', description: 'Тип тренировки' },
                      level: { type: 'string', description: 'Уровень как в оригинале' },
                      coach: { type: 'string', description: 'Имя тренера' },
                      day: { type: 'string', description: 'День недели на русском' },
                      time_start: { type: 'string', description: 'Время начала HH:MM' },
                      time_end: { type: 'string', description: 'Время окончания HH:MM' }
                    },
                    required: ['day', 'time_start']
                  }
                }
              },
              required: ['trainings']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_schedule' } }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`AI API error: ${response.status} - ${errorText}`)
      return null
    }
    
    const data = await response.json()
    console.log('AI response:', JSON.stringify(data, null, 2))
    
    // Извлекаем результат из tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments) as ImageScheduleResult
      console.log(`Extracted ${result.trainings?.length || 0} trainings from image`)
      return result
    }
    
    return null
  } catch (error) {
    console.error('Error analyzing image:', error)
    return null
  }
}

// ================== AI TEXT SCHEDULE PARSING ==================
interface AITextTraining {
  title: string | null
  date: string // YYYY-MM-DD
  time_start: string // HH:MM
  time_end: string | null
  type: string | null
  level: string | null
  coach: string | null
  location: string | null
  signup_url: string | null
  description: string | null
}

interface AITextScheduleResult {
  trainings: AITextTraining[]
}

// Создаём хэш для текста сообщения (для кэширования)
function hashMessage(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Анализ текстового расписания через Lovable AI
async function analyzeScheduleText(text: string, currentYear: number, currentDate: string, minDate: string): Promise<AITextScheduleResult | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured')
    return null
  }
  
  console.log(`Analyzing text schedule (${text.length} chars)`)
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Проанализируй текст расписания тренировок по бадминтону.

ТЕКУЩАЯ ДАТА: ${currentDate}
ГОД ПО УМОЛЧАНИЮ: ${currentYear}
МИНИМАЛЬНАЯ ДАТА: ${minDate}

ТЕКСТ ДЛЯ АНАЛИЗА:
${text}

ВАЖНЫЕ ПРАВИЛА:
1. Извлеки ВСЕ тренировки, турниры и события с датой от ${minDate} и позже
2. Если в тексте указан только день и месяц (например "29.12"), используй год ${currentYear}
3. Если дата старше ${minDate} - пропускай её полностью
4. Для каждой записи определи:
   - date: дату в формате YYYY-MM-DD (преобразуй день недели и дату в скобках типа "Понедельник (29.12)" в полную дату)
   - time_start: время начала в формате HH:MM
   - time_end: время окончания в формате HH:MM (если указано)
   - type: тип события. ВАЖНО: если написано просто "тренировка" без уточнения типа, возвращай "групповая". Возможные типы: групповая, игровая, турнир, техника, мини-группа, мини-игровая, детская группа
   - level: уровень участников ТОЧНО как написано (например: "для продолжающих и продвинутых", "для всех уровней", "Е-F" и т.д.)
   - coach: имя тренера если указано
   - location: название локации (обрати внимание на заголовки с 🎯 или адреса)
   - signup_url: ссылку для записи (VK или Telegram)
   - description: дополнительное описание
5. Если несколько тренировок в одно время - создай ОТДЕЛЬНЫЕ записи для каждой
6. Если несколько локаций в тексте - правильно соотнеси тренировки с локациями
7. Игнорируй общие объявления без конкретной даты/времени`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_text_schedule',
            description: 'Извлечь расписание тренировок из текста',
            parameters: {
              type: 'object',
              properties: {
                trainings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Название события (опционально)' },
                      date: { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
                      time_start: { type: 'string', description: 'Время начала HH:MM' },
                      time_end: { type: 'string', description: 'Время окончания HH:MM' },
                      type: { type: 'string', description: 'Тип: тренировка/игровая/турнир/групповая' },
                      level: { type: 'string', description: 'Уровень участников' },
                      coach: { type: 'string', description: 'Имя тренера' },
                      location: { type: 'string', description: 'Название локации/зала' },
                      signup_url: { type: 'string', description: 'Ссылка для записи (VK или Telegram)' },
                      description: { type: 'string', description: 'Дополнительное описание' }
                    },
                    required: ['date', 'time_start']
                  }
                }
              },
              required: ['trainings']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_text_schedule' } }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`AI API error: ${response.status} - ${errorText}`)
      return null
    }
    
    const data = await response.json()
    console.log('AI text response:', JSON.stringify(data, null, 2))
    
    // Извлекаем результат из tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments) as AITextScheduleResult
      console.log(`Extracted ${result.trainings?.length || 0} trainings from text via AI`)
      return result
    }
    
    return null
  } catch (error) {
    console.error('Error analyzing text schedule:', error)
    return null
  }
}

// Поиск локации по названию из изображения
function findLocationByImageName(locationName: string | null, knownLocations: Location[]): { name: string; id: string } | null {
  if (!locationName) return null
  
  const nameLower = locationName.toLowerCase()
  
  for (const loc of knownLocations) {
    if (nameLower.includes(loc.name.toLowerCase())) {
      return { name: loc.address ? `${loc.name} (${loc.address})` : loc.name, id: loc.id }
    }
    
    if (loc.aliases) {
      for (const alias of loc.aliases) {
        if (nameLower.includes(alias.toLowerCase())) {
          return { name: loc.address ? `${loc.name} (${loc.address})` : loc.name, id: loc.id }
        }
      }
    }
  }
  
  // Возвращаем как есть, если не нашли в справочнике
  return { name: locationName, id: '' }
}

// ================== SMART UPSERT HELPER ==================
async function smartUpsertTraining(supabase: any, trainingRecord: any): Promise<{ success: boolean; error?: any }> {
  // Check if training already exists based on actual characteristics
  let query = supabase
    .from('trainings')
    .select('id, price, coach, type, level, title, description')
    .eq('channel_id', trainingRecord.channel_id)
    .eq('date', trainingRecord.date)
    .eq('time_start', trainingRecord.time_start)

  // Для time_end: .is() для null, .eq() для значений
  if (trainingRecord.time_end === null || trainingRecord.time_end === undefined) {
    query = query.is('time_end', null)
  } else {
    query = query.eq('time_end', trainingRecord.time_end)
  }

  // Для location: .is() для null, .eq() для значений
  if (trainingRecord.location === null || trainingRecord.location === undefined) {
    query = query.is('location', null)
  } else {
    query = query.eq('location', trainingRecord.location)
  }

  const { data: existing } = await query.maybeSingle()

  if (existing) {
    // Update only if new data is more complete (not overwriting non-null with null)
    const updates: Record<string, any> = { 
      message_id: trainingRecord.message_id,
      updated_at: new Date().toISOString(),
      raw_text: trainingRecord.raw_text
    }
    
    // Update fields only if new data is not null and old data was null
    if (trainingRecord.price !== null && trainingRecord.price !== undefined && !existing.price) {
      updates.price = trainingRecord.price
    }
    if (trainingRecord.coach && !existing.coach) {
      updates.coach = trainingRecord.coach
    }
    if (trainingRecord.type && !existing.type) {
      updates.type = trainingRecord.type
    }
    if (trainingRecord.level && !existing.level) {
      updates.level = trainingRecord.level
    }
    if (trainingRecord.title && !existing.title) {
      updates.title = trainingRecord.title
    }
    if (trainingRecord.description && !existing.description) {
      updates.description = trainingRecord.description
    }
    
    const { error } = await supabase.from('trainings').update(updates).eq('id', existing.id)
    if (error) {
      console.error(`Error updating training ${existing.id}:`, error.message)
      return { success: false, error }
    }
    console.log(`Updated existing training ${existing.id}`)
    return { success: true }
  } else {
    // Insert new record
    const { error } = await supabase.from('trainings').insert(trainingRecord)
    if (error) {
      console.error(`Error inserting training:`, error.message)
      return { success: false, error }
    }
    console.log(`Inserted new training`)
    return { success: true }
  }
}

// ================== MAIN DENO SERVE HANDLER ==================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body to get force parameter
    const { force = false } = await req.json().catch(() => ({}))
    console.log(`Force mode: ${force ? 'ON' : 'OFF'}`)

    // Log request source for monitoring
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    console.log(`Request from IP: ${clientIP}, UA: ${userAgent}`)

    // Check authorization: either admin token OR unauthenticated cron call
    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false
    
    if (authHeader) {
      // Manual request with token - verify admin role
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Недействительный токен' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check admin role using has_role function
      const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      })

      if (roleError || !isAdmin) {
        console.log(`User ${user.id} attempted parse without admin role`)
        return new Response(
          JSON.stringify({ success: false, error: 'Только администраторы могут запускать парсинг' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Admin user ${user.id} initiated parsing`)
      isAuthorized = true
    } else {
      // Unauthenticated request - allow for cron jobs (public endpoint)
      console.log('Cron job initiated parsing (public endpoint)')
      isAuthorized = true
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Не авторизован' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Загружаем справочник локаций
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('*')
    
    if (locationsError) {
      console.error('Error fetching locations:', locationsError)
    }
    
    const knownLocations: Location[] = locations || []
    console.log(`Loaded ${knownLocations.length} locations from database`)

    // Get active channels
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('*')
      .eq('is_active', true)

    if (channelsError) {
      console.error('Error fetching channels:', channelsError)
      throw channelsError
    }

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Нет активных каналов', parsed: 0, added: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Сортируем каналы: сначала текстовые (быстрые), потом с изображениями (медленные)
    const sortedChannels = [...(channels as Channel[])].sort((a, b) => {
      if (a.parse_images === b.parse_images) return 0
      return a.parse_images ? 1 : -1  // текстовые (false) первые
    })
    
    console.log(`Processing ${sortedChannels.length} channels (text first, then images)`)
    
    let totalParsed = 0
    let totalAdded = 0
    let totalSkipped = 0
    let totalFromCache = 0

    for (const channel of sortedChannels) {
      console.log(`\n=== Processing channel: ${channel.name} (@${channel.username})${channel.topic_id ? ` [topic: ${channel.topic_id}]` : ''} ===`)
      const parseMode = channel.parse_images ? 'IMAGES' : (channel.use_ai_text_parsing ? 'AI_TEXT' : 'TEXT')
      console.log(`Parse mode: ${parseMode}`)
      
      if (channel.parse_images) {
        // ===== РЕЖИМ ПАРСИНГА ИЗОБРАЖЕНИЙ =====
        const images = await fetchTelegramChannelImages(channel.username, channel.topic_id)
        totalParsed += images.length
        
        for (const img of images) {
          console.log(`\nProcessing image from message ${img.messageId}`)
          
          // Проверяем, было ли изображение уже обработано (если не force режим)
          if (!force) {
            const { data: existingRecord } = await supabase
              .from('processed_images')
              .select('id, trainings_count')
              .eq('channel_id', channel.id)
              .eq('message_id', img.messageId)
              .single()
            
            if (existingRecord) {
              console.log(`Image ${img.messageId} already processed (${existingRecord.trainings_count} trainings), skipping AI analysis`)
              totalFromCache++
              continue
            }
          } else {
            console.log(`Force mode enabled: re-processing image ${img.messageId}`)
          }
          
          const scheduleResult = await analyzeScheduleImage(img.imageUrl)
          
          if (!scheduleResult || !scheduleResult.trainings || scheduleResult.trainings.length === 0) {
            console.log(`No trainings found in image ${img.messageId}`)
            // Сохраняем запись даже если тренировок не найдено, чтобы не повторять анализ
            await supabase
              .from('processed_images')
              .insert({
                channel_id: channel.id,
                message_id: img.messageId,
                image_url: img.imageUrl,
                trainings_count: 0
              })
            totalSkipped++
            continue
          }
          
          // Находим локацию
          const locationResult = findLocationByImageName(scheduleResult.location, knownLocations)
          
          // Определяем месяцы для генерации дат (текущий и следующий)
          const now = new Date()
          const currentMonth = now.getMonth()
          const currentYear = now.getFullYear()
          const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
          const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear
          
          let trainingsAddedFromImage = 0
          const trainingsToUpsert = []
          
          for (const training of scheduleResult.trainings) {
            // Получаем все даты для этого дня недели в текущем и следующем месяце
            const datesCurrentMonth = getDatesForDayInMonth(training.day, currentYear, currentMonth)
            const datesNextMonth = getDatesForDayInMonth(training.day, nextMonthYear, nextMonth)
            const allDates = [...datesCurrentMonth, ...datesNextMonth]
            
            console.log(`Training: ${training.type} ${training.day} ${training.time_start} - dates: ${allDates.join(', ')}`)
            
            for (const date of allDates) {
              const trainingRecord = {
                channel_id: channel.id,
                message_id: `${img.messageId}_${training.day}_${training.time_start}_${training.coach || 'nocoach'}_${date}`,
                title: `${training.type || 'Тренировка'} ${training.level || ''}`.trim(),
                date: date,
                time_start: training.time_start,
                time_end: training.time_end || null,
                type: parseTrainingType(training.type || ''),
                level: training.level || null,
                location: locationResult?.name || null,
                location_id: locationResult?.id || null,
                raw_text: JSON.stringify(training),
                coach: training.coach || null,
                price: null,
                description: scheduleResult.location || null
              }
              
              trainingsToUpsert.push(trainingRecord)
            }
          }
          
          // Batch upsert всех тренировок одним запросом
          if (trainingsToUpsert.length > 0) {
            const { data: upserted, error: upsertError } = await supabase
              .from('trainings')
              .upsert(trainingsToUpsert, { 
                onConflict: 'channel_id,date,time_start,message_id',
                ignoreDuplicates: false
              })
              .select('id')
            
            if (upsertError) {
              console.error(`Batch upsert error:`, upsertError.message)
              totalSkipped += trainingsToUpsert.length
            } else {
              trainingsAddedFromImage = upserted?.length || trainingsToUpsert.length
              totalAdded += trainingsAddedFromImage
              console.log(`Batch upserted ${trainingsAddedFromImage} trainings from image`)
            }
          }
          
          // Сохраняем запись об обработанном изображении
          const { error: insertError } = await supabase
            .from('processed_images')
            .insert({
              channel_id: channel.id,
              message_id: img.messageId,
              image_url: img.imageUrl,
              trainings_count: trainingsAddedFromImage
            })
          
          if (insertError) {
            console.error(`Error saving processed image record:`, insertError)
          } else {
            console.log(`Saved processed image record for message ${img.messageId} (${trainingsAddedFromImage} trainings)`)
          }
        }
      } else if (channel.use_ai_text_parsing) {
        // ===== РЕЖИМ AI-ПАРСИНГА ТЕКСТА =====
        console.log(`Using AI for text parsing`)
        
        // Получаем сообщения с датой публикации
        const url = `https://t.me/s/${channel.username}`
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        })
        
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.status}`)
          continue
        }
        
        const html = await response.text()
        
        // Парсим блоки сообщений с извлечением даты публикации
        const messageBlockRegex = channel.topic_id
          ? new RegExp(`data-post="${channel.username}/${channel.topic_id}/(\\d+)"[^>]*>[\\s\\S]*?(?=data-post="|$)`, 'g')
          : /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?(?=data-post="|$)/g
        
        const allMessages: { text: string, messageId: string, postDate: Date | null }[] = []
        let match
        while ((match = messageBlockRegex.exec(html)) !== null) {
          const messageId = match[1]
          const block = match[0]
          
          // Извлекаем дату публикации
          const dateMatch = block.match(/datetime="([^"]+)"/)
          let postDate: Date | null = null
          if (dateMatch) {
            postDate = new Date(dateMatch[1])
          }
          
          // Извлекаем текст сообщения
          const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
          if (textMatch) {
            let text = textMatch[1]
            text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
            
            // Фильтруем только большие сообщения (вероятные расписания)
            if (text.length > 200) {
              allMessages.push({ text, messageId: channel.topic_id ? `${channel.topic_id}_${messageId}` : messageId, postDate })
            }
          }
        }
        
        console.log(`Found ${allMessages.length} potential schedule messages`)
        
        // Фильтруем старые сообщения - не отправляем в AI для экономии
        const now = new Date()
        const oneMonthAgo = new Date(now)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        
        const recentMessages = allMessages.filter(msg => {
          if (!msg.postDate) return true // Если нет даты публикации - берём
          return msg.postDate >= oneMonthAgo
        })
        
        console.log(`Filtered to ${recentMessages.length} recent messages (from last month) for AI parsing`)
        totalParsed += recentMessages.length
        
        const currentYear = now.getFullYear()
        const currentDateStr = now.toISOString().split('T')[0]
        const minDateStr = oneMonthAgo.toISOString().split('T')[0]
        const trainingsToUpsert: any[] = []
        
        for (const msg of recentMessages) {
          // Проверяем кэш обработанных сообщений
          const msgHash = hashMessage(msg.text)
          
          if (!force) {
            const { data: existingRecord } = await supabase
              .from('processed_messages')
              .select('id, trainings_count')
              .eq('channel_id', channel.id)
              .eq('message_id', msg.messageId)
              .eq('message_hash', msgHash)
              .maybeSingle()
            
            if (existingRecord) {
              console.log(`Message ${msg.messageId} already processed (${existingRecord.trainings_count} trainings), skipping AI analysis`)
              totalFromCache++
              continue
            }
          }
          
          // Вызываем AI для парсинга с текущей датой и минимальной датой
          const aiResult = await analyzeScheduleText(msg.text, currentYear, currentDateStr, minDateStr)
          
          if (!aiResult || !aiResult.trainings || aiResult.trainings.length === 0) {
            console.log(`No trainings found in message ${msg.messageId} via AI`)
            // Сохраняем в кэш
            await supabase.from('processed_messages').upsert({
              channel_id: channel.id,
              message_id: msg.messageId,
              message_hash: msgHash,
              trainings_count: 0
            }, { onConflict: 'channel_id,message_id' })
            totalSkipped++
            continue
          }
          
          let trainingsFromMessage = 0
          
          for (const training of aiResult.trainings) {
            // Фильтруем тренировки старше 1 месяца (дополнительная защита)
            const trainingDate = new Date(training.date)
            if (trainingDate < oneMonthAgo) {
              console.log(`Skipping old training from AI: ${training.date}`)
              continue
            }
            
            // Находим локацию из справочника
            const locationResult = training.location ? findLocation(training.location, knownLocations) : null
            
            // Определяем тип тренировки
            const trainingType = training.type ? parseTrainingType(training.type) : null
            
            // Определяем signup_url: из AI или из настроек канала
            let signupUrl = training.signup_url || null
            if (!signupUrl) {
              if (trainingType === 'игровая' || trainingType === 'мини-игровая') {
                signupUrl = channel.permanent_signup_url_game || null
              } else {
                signupUrl = channel.permanent_signup_url_group || null
              }
            }
            
            // Генерируем уникальный message_id с локацией
            const locationKey = (training.location || 'unknown')
              .replace(/[^a-zA-Z0-9а-яА-Я]/g, '')
              .substring(0, 20)
            
            const trainingRecord = {
              channel_id: channel.id,
              message_id: `ai_${msg.messageId}_${training.date}_${training.time_start}_${locationKey}`,
              title: training.title || `${training.type || 'Тренировка'} ${training.level || ''}`.trim(),
              date: training.date,
              time_start: training.time_start,
              time_end: training.time_end || null,
              type: trainingType,
              level: training.level || null,
              location: locationResult?.name || training.location || null,
              location_id: locationResult?.id || null,
              raw_text: msg.text.substring(0, 500),
              coach: training.coach || channel.default_coach || null,
              signup_url: signupUrl,
              description: training.description || null,
              price: null
            }
            
            trainingsToUpsert.push(trainingRecord)
            trainingsFromMessage++
          }
          
          // Сохраняем в кэш
          await supabase.from('processed_messages').upsert({
            channel_id: channel.id,
            message_id: msg.messageId,
            message_hash: msgHash,
            trainings_count: trainingsFromMessage
          }, { onConflict: 'channel_id,message_id' })
        }
        
        // Дедупликация по message_id перед batch upsert
        const uniqueMap = new Map<string, typeof trainingsToUpsert[0]>()
        for (const t of trainingsToUpsert) {
          if (!uniqueMap.has(t.message_id)) {
            uniqueMap.set(t.message_id, t)
          } else {
            console.log(`Duplicate message_id skipped: ${t.message_id}`)
          }
        }
        const deduplicatedTrainings = Array.from(uniqueMap.values())
        console.log(`Deduplicated: ${trainingsToUpsert.length} -> ${deduplicatedTrainings.length}`)
        
        // Batch upsert всех тренировок
        if (deduplicatedTrainings.length > 0) {
          const { data: upserted, error: upsertError } = await supabase
            .from('trainings')
            .upsert(deduplicatedTrainings, { 
              onConflict: 'channel_id,date,time_start,message_id',
              ignoreDuplicates: false
            })
            .select('id')
          
          if (upsertError) {
            console.error(`Batch upsert error for AI text parsing:`, upsertError.message)
            totalSkipped += deduplicatedTrainings.length
          } else {
            const upsertedCount = upserted?.length || deduplicatedTrainings.length
            totalAdded += upsertedCount
            console.log(`Batch upserted ${upsertedCount} trainings from AI text parsing`)
          }
        }
      } else {
        // ===== РЕЖИМ ПАРСИНГА ТЕКСТА (существующая логика) =====
        const messages = await fetchTelegramChannel(channel.username, channel.topic_id)
        totalParsed += messages.length
        
        const trainingsToUpsert = []
        
        for (const msg of messages) {
          // Сначала проверяем, не является ли это недельным расписанием
          if (isWeeklySchedule(msg.text)) {
            console.log(`Processing weekly schedule message ${msg.messageId}`)
            const weeklyTrainings = parseWeeklySchedule(msg.text, msg.messageId, knownLocations)
            
            for (const training of weeklyTrainings) {
              trainingsToUpsert.push({
                channel_id: channel.id,
                ...training,
                location_id: training.location_id || null
              })
            }
            continue
          }
          
          // Обычный парсинг одиночной тренировки
          const training = parseTrainingFromText(msg.text, msg.messageId, knownLocations)
          
          // Пропускаем если парсинг не удался (нет валидной даты)
          if (!training) {
            totalSkipped++
            continue
          }
          
          trainingsToUpsert.push({
            channel_id: channel.id,
            ...training,
            location_id: training.location_id || null
          })
        }
        
        // Batch upsert всех тренировок одним запросом
        if (trainingsToUpsert.length > 0) {
          const { data: upserted, error: upsertError } = await supabase
            .from('trainings')
            .upsert(trainingsToUpsert, { 
              onConflict: 'channel_id,date,time_start,message_id',
              ignoreDuplicates: false
            })
            .select('id')
          
          if (upsertError) {
            console.error(`Batch upsert error for text parsing:`, upsertError.message)
            totalSkipped += trainingsToUpsert.length
          } else {
            const upsertedCount = upserted?.length || trainingsToUpsert.length
            totalAdded += upsertedCount
            console.log(`Batch upserted ${upsertedCount} trainings from text messages`)
          }
        }
      }
    }

    console.log(`\n=== Parsing complete ===`)
    console.log(`Total messages/images processed: ${totalParsed}`)
    console.log(`Successfully added/updated: ${totalAdded}`)
    console.log(`Skipped from cache (already processed): ${totalFromCache}`)
    console.log(`Skipped/errors: ${totalSkipped}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Обработано ${channels.length} каналов`,
        parsed: totalParsed,
        added: totalAdded,
        skipped: totalSkipped,
        fromCache: totalFromCache
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Parse error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
