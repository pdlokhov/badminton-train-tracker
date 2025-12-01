import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Channel {
  id: string
  username: string
  name: string
  is_active: boolean
  parse_images: boolean
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
  day: string
  time_start: string
  time_end: string | null
}

interface ImageScheduleResult {
  location: string | null
  trainings: ImageScheduleTraining[]
}

// Интерфейс для слота в недельном расписании
interface WeeklySlot {
  dayOfWeek: number  // 0=воскресенье, 1=понедельник, ...
  timeStart: string
  timeEnd: string | null
  type: string | null
  level: string | null
  description: string
  location: string | null  // Название локации
  location_id: string | null  // ID локации
}

// Карта месяцев для парсинга дат
const monthMap: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
}

// Карта дней недели
const dayOfWeekMap: Record<string, number> = {
  'воскресенье': 0, 'понедельник': 1, 'вторник': 2, 'среда': 3,
  'четверг': 4, 'пятница': 5, 'суббота': 6
}

// Определение: это недельное расписание?
function isWeeklySchedule(text: string): boolean {
  // Признаки недельного расписания:
  // 1. Диапазон дат: "1-7 декабря", "с 1 по 7 декабря", "1 по 7 декабря"
  // 2. Несколько дней недели
  
  const hasDateRange = /(\d+)\s*[-–—]\s*(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(text) ||
                       /[сc]\s*(\d+)\s+по\s+(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(text) ||
                       /(\d+)\s+по\s+(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(text)
  
  const dayNames = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
  const daysCount = dayNames.filter(day => text.toLowerCase().includes(day)).length
  
  return hasDateRange && daysCount >= 2
}

// Парсинг диапазона дат из текста
function parseDateRange(text: string): { startDate: Date; endDate: Date } | null {
  // Формат: "1-7 декабря", "с 1 по 7 декабря", "1 по 7 декабря"
  let match = text.match(/(\d+)\s*[-–—]\s*(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i)
  
  if (!match) {
    match = text.match(/[сc]?\s*(\d+)\s+по\s+(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i)
  }
  
  if (!match) return null
  
  const startDay = parseInt(match[1])
  const endDay = parseInt(match[2])
  const monthName = match[3].toLowerCase()
  const month = monthMap[monthName]
  
  if (month === undefined) return null
  
  // Определяем год
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // Если месяц в прошлом относительно текущего, это следующий год
  let year = currentYear
  if (month < currentMonth - 1) {
    year = currentYear + 1
  }
  
  return {
    startDate: new Date(year, month, startDay),
    endDate: new Date(year, month, endDay)
  }
}

// Парсинг уровня из текста слота
function parseSlotLevel(text: string): string | null {
  // Числовой уровень: 1.0-2.0, 2.5
  const numericMatch = text.match(/([1-5][.,][05])\s*[-–—\/]?\s*([1-5][.,][05])?/)
  if (numericMatch) {
    const lvl1 = numericMatch[1].replace(',', '.')
    const lvl2 = numericMatch[2]?.replace(',', '.')
    return lvl2 ? `${lvl1}-${lvl2}` : lvl1
  }
  
  // Буквенный уровень: C-D, D-E (латинские A-F и русские А-Е)
  const letterMatch = text.match(/([A-FА-Е])\s*[-–—\/]\s*([A-FА-Е])/i)
  if (letterMatch) {
    return normalizeLevel(letterMatch[1] + '-' + letterMatch[2])
  }
  
  // Одиночная буква
  const singleLetter = text.match(/уровень\s*([A-FА-Е])/i)
  if (singleLetter) {
    return normalizeLevel(singleLetter[1])
  }
  
  return null
}

// Парсинг слотов по дням недели с отслеживанием локации
// Структура: сначала зал/локация, потом все дни для этого зала
function parseWeeklySlots(text: string, knownLocations: Location[]): WeeklySlot[] {
  const slots: WeeklySlot[] = []
  
  // Разбиваем текст на секции по локациям
  // Ищем маркеры локаций: эмодзи 🎯, названия из справочника, или строки вида "СК Название"
  const locationSections: { location: Location | null; startPos: number; endPos: number }[] = []
  
  // Находим все возможные начала секций локаций
  const locationMarkers: { position: number; location: Location | null }[] = []
  
  // 1. Ищем эмодзи 🎯 как маркер локации
  let pos = 0
  while ((pos = text.indexOf('🎯', pos)) !== -1) {
    locationMarkers.push({ position: pos, location: null })
    pos++
  }
  
  // 2. Ищем известные локации из справочника
  for (const location of knownLocations) {
    const searchTexts = [location.name, ...(location.aliases || [])]
    for (const searchText of searchTexts) {
      let pos = 0
      const textLower = text.toLowerCase()
      const searchLower = searchText.toLowerCase()
      while ((pos = textLower.indexOf(searchLower, pos)) !== -1) {
        // Проверяем, что это начало строки или после переноса
        if (pos === 0 || text[pos - 1] === '\n' || text[pos - 1] === ' ') {
          locationMarkers.push({ position: pos, location })
        }
        pos++
      }
    }
  }
  
  // 3. Ищем паттерны вида "СК Название" в начале строк
  const skPattern = /^СК\s+[А-Яа-яA-Za-z0-9\s]+/gm
  let match
  while ((match = skPattern.exec(text)) !== null) {
    const locationName = match[0].trim()
    // Пытаемся найти в справочнике
    const found = knownLocations.find(loc => 
      locationName.toLowerCase().includes(loc.name.toLowerCase()) ||
      (loc.aliases && loc.aliases.some(alias => locationName.toLowerCase().includes(alias.toLowerCase())))
    )
    locationMarkers.push({ position: match.index, location: found || null })
  }
  
  // Сортируем маркеры по позиции и убираем дубликаты
  locationMarkers.sort((a, b) => a.position - b.position)
  const uniqueMarkers: typeof locationMarkers = []
  for (const marker of locationMarkers) {
    if (uniqueMarkers.length === 0 || marker.position > uniqueMarkers[uniqueMarkers.length - 1].position + 10) {
      uniqueMarkers.push(marker)
    }
  }
  
  console.log(`Found ${uniqueMarkers.length} location sections`)
  
  // Создаем секции между маркерами
  for (let i = 0; i < uniqueMarkers.length; i++) {
    const startPos = uniqueMarkers[i].position
    const endPos = i < uniqueMarkers.length - 1 ? uniqueMarkers[i + 1].position : text.length
    locationSections.push({
      location: uniqueMarkers[i].location,
      startPos,
      endPos
    })
  }
  
  // Если не нашли секций, обрабатываем весь текст как одну секцию
  if (locationSections.length === 0) {
    locationSections.push({
      location: null,
      startPos: 0,
      endPos: text.length
    })
  }
  
  // Обрабатываем каждую секцию локации
  for (const section of locationSections) {
    const sectionText = text.slice(section.startPos, section.endPos)
    const sectionTextLower = sectionText.toLowerCase()
    
    // Извлекаем локацию из первой строки секции если не нашли в справочнике
    let activeLocation = section.location
    if (!activeLocation) {
      const firstLine = sectionText.split('\n')[0]
      const locationFromLine = knownLocations.find(loc =>
        firstLine.toLowerCase().includes(loc.name.toLowerCase()) ||
        (loc.aliases && loc.aliases.some(alias => firstLine.toLowerCase().includes(alias.toLowerCase())))
      )
      activeLocation = locationFromLine || null
    }
    
    console.log(`Processing section with location: ${activeLocation?.name || 'Unknown'}`)
    
    // Определяем позиции всех дней недели в секции
    const dayPositions: { day: string; dayIndex: number; position: number }[] = []
    for (const [dayName, dayIndex] of Object.entries(dayOfWeekMap)) {
      let pos = 0
      while ((pos = sectionTextLower.indexOf(dayName, pos)) !== -1) {
        dayPositions.push({ day: dayName, dayIndex, position: pos })
        pos++
      }
    }
    
    // Сортируем по позиции
    dayPositions.sort((a, b) => a.position - b.position)
    
    // Для каждого дня извлекаем секцию текста до следующего дня
    for (let i = 0; i < dayPositions.length; i++) {
      const current = dayPositions[i]
      const nextPos = i < dayPositions.length - 1 ? dayPositions[i + 1].position : sectionText.length
      const daySection = sectionText.slice(current.position, nextPos)
      
      // Ищем все времена в секции дня
      const timeRegex = /(\d{1,2}):(\d{2})\s*[-–—]?\s*(\d{1,2}):(\d{2})?/g
      let timeMatch
      
      while ((timeMatch = timeRegex.exec(daySection)) !== null) {
        const timeStart = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
        const timeEnd = timeMatch[3] && timeMatch[4] ? `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}` : null
        
        // Извлекаем описание после времени (до следующего времени или конца секции)
        const afterTime = daySection.slice(timeMatch.index + timeMatch[0].length)
        const nextTimeIdx = afterTime.search(/\d{1,2}:\d{2}/)
        const description = (nextTimeIdx > 0 ? afterTime.slice(0, nextTimeIdx) : afterTime).trim()
        
        // Определяем тип и уровень
        const combinedText = description + ' ' + daySection
        const type = parseTrainingType(combinedText)
        const level = parseSlotLevel(combinedText)
        
        slots.push({
          dayOfWeek: current.dayIndex,
          timeStart,
          timeEnd,
          type,
          level,
          description: description.slice(0, 100), // Ограничиваем длину
          location: activeLocation?.name || null,
          location_id: activeLocation?.id || null
        })
      }
    }
  }
  
  console.log(`parseWeeklySlots: found ${slots.length} slots`)
  return slots
}

// Генерация тренировок из недельного расписания
function generateTrainingsFromWeekly(
  text: string,
  dateRange: { startDate: Date; endDate: Date },
  slots: WeeklySlot[],
  messageId: string,
  knownLocations: Location[]
): ParsedTraining[] {
  const trainings: ParsedTraining[] = []
  
  // Проходим по каждому дню в диапазоне
  const currentDate = new Date(dateRange.startDate)
  while (currentDate <= dateRange.endDate) {
    const dayOfWeek = currentDate.getDay()
    
    // Находим слоты для этого дня недели
    const daySlots = slots.filter(s => s.dayOfWeek === dayOfWeek)
    
    for (const slot of daySlots) {
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      trainings.push({
        title: slot.type || 'Тренировка',
        date: dateStr,
        time_start: slot.timeStart,
        time_end: slot.timeEnd,
        coach: null,
        level: slot.level,
        type: slot.type,
        price: null,
        location: slot.location, // Используем локацию из слота
        location_id: slot.location_id, // Используем location_id из слота
        description: slot.description || null,
        raw_text: text,
        message_id: `${messageId}_${dateStr}_${slot.timeStart}`,
        spots: null
      })
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  console.log(`generateTrainingsFromWeekly: generated ${trainings.length} trainings from ${slots.length} slots`)
  return trainings
}

// Парсинг недельного расписания
function parseWeeklySchedule(text: string, messageId: string, knownLocations: Location[]): ParsedTraining[] {
  console.log(`Message ${messageId}: detected WEEKLY SCHEDULE`)
  
  const dateRange = parseDateRange(text)
  if (!dateRange) {
    console.log(`Message ${messageId}: could not parse date range`)
    return []
  }
  
  console.log(`Message ${messageId}: date range = ${dateRange.startDate.toISOString()} - ${dateRange.endDate.toISOString()}`)
  
  const slots = parseWeeklySlots(text, knownLocations)
  if (slots.length === 0) {
    console.log(`Message ${messageId}: no slots found`)
    return []
  }
  
  // Выводим информацию о найденных локациях для отладки
  const uniqueLocations = [...new Set(slots.map(s => s.location).filter(Boolean))]
  if (uniqueLocations.length > 0) {
    console.log(`Found locations in slots: ${uniqueLocations.join(', ')}`)
  }
  
  return generateTrainingsFromWeekly(text, dateRange, slots, messageId, knownLocations)
}

// Определение типа тренировки: игровая, мини-группа, мини-игровая, групповая, детская
function parseTrainingType(text: string): string | null {
  // Порядок важен: сначала проверяем составные типы
  
  // "Дети до X лет", "Дети от X лет", "детская тренировка"
  if (/дети\s+(до|от|[\d]+)/i.test(text) || /детск/i.test(text)) {
    return 'детская'
  }
  
  // "мини-игровая" или "мини игровая"
  if (/мини[\s-]?игров/i.test(text)) {
    return 'мини-игровая'
  }
  
  // "мини-группа" или "мини группа"
  if (/мини[\s-]?групп/i.test(text)) {
    return 'мини-группа'
  }
  
  // "групповая тренировка" или "групповая"
  if (/групповая/i.test(text)) {
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

function parseTrainingFromText(text: string, messageId: string, knownLocations: Location[]): ParsedTraining | null {
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
  
  // 1. Сначала пробуем найти диапазон времени с двоеточием: "21:00-23:00"
  const timeRangeMatch = text.match(/(\d{1,2}:\d{2})\s*[-–—до]\s*(\d{1,2}:\d{2})/)
  if (timeRangeMatch) {
    time_start = timeRangeMatch[1]
    time_end = timeRangeMatch[2]
    console.log(`Message ${messageId}: time range with colon = ${time_start} - ${time_end}`)
  }
  
  // 2. Если не нашли, ищем формат "с X до Y" (часы без минут): "с 21 до 23"
  if (!time_start) {
    const timeHoursOnlyMatch = text.match(/с\s*(\d{1,2})\s*до\s*(\d{1,2})/i)
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
  
  // 3. Если всё ещё не нашли, ищем отдельные времена с двоеточием
  if (!time_start) {
    const timeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g
    const timeMatches = text.match(timeRegex)
    
    if (timeMatches && timeMatches.length >= 1) {
      time_start = timeMatches[0]
      if (timeMatches.length >= 2) {
        time_end = timeMatches[1]
      }
      console.log(`Message ${messageId}: times found = ${timeMatches.join(', ')}`)
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
    // Шаг 2: Если "чел." не нашли, ищем все "X мест" (приоритет 2)
    const mestMatches = text.matchAll(/(\d+)\s*мест/gi)
    const mestNumbers = Array.from(mestMatches, m => parseInt(m[1]))
    
    if (mestNumbers.length > 0) {
      spots = Math.max(...mestNumbers)
      console.log(`Message ${messageId}: found ${mestNumbers.length} "мест" values: ${mestNumbers.join(', ')}, taking max = ${spots}`)
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

async function fetchTelegramChannel(username: string): Promise<{ text: string, messageId: string }[]> {
  const url = `https://t.me/s/${username}`
  console.log(`Fetching channel: ${url}`)
  
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
  const messages: { text: string, messageId: string }[] = []
  
  // Parse messages from HTML
  const messageRegex = /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  let match
  
  while ((match = messageRegex.exec(html)) !== null) {
    const messageId = match[1]
    let text = match[2]
    
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
      messages.push({ text, messageId })
    }
  }
  
  console.log(`Found ${messages.length} total messages in ${username}`)
  
  // Фильтруем только сообщения с датой DD.MM
  const trainingMessages = messages.filter(msg => containsTrainingDate(msg.text).valid)
  console.log(`Filtered to ${trainingMessages.length} training messages (with DD.MM date)`)
  
  return trainingMessages
}

// Получение всех сообщений канала (включая недельные расписания)
async function fetchTelegramChannelWithWeekly(username: string): Promise<{ text: string, messageId: string }[]> {
  const url = `https://t.me/s/${username}`
  console.log(`Fetching channel (with weekly): ${url}`)
  
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
  const messages: { text: string, messageId: string }[] = []
  
  // Parse messages from HTML
  const messageRegex = /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  let match
  
  while ((match = messageRegex.exec(html)) !== null) {
    const messageId = match[1]
    let text = match[2]
    
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
      messages.push({ text, messageId })
    }
  }
  
  console.log(`Found ${messages.length} total messages in ${username}`)
  
  // Фильтруем: либо недельное расписание, либо сообщение с датой DD.MM
  const relevantMessages = messages.filter(msg => 
    isWeeklySchedule(msg.text) || containsTrainingDate(msg.text).valid
  )
  console.log(`Filtered to ${relevantMessages.length} relevant messages (weekly schedules + DD.MM dates)`)
  
  return relevantMessages
}

// Извлечение URL изображений из HTML канала с фильтрацией по дате
async function fetchTelegramChannelImages(username: string): Promise<{ imageUrl: string, messageId: string, postDate: Date | null }[]> {
  const url = `https://t.me/s/${username}`
  console.log(`Fetching channel images: ${url}`)
  
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
  // Формат: data-post="channel/123" ... background-image:url('...')
  const messageBlockRegex = /data-post="[^"]*\/(\d+)"[^>]*>[\s\S]*?(?=data-post="|$)/g
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
        images.push({ imageUrl, messageId, postDate })
      }
    }
    
    // Также ищем img теги
    const imgTagMatches = block.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)
    for (const imgMatch of imgTagMatches) {
      const imageUrl = imgMatch[1]
      if (imageUrl && !imageUrl.includes('userpic') && imageUrl.includes('cdn')) {
        images.push({ imageUrl, messageId, postDate })
      }
    }
  }
  
  console.log(`Found ${images.length} total images in ${username}`)
  
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
      "level": "уровень ТОЧНО КАК НАПИСАНО в изображении (например: Б1-Б2, ВСЕ УРОВНИ, A-B)",
      "day": "день недели на русском в нижнем регистре (понедельник, вторник, среда...)",
      "time_start": "время начала в формате HH:MM",
      "time_end": "время окончания в формате HH:MM (если есть)"
    }
  ]
}

ВАЖНО:
1. Уровни оставляй ТОЧНО как написано в изображении, НЕ преобразовывай и НЕ нормализуй!
2. Если уровень не указан, оставь null
3. Если на изображении нет расписания тренировок, верни пустой массив trainings
4. Локацию бери из заголовка изображения`
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify admin role server-side
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется авторизация' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    console.log(`Processing ${channels.length} channels`)
    
    let totalParsed = 0
    let totalAdded = 0
    let totalSkipped = 0
    let totalFromCache = 0

    for (const channel of channels as Channel[]) {
      console.log(`\n=== Processing channel: ${channel.name} (@${channel.username}) ===`)
      console.log(`Parse mode: ${channel.parse_images ? 'IMAGES' : 'TEXT'}`)
      
      if (channel.parse_images) {
        // ===== РЕЖИМ ПАРСИНГА ИЗОБРАЖЕНИЙ =====
        const images = await fetchTelegramChannelImages(channel.username)
        totalParsed += images.length
        
        for (const img of images) {
          console.log(`\nProcessing image from message ${img.messageId}`)
          
          // Проверяем, было ли изображение уже обработано
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
          
          for (const training of scheduleResult.trainings) {
            // Получаем все даты для этого дня недели в текущем и следующем месяце
            const datesCurrentMonth = getDatesForDayInMonth(training.day, currentYear, currentMonth)
            const datesNextMonth = getDatesForDayInMonth(training.day, nextMonthYear, nextMonth)
            const allDates = [...datesCurrentMonth, ...datesNextMonth]
            
            console.log(`Training: ${training.type} ${training.day} ${training.time_start} - dates: ${allDates.join(', ')}`)
            
            for (const date of allDates) {
              const trainingRecord = {
                channel_id: channel.id,
                message_id: `${img.messageId}_${training.day}_${training.time_start}_${date}`,
                title: `${training.type || 'Тренировка'} ${training.level || ''}`.trim(),
                date: date,
                time_start: training.time_start,
                time_end: training.time_end || null,
                type: parseTrainingType(training.type || ''),
                level: training.level || null,
                location: locationResult?.name || null,
                location_id: locationResult?.id || null,
                raw_text: JSON.stringify(training),
                coach: null,
                price: null,
                description: scheduleResult.location || null
              }
              
              const { error: upsertError } = await supabase
                .from('trainings')
                .upsert(trainingRecord, {
                  onConflict: 'channel_id,message_id'
                })
              
              if (upsertError) {
                console.error(`Error upserting training:`, upsertError)
                totalSkipped++
              } else {
                totalAdded++
                trainingsAddedFromImage++
              }
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
      } else {
        // ===== РЕЖИМ ПАРСИНГА ТЕКСТА =====
        const allMessages = await fetchTelegramChannelWithWeekly(channel.username)
        totalParsed += allMessages.length
        
        for (const msg of allMessages) {
          // Сначала проверяем: это недельное расписание?
          if (isWeeklySchedule(msg.text)) {
            const trainings = parseWeeklySchedule(msg.text, msg.messageId, knownLocations)
            
            for (const training of trainings) {
              const { error: upsertError } = await supabase
                .from('trainings')
                .upsert({
                  channel_id: channel.id,
                  ...training,
                  location_id: training.location_id || null
                }, {
                  onConflict: 'channel_id,message_id'
                })
              
              if (upsertError) {
                console.error(`Error upserting weekly training:`, upsertError)
                totalSkipped++
              } else {
                totalAdded++
              }
            }
            
            if (trainings.length === 0) {
              totalSkipped++
            }
          } else {
            // Стандартный парсинг одиночных тренировок
            // Проверяем наличие даты DD.MM
            if (!containsTrainingDate(msg.text).valid) {
              totalSkipped++
              continue
            }
            
            const training = parseTrainingFromText(msg.text, msg.messageId, knownLocations)
            
            if (!training) {
              totalSkipped++
              continue
            }
            
            const { error: upsertError } = await supabase
              .from('trainings')
              .upsert({
                channel_id: channel.id,
                ...training,
                location_id: training.location_id || null
              }, {
                onConflict: 'channel_id,message_id'
              })
            
            if (upsertError) {
              console.error(`Error upserting training ${msg.messageId}:`, upsertError)
              totalSkipped++
            } else {
              totalAdded++
            }
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
