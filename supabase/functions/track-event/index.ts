import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      visitor_id, 
      session_id, 
      event_type, 
      event_data, 
      page_path, 
      referrer, 
      user_agent, 
      device_type 
    } = await req.json();

    // Basic validation
    if (!visitor_id || !session_id || !event_type) {
      console.error('Missing required fields:', { visitor_id: !!visitor_id, session_id: !!session_id, event_type: !!event_type });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate field lengths to prevent abuse
    if (visitor_id.length > 100 || session_id.length > 100 || event_type.length > 50) {
      console.error('Field length exceeded');
      return new Response(
        JSON.stringify({ error: 'Invalid field length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from('analytics_events').insert({
      visitor_id,
      session_id,
      event_type,
      event_data: event_data || {},
      page_path: page_path?.substring(0, 500) || null,
      referrer: referrer?.substring(0, 1000) || null,
      user_agent: user_agent?.substring(0, 500) || null,
      device_type: device_type?.substring(0, 20) || null,
    });

    if (error) {
      console.error('Database insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in track-event function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
