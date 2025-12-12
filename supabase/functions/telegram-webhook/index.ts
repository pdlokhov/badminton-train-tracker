import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  channel_post?: {
    message_id: number;
    chat: {
      id: number;
      title?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
  };
}

interface ParsedTraining {
  club: string | null;
  date: string | null;
  time_start: string | null;
  time_end: string | null;
  type: string | null;
  level: string | null;
  coach: string | null;
  location: string | null;
  spots: number | null;
  price: number | null;
  description: string | null;
  signup_url: string | null;
}

// Parse structured text message
function parseTextMessage(text: string): ParsedTraining | null {
  console.log('Parsing text message:', text);
  
  const result: ParsedTraining = {
    club: null,
    date: null,
    time_start: null,
    time_end: null,
    type: null,
    level: null,
    coach: null,
    location: null,
    spots: null,
    price: null,
    description: null,
    signup_url: null,
  };

  // Extract club name
  const clubMatch = text.match(/🏸\s*Клуб:\s*(.+?)(?:\n|$)/i) || text.match(/Клуб:\s*(.+?)(?:\n|$)/i);
  if (clubMatch) result.club = clubMatch[1].trim();

  // Extract date (DD.MM.YYYY or DD.MM)
  const dateMatch = text.match(/📅\s*Дата:\s*(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i) || 
                   text.match(/Дата:\s*(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i) ||
                   text.match(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/);
  if (dateMatch) {
    let dateStr = dateMatch[1];
    // Add year if missing
    if (dateStr.split('.').length === 2) {
      const currentYear = new Date().getFullYear();
      dateStr += `.${currentYear}`;
    }
    // Convert to YYYY-MM-DD format
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      result.date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Extract time (HH:MM - HH:MM, HH.MM – HH.MM, etc.)
  // Support both colons and dots as separators, and various dash types (-, –, —)
  const timePattern = /(\d{1,2})[:\.](\d{2})\s*[-–—]\s*(\d{1,2})[:\.](\d{2})/;
  const timeMatch = text.match(new RegExp(`⏰\\s*Время:\\s*${timePattern.source}`, 'i')) ||
                   text.match(new RegExp(`Время:\\s*${timePattern.source}`, 'i')) ||
                   text.match(timePattern);
  if (timeMatch) {
    // Normalize to HH:MM format
    result.time_start = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    result.time_end = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`;
  }

  // Extract training type
  const typeMatch = text.match(/🎯\s*Тип:\s*(.+?)(?:\n|$)/i) || text.match(/Тип:\s*(.+?)(?:\n|$)/i);
  if (typeMatch) {
    const typeStr = typeMatch[1].trim().toLowerCase();
    if (typeStr.includes('игров')) result.type = 'игровая';
    else if (typeStr.includes('мини')) result.type = 'мини-группа';
    else if (typeStr.includes('группов')) result.type = 'групповая';
    else if (typeStr.includes('детск')) result.type = 'детская группа';
    else result.type = typeStr;
  }

  // Extract level
  const levelMatch = text.match(/📊\s*Уровень:\s*(.+?)(?:\n|$)/i) || text.match(/Уровень:\s*(.+?)(?:\n|$)/i);
  if (levelMatch) result.level = levelMatch[1].trim();

  // Extract coach
  const coachMatch = text.match(/👤\s*Тренер:\s*(.+?)(?:\n|$)/i) || text.match(/Тренер:\s*(.+?)(?:\n|$)/i);
  if (coachMatch) result.coach = coachMatch[1].trim();

  // Extract location
  const locationMatch = text.match(/📍\s*(?:Локация|Место|Адрес):\s*(.+?)(?:\n|$)/i) || 
                       text.match(/(?:Локация|Место|Адрес):\s*(.+?)(?:\n|$)/i);
  if (locationMatch) result.location = locationMatch[1].trim();

  // Extract spots
  const spotsMatch = text.match(/👥\s*Мест[а]?:\s*(\d+)/i) || text.match(/Мест[а]?:\s*(\d+)/i) || text.match(/(\d+)\s*мест/i);
  if (spotsMatch) result.spots = parseInt(spotsMatch[1], 10);

  // Extract price
  const priceMatch = text.match(/💰\s*(?:Цена|Стоимость):\s*(\d+)/i) || 
                    text.match(/(?:Цена|Стоимость):\s*(\d+)/i) ||
                    text.match(/(\d+)\s*(?:руб|₽|rub)/i);
  if (priceMatch) result.price = parseInt(priceMatch[1], 10);

  // Extract signup URL
  const urlMatch = text.match(/🔗\s*Запись:\s*(https?:\/\/\S+)/i) || text.match(/(https?:\/\/t\.me\/\S+)/i);
  if (urlMatch) result.signup_url = urlMatch[1].trim();

  // Store full text as description
  result.description = text;

  // Validate required fields
  if (!result.date || !result.time_start) {
    console.log('Missing required fields: date or time_start');
    return null;
  }

  return result;
}

// Parse JSON message
function parseJsonMessage(text: string): ParsedTraining | null {
  try {
    const data = JSON.parse(text);
    console.log('Parsing JSON message:', data);
    
    const result: ParsedTraining = {
      club: data.club || data.клуб || null,
      date: null,
      time_start: data.time_start || data.время_начала || null,
      time_end: data.time_end || data.время_окончания || null,
      type: data.type || data.тип || null,
      level: data.level || data.уровень || null,
      coach: data.coach || data.тренер || null,
      location: data.location || data.локация || data.место || null,
      spots: data.spots || data.места || null,
      price: data.price || data.цена || null,
      description: data.description || data.описание || null,
      signup_url: data.signup_url || data.ссылка || null,
    };

    // Parse date
    const dateStr = data.date || data.дата;
    if (dateStr) {
      // Check if already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        result.date = dateStr;
      } else {
        // Convert DD.MM.YYYY to YYYY-MM-DD
        const parts = dateStr.split('.');
        if (parts.length >= 2) {
          const year = parts[2] || new Date().getFullYear();
          result.date = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    // Validate required fields
    if (!result.date || !result.time_start) {
      console.log('Missing required fields in JSON: date or time_start');
      return null;
    }

    return result;
  } catch (e) {
    console.log('Failed to parse JSON:', e);
    return null;
  }
}

// Check if text is JSON
function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// Find existing channel by bot username (no auto-creation for security)
async function findChannel(supabase: any, botUsername: string): Promise<string | null> {
  const { data: existingChannel } = await supabase
    .from('channels')
    .select('id')
    .eq('username', botUsername)
    .maybeSingle();

  if (existingChannel) {
    return existingChannel.id;
  }

  console.log(`Channel not found for bot: ${botUsername}. Register it in admin panel first.`);
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update, null, 2));

    // Only process channel posts
    if (!update.channel_post?.text) {
      console.log('Not a channel post with text, skipping');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = update.channel_post;
    const text = message.text!;
    const messageId = message.message_id.toString();
    const chatId = message.chat.id;
    const chatTitle = message.chat.title;
    const botUsername = message.from?.username || `bot_${message.from?.id}` || `chat_${chatId}`;

    console.log(`Processing message ${messageId} from ${botUsername} in chat ${chatTitle || chatId}`);

    // Parse the message
    let parsed: ParsedTraining | null = null;
    
    if (isJson(text)) {
      parsed = parseJsonMessage(text);
    } else {
      parsed = parseTextMessage(text);
    }

    if (!parsed) {
      console.log('Failed to parse message, skipping');
      return new Response(JSON.stringify({ ok: true, parsed: false, reason: 'Could not parse message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Parsed training:', parsed);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find existing channel (must be pre-registered in admin panel)
    const channelId = await findChannel(supabase, botUsername);
    if (!channelId) {
      console.log(`Skipping message from unregistered bot: ${botUsername}`);
      return new Response(JSON.stringify({ 
        ok: true, 
        skipped: true, 
        reason: `Channel not registered: ${botUsername}. Add it in admin panel first.` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find location if specified
    let locationId: string | null = null;
    if (parsed.location) {
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name, aliases')
        .or(`name.ilike.%${parsed.location}%,aliases.cs.{${parsed.location}}`);

      if (locations && locations.length > 0) {
        locationId = locations[0].id;
        console.log(`Found location: ${locations[0].name} (${locationId})`);
      }
    }

    // Prepare training record
    const trainingRecord = {
      channel_id: channelId,
      message_id: `webhook_${messageId}`,
      title: parsed.club ? `${parsed.club}: ${parsed.type || 'Тренировка'}` : (parsed.type || 'Тренировка'),
      date: parsed.date,
      time_start: parsed.time_start,
      time_end: parsed.time_end,
      type: parsed.type,
      level: parsed.level,
      coach: parsed.coach,
      location: parsed.location,
      location_id: locationId,
      spots: parsed.spots,
      price: parsed.price,
      description: parsed.description,
      signup_url: parsed.signup_url,
      raw_text: text,
    };

    console.log('Upserting training:', trainingRecord);

    // Upsert training (update if exists, insert if not)
    const { data, error } = await supabase
      .from('trainings')
      .upsert(trainingRecord, {
        onConflict: 'channel_id,date,time_start,message_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error upserting training:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully saved training:', data);

    return new Response(JSON.stringify({ 
      ok: true, 
      parsed: true, 
      training: data?.[0] || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
