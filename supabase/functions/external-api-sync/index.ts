import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExternalApiConfig {
  endpoint_url: string
  api_key: string
  days_ahead: number
  header_name: string
}

interface Channel {
  id: string
  name: string
  parse_mode: string
  external_api_config: ExternalApiConfig | null
  default_coach: string | null
  permanent_signup_url_game: string | null
  permanent_signup_url_group: string | null
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
  spots_available: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { channel_id } = await req.json()
    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'channel_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch channel config
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, name, parse_mode, external_api_config, default_coach, permanent_signup_url_game, permanent_signup_url_group')
      .eq('id', channel_id)
      .single()

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config = (channel as any).external_api_config as ExternalApiConfig | null
    if (!config || !config.endpoint_url || !config.api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'No external API config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build URL with days parameter
    const daysAhead = config.days_ahead || 14
    const separator = config.endpoint_url.includes('?') ? '&' : '?'
    const fetchUrl = `${config.endpoint_url}${separator}date=${daysAhead}`
    const headerName = config.header_name || 'x-api-key'

    console.log(`Fetching from ${fetchUrl} with header ${headerName}`)

    // Fetch external data
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        [headerName]: config.api_key,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`External API error: ${response.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ success: false, error: `External API returned ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const externalData = await response.json()
    console.log(`Received ${Array.isArray(externalData) ? externalData.length : 'non-array'} items`)

    // Handle both array and { data: [...] } formats
    const items: any[] = Array.isArray(externalData)
      ? externalData
      : Array.isArray(externalData?.data)
        ? externalData.data
        : []

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, added: 0, message: 'No trainings found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map external data to trainings
    const trainings: Training[] = []
    for (const item of items) {
      const training = mapToTraining(item, channel as any)
      if (training) {
        trainings.push(training)
      }
    }

    console.log(`Mapped ${trainings.length} trainings`)

    if (trainings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, added: 0, message: 'No valid trainings mapped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete old trainings for this channel from external API
    const today = new Date().toISOString().split('T')[0]
    const { error: deleteError } = await supabase
      .from('trainings')
      .delete()
      .eq('channel_id', channel_id)
      .gte('date', today)
      .like('message_id', 'extapi:%')

    if (deleteError) {
      console.error('Error deleting old trainings:', deleteError)
    }

    // Insert new trainings in batches
    let added = 0
    const batchSize = 50
    for (let i = 0; i < trainings.length; i += batchSize) {
      const batch = trainings.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('trainings')
        .insert(batch)

      if (insertError) {
        console.error(`Batch insert error:`, insertError)
      } else {
        added += batch.length
      }
    }

    console.log(`Successfully added ${added} trainings`)

    return new Response(
      JSON.stringify({ success: true, added }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('External API sync error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseTypeFromCode(code: string | null, title: string | null): string | null {
  if (code) {
    const c = code.toUpperCase()
    if (c === 'GAME' || c === 'GAMING') return 'игровая'
    if (c === 'GROUP' || c === 'BEGINNER') return 'групповая'
    if (c === 'MINI_GROUP' || c === 'MINI') return 'мини-группа'
    if (c === 'KIDS' || c === 'CHILDREN') return 'детская группа'
    if (c === 'TECHNIQUE' || c === 'TECH') return 'техника'
    if (c === 'TOURNAMENT') return 'турнир'
  }
  if (title) {
    const t = title.toLowerCase()
    if (t.includes('игров')) return 'игровая'
    if (t.includes('мини-группа') || t.includes('мини группа')) return 'мини-группа'
    if (t.includes('детск')) return 'детская группа'
    if (t.includes('техник')) return 'техника'
    if (t.includes('турнир') || t.includes('командник')) return 'турнир'
    if (t.includes('группов') || t.includes('новички') || t.includes('начинающ')) return 'групповая'
  }
  return null
}

function parseLevelFromTitle(title: string | null, code: string | null): string | null {
  if (title) {
    // Match level patterns like E-F, C-D, D-E, B-C, A-B etc.
    const levelMatch = title.match(/\b([A-Fa-f])\s*[-–]\s*([A-Fa-f])\b/)
    if (levelMatch) return `${levelMatch[1].toUpperCase()}-${levelMatch[2].toUpperCase()}`
    // Match single level like "уровень C"
    const singleMatch = title.match(/уровень\s+([A-Fa-f])\b/i)
    if (singleMatch) return singleMatch[1].toUpperCase()
    // Check for descriptive levels
    const t = title.toLowerCase()
    if (t.includes('новички') || t.includes('начинающ')) return 'начальный'
    if (t.includes('продвинут')) return 'продвинутый'
    if (t.includes('любой уровень') || t.includes('все уровни')) return 'любой'
  }
  if (code) {
    const c = code.toUpperCase()
    if (c === 'BEGINNER') return 'начальный'
  }
  return null
}

function mapToTraining(item: any, channel: Channel): Training | null {
  const date = item.date || null
  if (!date) return null

  const timeStart = item.time_start || item.timeStart || item.start_time || null
  const timeEnd = item.time_end || item.timeEnd || item.end_time || null

  const uniqueKey = `${date}_${timeStart || ''}_${item.id || item.title || Math.random()}`
  const messageId = `extapi:${channel.id.substring(0, 8)}:${uniqueKey}`

  const typeCode = item.training_type_code || null
  const type = item.type || item.training_type || parseTypeFromCode(typeCode, item.title) || null
  const level = item.level || parseLevelFromTitle(item.title, typeCode) || null

  const signupUrl = type === 'игровая'
    ? (item.signup_url || channel.permanent_signup_url_game)
    : (item.signup_url || channel.permanent_signup_url_group)

  return {
    channel_id: channel.id,
    date,
    time_start: timeStart,
    time_end: timeEnd,
    coach: item.coach || item.trainer || channel.default_coach || null,
    level,
    type,
    price: item.price != null ? Number(item.price) : null,
    location: item.location || item.address || null,
    location_id: item.location_id || null,
    description: item.description || null,
    title: item.title || null,
    raw_text: JSON.stringify(item),
    message_id: messageId,
    signup_url: signupUrl || null,
    spots: item.spots != null ? Number(item.spots) : null,
    spots_available: item.spots_available != null ? Number(item.spots_available) : null,
  }
}
