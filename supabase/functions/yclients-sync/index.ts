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
    const staffMap = new Map<number, string>()
    try {
      const staffData = await fetchYClientsData(
        `/company/${company_id}/staff`,
        partnerToken,
        user_token
      )
      
      if (staffData.success && Array.isArray(staffData.data)) {
        for (const staff of staffData.data) {
          staffMap.set(staff.id, staff.name)
        }
        console.log(`Found ${staffMap.size} staff members`)
      }
    } catch (e) {
      console.log('Could not fetch staff, continuing without staff names')
    }
    
    // 3. Получаем услуги через несколько эндпоинтов
    const servicesMap = new Map<number, YClientsService>()
    
    // Попробуем book_services (для онлайн-записи)
    try {
      const servicesData = await fetchYClientsData(
        `/book_services/${company_id}`,
        partnerToken,
        user_token
      )
      
      if (servicesData.success && servicesData.data?.services) {
        for (const service of servicesData.data.services) {
          servicesMap.set(service.id, service)
        }
      }
    } catch (e) {
      console.log('book_services endpoint failed, trying services...')
    }
    
    // Попробуем services (общий список услуг компании)
    if (servicesMap.size === 0) {
      try {
        const servicesData = await fetchYClientsData(
          `/company/${company_id}/services`,
          partnerToken,
          user_token
        )
        
        if (servicesData.success && Array.isArray(servicesData.data)) {
          for (const service of servicesData.data) {
            servicesMap.set(service.id, {
              id: service.id,
              title: service.title,
              category_id: service.category_id || 0,
              price_min: service.price_min || service.price || 0,
              price_max: service.price_max || service.price || 0,
              duration: service.duration || service.seance_length || 3600
            })
          }
        }
      } catch (e) {
        console.log('services endpoint also failed')
      }
    }
    
    console.log(`Found ${servicesMap.size} services`)
    
    const trainings: Training[] = []
    const dates = getNextDays(14)
    const dateFrom = dates[0]
    const dateTo = dates[dates.length - 1]
    
    // 4. Попробуем получить activity (групповые занятия)
    console.log('Trying activity endpoint for group classes...')
    try {
      const activityData = await fetchYClientsData(
        `/activity/${company_id}?from=${dateFrom}&to=${dateTo}`,
        partnerToken,
        user_token
      )
      
      if (activityData.success && Array.isArray(activityData.data)) {
        console.log(`Found ${activityData.data.length} activities`)
        
        for (const activity of activityData.data) {
          // activity может содержать: id, date, time, length, staff_id, service_id, capacity, записи
          const activityDate = activity.date
          const activityTime = activity.time || '00:00'
          const durationSeconds = activity.length || activity.seance_length || 3600
          const durationMinutes = Math.floor(durationSeconds / 60)
          const time_end = addMinutesToTime(activityTime, durationMinutes)
          
          const service = servicesMap.get(activity.service_id)
          const serviceTitle = service?.title || activity.title || activity.service_title || 'Тренировка'
          
          const training: Training = {
            channel_id: channel.id,
            date: activityDate,
            time_start: activityTime,
            time_end,
            coach: staffMap.get(activity.staff_id) || activity.staff_name || channel.default_coach,
            level: parseServiceLevel(serviceTitle),
            type: parseServiceType(serviceTitle),
            price: activity.price || service?.price_min || null,
            location: companyAddress,
            location_id: null,
            description: serviceTitle,
            title: serviceTitle,
            raw_text: JSON.stringify(activity),
            message_id: `yclients:${company_id}:activity:${activity.id}`,
            signup_url: parseServiceType(serviceTitle) === 'игровая' 
              ? channel.permanent_signup_url_game 
              : channel.permanent_signup_url_group,
            spots: activity.capacity || activity.max_clients || null
          }
          
          trainings.push(training)
        }
      }
    } catch (e) {
      console.log('Activity endpoint failed:', e instanceof Error ? e.message : e)
    }
    
    // 5. Попробуем records (записи) с фильтрацией по дате
    if (trainings.length === 0) {
      console.log('Trying records endpoint...')
      try {
        const recordsData = await fetchYClientsData(
          `/records/${company_id}?start_date=${dateFrom}&end_date=${dateTo}&count=1000`,
          partnerToken,
          user_token
        )
        
        if (recordsData.success && Array.isArray(recordsData.data)) {
          console.log(`Found ${recordsData.data.length} records`)
          
          // Логируем первые записи для отладки
          if (recordsData.data.length > 0) {
            const sample = recordsData.data[0]
            console.log(`Sample record: date=${sample.date}, datetime=${sample.datetime}, staff_id=${sample.staff_id}, activity_id=${sample.activity_id}`)
          }
          
          // Группируем записи по activity_id или по времени/сотруднику
          const groupedRecords = new Map<string, any>()
          
          for (const record of recordsData.data) {
            // Если есть activity_id - это групповая тренировка
            const groupKey = record.activity_id 
              ? `activity_${record.activity_id}`
              : `${record.date}_${record.staff_id}_${record.datetime}`
            
            if (!groupedRecords.has(groupKey)) {
              groupedRecords.set(groupKey, {
                ...record,
                count: 1
              })
            } else {
              groupedRecords.get(groupKey).count++
            }
          }
          
          console.log(`Grouped into ${groupedRecords.size} unique records`)
          
          const today = new Date().toISOString().split('T')[0]
          
          for (const [_, record] of groupedRecords) {
            // record.date может быть строкой "YYYY-MM-DD" или Unix timestamp
            let recordDate: string | null = null
            if (typeof record.date === 'string' && record.date.includes('-')) {
              recordDate = record.date
            } else if (typeof record.date === 'number') {
              recordDate = new Date(record.date * 1000).toISOString().split('T')[0]
            } else if (record.date) {
              // Попробуем распарсить как число
              const ts = parseInt(record.date, 10)
              if (!isNaN(ts)) {
                recordDate = new Date(ts * 1000).toISOString().split('T')[0]
              }
            }
            
            // Пропускаем только прошлые записи, не будущие
            if (!recordDate) {
              console.log(`Skipping record with no date: ${JSON.stringify(record).substring(0, 100)}`)
              continue
            }
            
            // Пропускаем записи старше сегодня
            if (recordDate < today) {
              continue
            }
            
            // record.datetime также может быть строкой ISO или Unix timestamp
            let recordTime = '00:00'
            if (record.datetime) {
              if (typeof record.datetime === 'string' && record.datetime.includes('T')) {
                // ISO формат: "2026-01-20T10:00:00"
                recordTime = record.datetime.split('T')[1]?.substring(0, 5) || '00:00'
              } else if (typeof record.datetime === 'number') {
                const dt = new Date(record.datetime * 1000)
                recordTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
              } else if (typeof record.datetime === 'string') {
                // Попробуем как Unix timestamp
                const ts = parseInt(record.datetime, 10)
                if (!isNaN(ts)) {
                  const dt = new Date(ts * 1000)
                  recordTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
                }
              }
            }
            
            const durationSeconds = record.seance_length || record.length || 3600
            const durationMinutes = Math.floor(durationSeconds / 60)
            const time_end = addMinutesToTime(recordTime, durationMinutes)
            
            const services = record.services || []
            const firstService = services[0]
            const serviceTitle = firstService?.title || record.title || 'Тренировка'
            
            const training: Training = {
              channel_id: channel.id,
              date: recordDate,
              time_start: recordTime,
              time_end,
              coach: record.staff?.name || staffMap.get(record.staff_id) || channel.default_coach,
              level: parseServiceLevel(serviceTitle),
              type: parseServiceType(serviceTitle),
              price: firstService?.cost || firstService?.first_cost || null,
              location: companyAddress,
              location_id: null,
              description: serviceTitle,
              title: serviceTitle,
              raw_text: JSON.stringify(record),
              message_id: `yclients:${company_id}:record:${record.id || record.activity_id || `${recordDate}_${recordTime}`}`,
              signup_url: parseServiceType(serviceTitle) === 'игровая' 
                ? channel.permanent_signup_url_game 
                : channel.permanent_signup_url_group,
              spots: null
            }
            
            trainings.push(training)
          }
        }
      } catch (e) {
        console.log('Records endpoint failed:', e instanceof Error ? e.message : e)
      }
    }
    
    // 6. Fallback не используем book_times из-за rate limits
    
    console.log(`Collected ${trainings.length} training slots from YClients`)
    
    if (trainings.length === 0) {
      console.log(`No trainings found for channel ${channel.name}`)
      return { added: 0, errors: 0 }
    }
    
    // 7. Сохраняем тренировки в БД
    console.log(`Upserting ${trainings.length} trainings...`)
    
    // Нормализуем time_start для null значений
    const normalizedTrainings = trainings.map(t => ({
      ...t,
      time_start: t.time_start || '00:00:00'
    }))
    
    const { data: upserted, error: upsertError } = await supabase
      .from('trainings')
      .upsert(normalizedTrainings, {
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