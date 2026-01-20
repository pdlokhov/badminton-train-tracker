import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const YCLIENTS_API = 'https://api.yclients.com/api/v1'

interface YClientsConfig {
  company_id: string
  user_token: string
}

interface Channel {
  id: string
  name: string
  parse_mode: string
  yclients_config: YClientsConfig | null
  default_coach: string | null
  permanent_signup_url_game: string | null
  permanent_signup_url_group: string | null
}

interface YClientsStaff {
  id: number
  name: string
  specialization: string
  position: { id: number; title: string } | null
}

interface YClientsService {
  id: number
  title: string
  category_id: number
  price_min: number
  price_max: number
  duration: number
}

interface YClientsSeance {
  time: string // "HH:MM"
  seance_length: number // в секундах
  datetime: string // ISO datetime
}

interface YClientsBookTime {
  time: string
  seance_length: number
  datetime: string
}

interface Training {
  channel_id: string
  date: string
  time_start: string
  time_end: string | null
  coach: string | null
  level: string | null
  type: string | null
  price: number | null
  location: string | null
  location_id: string | null
  description: string | null
  title: string | null
  raw_text: string
  message_id: string
  signup_url: string | null
  spots: number | null
}

// Получить список дат на N дней вперёд
function getNextDays(days: number): string[] {
  const dates: string[] = []
  const today = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
}

// Преобразовать секунды в время HH:MM
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
}

// Определить тип тренировки по названию услуги
function parseServiceType(title: string): string | null {
  const titleLower = title.toLowerCase()
  
  if (/мини[\s-]?игров/i.test(titleLower)) return 'мини-игровая'
  if (/мини[\s-]?групп/i.test(titleLower)) return 'мини-группа'
  if (/детск/i.test(titleLower)) return 'детская группа'
  if (/игров|игра/i.test(titleLower)) return 'игровая'
  if (/групп/i.test(titleLower)) return 'групповая'
  if (/техник/i.test(titleLower)) return 'техника'
  if (/турнир|командник/i.test(titleLower)) return 'турнир'
  if (/индивид|персонал/i.test(titleLower)) return 'индивидуальная'
  
  return 'групповая' // по умолчанию
}

// Определить уровень из названия
function parseServiceLevel(title: string): string | null {
  const levelMatch = title.match(/([A-FА-Ф])(?:\s*[-–—\/]\s*([A-FА-Ф]))?/i)
  if (levelMatch) {
    const rusToLat: Record<string, string> = {
      'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E', 'Ф': 'F'
    }
    let level = levelMatch[1].toUpperCase()
    level = rusToLat[level] || level
    
    if (levelMatch[2]) {
      let level2 = levelMatch[2].toUpperCase()
      level2 = rusToLat[level2] || level2
      return `${level}-${level2}`
    }
    return level
  }
  return null
}

