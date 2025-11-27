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
  price: number | null
  location: string | null
  location_id: string | null
  description: string | null
  raw_text: string
  message_id: string
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
  
  // ШАГ 3: Извлекаем время - ТОЛЬКО формат с двоеточием HH:MM
  let time_start: string | null = null
  let time_end: string | null = null
  
  // Сначала пробуем найти диапазон времени
  const timeRangeMatch = text.match(/(\d{1,2}:\d{2})\s*[-–—до]\s*(\d{1,2}:\d{2})/)
  if (timeRangeMatch) {
    time_start = timeRangeMatch[1]
    time_end = timeRangeMatch[2]
    console.log(`Message ${messageId}: time range = ${time_start} - ${time_end}`)
  } else {
    // Ищем отдельные времена (только с двоеточием!)
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
  
  // Извлекаем уровень
  let level: string | null = null
  if (/начин|beginner|новичк/i.test(text)) level = 'Начинающий'
  else if (/средн|intermediate|middle/i.test(text)) level = 'Средний'
  else if (/продвин|advanced|профи/i.test(text)) level = 'Продвинутый'
  
  // Извлекаем тренера
  const coachMatch = text.match(/(?:тренер|coach|ведущ[ий|ая])[:\s]+([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)/i)
  const coach = coachMatch ? coachMatch[1] : null
  
  // ШАГ 5: Извлекаем локацию из справочника
  const locationResult = findLocation(text, knownLocations)
  const location = locationResult?.name || null
  const location_id = locationResult?.id || null
  
  // Заголовок - первая строка
  const title = lines[0] || null
  
  const result: ParsedTraining = {
    title,
    date,
    time_start,
    time_end,
    coach,
    level,
    price,
    location,
    location_id: location_id || null,
    description: lines.slice(1, 3).join(' ') || null,
    raw_text: text,
    message_id: messageId
  }
  
  console.log(`Message ${messageId}: PARSED - date=${date}, time=${time_start}-${time_end}, price=${price}, level=${level}, location=${location}`)
  
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    for (const channel of channels as Channel[]) {
      console.log(`\n=== Processing channel: ${channel.name} (@${channel.username}) ===`)
      
      const messages = await fetchTelegramChannel(channel.username)
      totalParsed += messages.length
      
      for (const msg of messages) {
        const training = parseTrainingFromText(msg.text, msg.messageId, knownLocations)
        
        // Пропускаем если парсинг не удался (нет валидной даты)
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

    console.log(`\n=== Parsing complete ===`)
    console.log(`Total messages with dates: ${totalParsed}`)
    console.log(`Successfully added/updated: ${totalAdded}`)
    console.log(`Skipped/errors: ${totalSkipped}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Обработано ${channels.length} каналов`,
        parsed: totalParsed,
        added: totalAdded,
        skipped: totalSkipped
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
