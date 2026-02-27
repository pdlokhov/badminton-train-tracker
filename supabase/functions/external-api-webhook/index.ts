import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface Channel {
  id: string
  name: string
  parse_mode: string
  external_api_config: any
  default_coach: string | null
  permanent_signup_url_game: string | null
  permanent_signup_url_group: string | null
}

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
    const levelMatch = title.match(/\b([A-Fa-f])\s*[-–]\s*([A-Fa-f])\b/)
    if (levelMatch) return `${levelMatch[1].toUpperCase()}-${levelMatch[2].toUpperCase()}`
    const singleMatch = title.match(/уровень\s+([A-Fa-f])\b/i)
    if (singleMatch) return singleMatch[1].toUpperCase()
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

function mapToTraining(item: any, channel: Channel): any | null {
  const date = item.date || null
  if (!date) return null

  const timeStart = item.time_start || item.timeStart || item.start_time || null
  const timeEnd = item.time_end || item.timeEnd || item.end_time || null

  // Stable message_id is critical for upsert to UPDATE existing records (e.g. spots_available)
  // Priority: item.id (external system ID) > title+time combo > date+time only
  const stableKey = item.id
    ? String(item.id)
    : item.title
      ? `${date}_${timeStart || ''}_${item.title}`
      : `${date}_${timeStart || ''}`
  const messageId = `extapi:${channel.id.substring(0, 8)}:${stableKey}`

  const typeCode = item.training_type_code || null
  const type = item.type || item.training_type || parseTypeFromCode(typeCode, item.title) || null
  const level = item.level || parseLevelFromTitle(item.title, typeCode) || null

  const signupUrl = type === 'игровая'
    ? (item.signup_url || channel.permanent_signup_url_game)
    : (item.signup_url || channel.permanent_signup_url_group)

  return {
    channel_id: channel.id,
    date,
    time_start: timeStart || '00:00:00',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate via x-api-key header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find channel by API key in external_api_config
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, name, parse_mode, external_api_config, default_coach, permanent_signup_url_game, permanent_signup_url_group')
      .eq('is_active', true)

    if (channelsError) {
      console.error('Error fetching channels:', channelsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Match channel by api_key in external_api_config
    const channel = (channels || []).find((ch: any) => {
      const config = ch.external_api_config
      return config && config.api_key === apiKey
    }) as Channel | undefined

    if (!channel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Webhook received for channel: ${channel.name} (${channel.id})`)

    // Parse body
    const body = await req.json()

    // Handle discount.created event
    if (body.event === 'discount.created') {
      console.log('Processing discount.created event')
      const discountItems: any[] = Array.isArray(body.trainings) ? body.trainings : []
      let updated = 0

      for (const item of discountItems) {
        const sessionId = item.session_id || item.id
        if (!sessionId) continue

        if (item.is_active === false) {
          // Clear discount
          const { error } = await supabase
            .from('trainings')
            .update({
              discount_percent: null,
              original_price: null,
              discounted_price: null,
              discount_expires_at: null,
            })
            .like('message_id', `%${sessionId}%`)

          if (!error) updated++
        } else {
          const { error } = await supabase
            .from('trainings')
            .update({
              discount_percent: item.discount_percent || null,
              original_price: item.original_price != null ? Number(item.original_price) : null,
              discounted_price: item.discounted_price != null ? Number(item.discounted_price) : null,
              discount_expires_at: item.expires_at || item.discount_expires_at || null,
            })
            .like('message_id', `%${sessionId}%`)

          if (!error) updated++
        }
      }

      // Send push notifications for active discounts
      const activeDiscounts = discountItems.filter(d => d.is_active !== false)
      if (activeDiscounts.length > 0) {
        try {
          await sendPushNotifications(supabase, activeDiscounts)
        } catch (pushErr) {
          console.error('Push notification error (non-fatal):', pushErr)
        }
      }

      console.log(`Discount event: updated ${updated} trainings`)
      return new Response(
        JSON.stringify({ success: true, updated }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Existing flow: upsert trainings
    const items: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.trainings)
        ? body.trainings
        : Array.isArray(body?.data)
          ? body.data
          : []

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, upserted: 0, message: 'No trainings in payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${items.length} trainings from webhook`)

    // Map items to training records
    const trainings: any[] = []
    for (const item of items) {
      const training = mapToTraining(item, channel)
      if (training) {
        trainings.push(training)
      }
    }

    if (trainings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, upserted: 0, message: 'No valid trainings mapped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upsert trainings in batches
    let upserted = 0
    const batchSize = 50
    for (let i = 0; i < trainings.length; i += batchSize) {
      const batch = trainings.slice(i, i + batchSize)
      const { data, error: upsertError } = await supabase
        .from('trainings')
        .upsert(batch, {
          onConflict: 'channel_id,date,time_start,message_id',
          ignoreDuplicates: false
        })
        .select('id')

      if (upsertError) {
        console.error(`Batch upsert error:`, upsertError)
      } else {
        upserted += data?.length || batch.length
      }
    }

    console.log(`Webhook: upserted ${upserted} trainings for ${channel.name}`)

    return new Response(
      JSON.stringify({ success: true, upserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Web Push notification sending
async function sendPushNotifications(supabase: any, discounts: any[]) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@badminton-spb.ru'

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('VAPID keys not configured, skipping push')
    return
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscribers')
    return
  }

  // Build notification payload
  const discount = discounts[0]
  const title = `🔥 Last Minute -${discount.discount_percent || 30}%!`
  const priceInfo = discount.discounted_price
    ? `${discount.discounted_price} ₽ (было ${discount.original_price || ''} ₽)`
    : ''
  const body = discount.title
    ? `${discount.title}, ${priceInfo}`
    : `Скидка на тренировку! ${priceInfo}`

  const payload = JSON.stringify({
    title,
    body,
    icon: '/pwa-192x192.png',
    url: '/',
    tag: 'last-minute-discount',
  })

  // Use web-push library via esm.sh
  const webpush = await import('https://esm.sh/web-push@3.6.7')
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      sent++
    } catch (err: any) {
      failed++
      // Remove expired subscriptions (410 Gone)
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
      }
    }
  }

  console.log(`Push notifications: sent=${sent}, failed=${failed}`)
}