async function fetchYClientsData(
  endpoint: string,
  partnerToken: string,
  userToken?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json',
  }
  
  if (userToken) {
    headers['Authorization'] = `Bearer ${partnerToken}, User ${userToken}`
  } else {
    headers['Authorization'] = `Bearer ${partnerToken}`
  }
  
  const response = await fetch(`${YCLIENTS_API}${endpoint}`, { headers })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`YClients API error: ${response.status} - ${errorText}`)
    throw new Error(`YClients API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data
}

async function syncYClientsChannel(
  channel: Channel,
  partnerToken: string,
  supabase: any
): Promise<{ added: number; errors: number }> {
  const config = channel.yclients_config
  if (!config) {
    console.error(`Channel ${channel.name}: no yclients_config`)
    return { added: 0, errors: 1 }
  }
  
  const { company_id, user_token } = config
  console.log(`\n=== Syncing YClients channel: ${channel.name} (company: ${company_id}) ===`)
  
  try {
    // 1. Получаем информацию о компании для адреса
    let companyAddress: string | null = null
    try {
      const companyData = await fetchYClientsData(
        `/company/${company_id}`,
        partnerToken,
        user_token
      )
      if (companyData.success && companyData.data) {
        companyAddress = companyData.data.address || null
        console.log(`Company address: ${companyAddress}`)
      }
    } catch (e) {
      console.log('Could not fetch company info, continuing without address')
    }
    
    // 2. Получаем список сотрудников (тренеров)
    const staffData = await fetchYClientsData(
      `/company/${company_id}/staff`,
      partnerToken,
      user_token
    )
    
    const staffMap = new Map<number, string>()
    if (staffData.success && Array.isArray(staffData.data)) {
      for (const staff of staffData.data) {
        staffMap.set(staff.id, staff.name)
      }
      console.log(`Found ${staffMap.size} staff members`)
    }
    
    // 3. Получаем услуги (типы тренировок)
    const servicesData = await fetchYClientsData(
      `/book_services/${company_id}`,
      partnerToken,
      user_token
    )
    
    const servicesMap = new Map<number, YClientsService>()
    if (servicesData.success && Array.isArray(servicesData.data?.services)) {
      for (const service of servicesData.data.services) {
        servicesMap.set(service.id, service)
      }
      console.log(`Found ${servicesMap.size} services`)
    }
    
    // 4. Получаем расписание на следующие 14 дней
    const dates = getNextDays(14)
    const trainings: Training[] = []
    
    for (const date of dates) {
      try {
        // Получаем доступные слоты для каждого сотрудника на дату
        for (const [staffId, staffName] of staffMap) {
          try {
            const timesData = await fetchYClientsData(
              `/book_times/${company_id}/${staffId}/${date}`,
              partnerToken,
              user_token
            )
            
            if (!timesData.success || !Array.isArray(timesData.data)) {
              continue
            }
            
            for (const slot of timesData.data) {
              // Получаем услуги для этого слота
              const serviceIds = slot.service_ids || []
              
              for (const serviceId of serviceIds) {
                const service = servicesMap.get(serviceId)
                if (!service) continue
                
                const time_start = slot.time
                const durationMinutes = Math.floor(slot.seance_length / 60)
                const time_end = addMinutesToTime(time_start, durationMinutes)
                
                const type = parseServiceType(service.title)
                const level = parseServiceLevel(service.title)
                
                const training: Training = {
                  channel_id: channel.id,
                  date,
                  time_start,
                  time_end,
                  coach: staffName || channel.default_coach,
                  level,
                  type,
                  price: service.price_min || null,
                  location: companyAddress,
                  location_id: null,
                  description: service.title,
                  title: service.title,
                  raw_text: JSON.stringify({ service, slot, staff: staffName }),
                  message_id: `yclients:${company_id}:${date}:${staffId}:${serviceId}:${time_start}`,
                  signup_url: type === 'игровая' 
                    ? channel.permanent_signup_url_game 
                    : channel.permanent_signup_url_group,
                  spots: null
                }
                
                trainings.push(training)
              }
            }
          } catch (e) {
            // Слоты могут быть пустыми для некоторых дат
            continue
          }
        }
      } catch (e) {
        console.error(`Error fetching schedule for ${date}:`, e)
      }
    }
    
    console.log(`Collected ${trainings.length} training slots from YClients`)
    
    // 5. Альтернативный метод: получаем расписание записей через book_dates
    // Это может дать лучшие результаты для групповых тренировок
    if (trainings.length === 0) {
      console.log('No slots found via book_times, trying book_dates...')
      
      for (const date of dates) {
        try {
          const bookDatesData = await fetchYClientsData(
            `/book_dates/${company_id}?date_from=${date}&date_to=${date}`,
            partnerToken,
            user_token
          )
          
          if (bookDatesData.success && Array.isArray(bookDatesData.data?.booking_dates)) {
            for (const booking of bookDatesData.data.booking_dates) {
              const service = servicesMap.get(booking.service_id)
              
              const training: Training = {
                channel_id: channel.id,
                date: booking.date || date,
                time_start: booking.time || '00:00',
                time_end: null,
                coach: staffMap.get(booking.staff_id) || channel.default_coach,
                level: service ? parseServiceLevel(service.title) : null,
                type: service ? parseServiceType(service.title) : 'групповая',
                price: booking.price || service?.price_min || null,
                location: companyAddress,
                location_id: null,
                description: service?.title || booking.title || null,
                title: service?.title || booking.title || 'Тренировка',
                raw_text: JSON.stringify(booking),
                message_id: `yclients:${company_id}:${booking.id || `${date}:${booking.time}`}`,
                signup_url: null,
                spots: null
              }
              
              trainings.push(training)
            }
          }
        } catch (e) {
          continue
        }
      }
    }
    
    // 6. Ещё один метод: timetable (расписание персонала)
    if (trainings.length === 0) {
      console.log('Trying timetable endpoint...')
      
      try {
        const timetableData = await fetchYClientsData(
          `/timetable/${company_id}`,
          partnerToken,
          user_token
        )
        
        if (timetableData.success && Array.isArray(timetableData.data)) {
          for (const entry of timetableData.data) {
            const entryDate = entry.date
            if (!dates.includes(entryDate)) continue
            
            for (const slot of entry.slots || []) {
              const training: Training = {
                channel_id: channel.id,
                date: entryDate,
                time_start: slot.time_from || slot.time || '00:00',
                time_end: slot.time_to || null,
                coach: staffMap.get(slot.staff_id) || channel.default_coach,
                level: null,
                type: 'групповая',
                price: null,
                location: companyAddress,
                location_id: null,
                description: slot.title || null,
                title: slot.title || 'Тренировка',
                raw_text: JSON.stringify(slot),
                message_id: `yclients:${company_id}:${entryDate}:${slot.id || slot.time_from}`,
                signup_url: null,
                spots: slot.capacity || null
              }
              
              trainings.push(training)
            }
          }
        }
      } catch (e) {
        console.error('Timetable fetch error:', e)
      }
    }
    
    if (trainings.length === 0) {
      console.log(`No trainings found for channel ${channel.name}`)
      return { added: 0, errors: 0 }
    }
    
    // 7. Сохраняем тренировки в БД
    console.log(`Upserting ${trainings.length} trainings...`)
    
    const { data: upserted, error: upsertError } = await supabase
      .from('trainings')
      .upsert(trainings, {
        onConflict: 'channel_id,date,time_start,message_id',
        ignoreDuplicates: false
      })
      .select('id')
    
    if (upsertError) {
      console.error('Upsert error:', upsertError.message)
      return { added: 0, errors: trainings.length }
    }
    
    const addedCount = upserted?.length || trainings.length
    console.log(`Successfully upserted ${addedCount} trainings`)
    
    return { added: addedCount, errors: 0 }
    
  } catch (error) {
    console.error(`Error syncing channel ${channel.name}:`, error)
    return { added: 0, errors: 1 }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const partnerToken = Deno.env.get('YCLIENTS_PARTNER_TOKEN')
    
    if (!partnerToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'YCLIENTS_PARTNER_TOKEN not configured. Please add it to secrets.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Получаем параметры запроса
    let channelId: string | null = null
    try {
      const body = await req.json()
      channelId = body.channel_id || null
    } catch {
      // Нет тела запроса - синхронизируем все каналы
    }
    
    // Получаем каналы с parse_mode = 'yclients'
    let query = supabase
      .from('channels')
      .select('id, name, parse_mode, yclients_config, default_coach, permanent_signup_url_game, permanent_signup_url_group')
      .eq('parse_mode', 'yclients')
      .eq('is_active', true)
    
    if (channelId) {
      query = query.eq('id', channelId)
    }
    
    const { data: channels, error: channelsError } = await query
    
    if (channelsError) {
      throw new Error(`Failed to fetch channels: ${channelsError.message}`)
    }
    
    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No YClients channels to sync',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Found ${channels.length} YClients channel(s) to sync`)
    
    let totalAdded = 0
    let totalErrors = 0
    
    for (const channel of channels) {
      const result = await syncYClientsChannel(channel as Channel, partnerToken, supabase)
      totalAdded += result.added
      totalErrors += result.errors
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${channels.length} YClients channel(s)`,
        added: totalAdded,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('YClients sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})