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

interface ParsedTraining {
  title: string | null
  date: string | null
  time_start: string | null
  time_end: string | null
  coach: string | null
  level: string | null
  price: number | null
  location: string | null
  description: string | null
  raw_text: string
  message_id: string
}

function parseTrainingFromText(text: string, messageId: string): ParsedTraining {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  
  // Try to extract date (formats: DD.MM, DD.MM.YYYY, DD/MM, etc.)
  const dateMatch = text.match(/(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?/)
  let date: string | null = null
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : new Date().getFullYear().toString()
    date = `${year}-${month}-${day}`
  }
  
  // Try to extract time (formats: HH:MM, HH.MM)
  const timeMatches = text.match(/(\d{1,2})[:\.](\d{2})/g)
  let time_start: string | null = null
  let time_end: string | null = null
  if (timeMatches && timeMatches.length >= 1) {
    time_start = timeMatches[0].replace('.', ':')
    if (timeMatches.length >= 2) {
      time_end = timeMatches[1].replace('.', ':')
    }
  }
  
  // Try to extract price
  const priceMatch = text.match(/(\d+)\s*(руб|₽|rub|р\.?)/i) || text.match(/(₽|руб|rub)\s*(\d+)/i)
  const price = priceMatch ? parseInt(priceMatch[1] || priceMatch[2]) : null
  
  // Try to extract level
  let level: string | null = null
  if (/начин|beginner|новичк/i.test(text)) level = 'Начинающий'
  else if (/средн|intermediate|middle/i.test(text)) level = 'Средний'
  else if (/продвин|advanced|профи/i.test(text)) level = 'Продвинутый'
  
  // Extract coach (look for "тренер:", "coach:", or capitalized names after keywords)
  const coachMatch = text.match(/(?:тренер|coach|ведущ[ий|ая])[:\s]+([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)/i)
  const coach = coachMatch ? coachMatch[1] : null
  
  // Extract location
  const locationMatch = text.match(/(?:адрес|место|локация|where|location)[:\s]+(.+?)(?:\n|$)/i)
  const location = locationMatch ? locationMatch[1].trim() : null
  
  // Title is usually the first non-empty line or line with emoji
  const title = lines[0] || null
  
  return {
    title,
    date,
    time_start,
    time_end,
    coach,
    level,
    price,
    location,
    description: lines.slice(1, 3).join(' ') || null,
    raw_text: text,
    message_id: messageId
  }
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
  // Look for tgme_widget_message_wrap elements
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
  
  console.log(`Found ${messages.length} messages in ${username}`)
  return messages
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    for (const channel of channels as Channel[]) {
      console.log(`Processing channel: ${channel.name} (@${channel.username})`)
      
      const messages = await fetchTelegramChannel(channel.username)
      totalParsed += messages.length
      
      for (const msg of messages) {
        const training = parseTrainingFromText(msg.text, msg.messageId)
        
        const { error: upsertError } = await supabase
          .from('trainings')
          .upsert({
            channel_id: channel.id,
            ...training
          }, {
            onConflict: 'channel_id,message_id'
          })
        
        if (upsertError) {
          console.error('Error upserting training:', upsertError)
        } else {
          totalAdded++
        }
      }
    }

    console.log(`Parsing complete. Parsed: ${totalParsed}, Added/Updated: ${totalAdded}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Обработано ${channels.length} каналов`,
        parsed: totalParsed,
        added: totalAdded 
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