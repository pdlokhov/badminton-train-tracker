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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get date to aggregate (yesterday by default, or from request)
    const { date: requestDate } = await req.json().catch(() => ({}));
    const targetDate = requestDate || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    console.log(`Aggregating analytics for date: ${targetDate}`);

    // Fetch all events for the target date
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: events, error: eventsError } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    if (!events || events.length === 0) {
      console.log('No events to aggregate for this date');
      return new Response(
        JSON.stringify({ success: true, message: 'No events to aggregate', date: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${events.length} events to aggregate`);

    // Calculate metrics
    const pageViews = events.filter(e => e.event_type === 'page_view').length;
    const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size;
    const telegramClicks = events.filter(e => e.event_type === 'telegram_redirect').length;
    
    // Get unique sessions
    const sessions = new Map<string, { start: Date; end: Date; events: number }>();
    events.forEach(event => {
      const sessionId = event.session_id;
      const eventTime = new Date(event.created_at);
      
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { start: eventTime, end: eventTime, events: 1 });
      } else {
        const session = sessions.get(sessionId)!;
        if (eventTime < session.start) session.start = eventTime;
        if (eventTime > session.end) session.end = eventTime;
        session.events++;
      }
    });

    // Calculate session duration and bounce rate
    let totalDuration = 0;
    let bounceSessions = 0;
    sessions.forEach(session => {
      const duration = (session.end.getTime() - session.start.getTime()) / 1000;
      totalDuration += duration;
      if (session.events === 1) bounceSessions++;
    });
    
    const avgSessionDuration = sessions.size > 0 ? Math.round(totalDuration / sessions.size) : 0;
    const bounceRate = sessions.size > 0 ? Math.round((bounceSessions / sessions.size) * 100) : 0;

    // Count new vs returning visitors
    const visitorFirstSeen = new Map<string, string>();
    events.forEach(event => {
      const eventData = event.event_data as Record<string, unknown>;
      if (event.event_type === 'session_start' && eventData?.landing_page) {
        visitorFirstSeen.set(event.visitor_id, event.created_at);
      }
    });
    const newVisitors = visitorFirstSeen.size;
    const returningVisitors = uniqueVisitors - newVisitors;

    // Device breakdown
    const deviceBreakdown: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    const countedDeviceVisitors = new Set<string>();
    events.forEach(event => {
      if (!countedDeviceVisitors.has(event.visitor_id)) {
        countedDeviceVisitors.add(event.visitor_id);
        const device = event.device_type || 'desktop';
        deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
      }
    });

    // Popular training types
    const popularTypes: Record<string, number> = {};
    events
      .filter(e => e.event_type === 'telegram_redirect')
      .forEach(event => {
        const eventData = event.event_data as Record<string, unknown>;
        const type = (eventData?.training_type as string) || 'Неизвестно';
        popularTypes[type] = (popularTypes[type] || 0) + 1;
      });

    // Search queries
    const searchQueries: Record<string, number> = {};
    events
      .filter(e => e.event_type === 'search')
      .forEach(event => {
        const eventData = event.event_data as Record<string, unknown>;
        const query = (eventData?.query as string)?.toLowerCase() || '';
        if (query) {
          searchQueries[query] = (searchQueries[query] || 0) + 1;
        }
      });

    // Training views
    const trainingViews: Record<string, number> = {};
    events
      .filter(e => e.event_type === 'training_click' || e.event_type === 'telegram_redirect')
      .forEach(event => {
        const eventData = event.event_data as Record<string, unknown>;
        const trainingId = eventData?.training_id as string;
        if (trainingId) {
          trainingViews[trainingId] = (trainingViews[trainingId] || 0) + 1;
        }
      });

    // Peak hours
    const peakHours: Record<string, number> = {};
    events.forEach(event => {
      const hour = new Date(event.created_at).getHours().toString().padStart(2, '0');
      peakHours[hour] = (peakHours[hour] || 0) + 1;
    });

    // Upsert aggregated data
    const aggregatedData = {
      date: targetDate,
      page_views: pageViews,
      unique_visitors: uniqueVisitors,
      new_visitors: newVisitors,
      returning_visitors: returningVisitors,
      telegram_clicks: telegramClicks,
      training_views: trainingViews,
      popular_types: popularTypes,
      popular_levels: {},
      popular_channels: {},
      search_queries: searchQueries,
      avg_session_duration: avgSessionDuration,
      bounce_rate: bounceRate,
      device_breakdown: deviceBreakdown,
      peak_hours: peakHours,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('analytics_daily')
      .upsert(aggregatedData, { onConflict: 'date' });

    if (upsertError) {
      console.error('Error upserting aggregated data:', upsertError);
      throw upsertError;
    }

    console.log('Analytics aggregation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analytics aggregated successfully',
        date: targetDate,
        stats: {
          pageViews,
          uniqueVisitors,
          telegramClicks,
          avgSessionDuration,
          bounceRate,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in aggregate-analytics function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
