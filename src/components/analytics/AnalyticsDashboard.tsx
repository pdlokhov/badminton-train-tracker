import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Eye, Users, Send, Clock, TrendingDown, Search } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { VisitorsChart } from "./VisitorsChart";
import { DevicesPieChart } from "./DevicesPieChart";
import { PopularTypesChart } from "./PopularTypesChart";
import { PopularChannelsChart } from "./PopularChannelsChart";
import { ChannelTypesTable } from "./ChannelTypesTable";
import { TopSearchesTable } from "./TopSearchesTable";
import { DailyVisitorsChart } from "./DailyVisitorsChart";
import { RetentionTable } from "./RetentionTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DateRange = "7d" | "30d" | "90d";

interface DailyStats {
  date: string;
  page_views: number;
  unique_visitors: number;
  new_visitors: number;
  returning_visitors: number;
  telegram_clicks: number;
  avg_session_duration: number;
  bounce_rate: number;
  device_breakdown: { mobile?: number; desktop?: number; tablet?: number };
  popular_types: Record<string, number>;
  search_queries: Record<string, number>;
  retention_d1: number | null;
  retention_d7: number | null;
  retention_d30: number | null;
}

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [realtimeStats, setRealtimeStats] = useState({
    todayViews: 0,
    todayVisitors: 0,
    todayTelegram: 0,
  });
  const [channelData, setChannelData] = useState<{
    popularChannels: Record<string, number>;
    channelTypes: Array<{ channel: string; types: Record<string, number>; total: number }>;
  }>({ popularChannels: {}, channelTypes: [] });
  const [dailyVisitorsData, setDailyVisitorsData] = useState<Array<{
    date: string;
    total: number;
    new: number;
    returning: number;
  }>>([]);
  const [retentionData, setRetentionData] = useState<Array<{
    date: string;
    newVisitors: number;
    retentionD1: number | null;
    retentionD7: number | null;
    retentionD30: number | null;
  }>>([]);

  const getDaysCount = (range: DateRange) => {
    switch (range) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
    }
  };

  // Fetch aggregated daily stats
  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const days = getDaysCount(dateRange);
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("analytics_daily")
        .select("*")
        .gte("date", startDate)
        .order("date", { ascending: true });

      if (!error && data) {
        setStats(data as DailyStats[]);
        
        // Prepare retention data
        const retentionTableData = data
          .filter(d => d.new_visitors > 0)
          .map(d => ({
            date: d.date,
            newVisitors: d.new_visitors,
            retentionD1: d.retention_d1,
            retentionD7: d.retention_d7,
            retentionD30: d.retention_d30,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);
        
        setRetentionData(retentionTableData);
      }
      setLoading(false);
    }

    fetchStats();
  }, [dateRange]);

  // Fetch today's realtime stats and channel data from events
  useEffect(() => {
    async function fetchRealtimeStats() {
      const days = getDaysCount(dateRange);
      const startDate = subDays(new Date(), days);
      const startOfRange = startOfDay(startDate).toISOString();
      const endOfRange = endOfDay(new Date()).toISOString();

      const { data: events } = await supabase
        .from("analytics_events")
        .select("event_type, visitor_id, event_data, created_at")
        .gte("created_at", startOfRange)
        .lte("created_at", endOfRange);

      if (events) {
        // Today's stats
        const today = new Date();
        const startOfToday = startOfDay(today).toISOString();
        const todayEvents = events.filter(e => e.created_at >= startOfToday);
        
        const pageViews = todayEvents.filter(e => e.event_type === "page_view").length;
        const uniqueVisitors = new Set(todayEvents.map(e => e.visitor_id)).size;
        const telegramClicks = todayEvents.filter(e => e.event_type === "telegram_redirect").length;

        setRealtimeStats({
          todayViews: pageViews,
          todayVisitors: uniqueVisitors,
          todayTelegram: telegramClicks,
        });

        // Channel analytics
        const telegramEvents = events.filter(e => e.event_type === "telegram_redirect");
        
        const channelClicksMap: Record<string, number> = {};
        const channelTypesMap: Record<string, Record<string, number>> = {};

        telegramEvents.forEach(event => {
          const eventData = event.event_data as Record<string, unknown>;
          const channel = (eventData?.channel_name as string) || "Неизвестно";
          const type = (eventData?.training_type as string) || "Не указано";

          channelClicksMap[channel] = (channelClicksMap[channel] || 0) + 1;

          if (!channelTypesMap[channel]) {
            channelTypesMap[channel] = {};
          }
          channelTypesMap[channel][type] = (channelTypesMap[channel][type] || 0) + 1;
        });

        const channelTypesArray = Object.entries(channelTypesMap).map(([channel, types]) => ({
          channel,
          types,
          total: Object.values(types).reduce((sum, count) => sum + count, 0),
        }));

        setChannelData({
          popularChannels: channelClicksMap,
          channelTypes: channelTypesArray,
        });

        // Calculate daily visitors breakdown
        const dailyVisitorsMap = new Map<string, { total: Set<string>; new: Set<string> }>();
        
        events.forEach(event => {
          const eventDate = format(new Date(event.created_at), "yyyy-MM-dd");
          if (!dailyVisitorsMap.has(eventDate)) {
            dailyVisitorsMap.set(eventDate, { total: new Set(), new: new Set() });
          }
          const dayData = dailyVisitorsMap.get(eventDate)!;
          dayData.total.add(event.visitor_id);
          
          // Check if this is a session_start event (new visitor for that day)
          if (event.event_type === "session_start") {
            dayData.new.add(event.visitor_id);
          }
        });

        const dailyVisitors = Array.from(dailyVisitorsMap.entries())
          .map(([date, data]) => ({
            date,
            total: data.total.size,
            new: data.new.size,
            returning: data.total.size - data.new.size,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setDailyVisitorsData(dailyVisitors);
      }
    }

    fetchRealtimeStats();
    const interval = setInterval(fetchRealtimeStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [dateRange]);

  // Calculate totals from stats
  const totals = stats.reduce(
    (acc, day) => ({
      pageViews: acc.pageViews + (day.page_views || 0),
      uniqueVisitors: acc.uniqueVisitors + (day.unique_visitors || 0),
      telegramClicks: acc.telegramClicks + (day.telegram_clicks || 0),
      avgDuration: acc.avgDuration + (day.avg_session_duration || 0),
      bounceRate: acc.bounceRate + (day.bounce_rate || 0),
    }),
    { pageViews: 0, uniqueVisitors: 0, telegramClicks: 0, avgDuration: 0, bounceRate: 0 }
  );

  const avgBounceRate = stats.length > 0 ? Math.round(totals.bounceRate / stats.length) : 0;
  const avgDuration = stats.length > 0 ? Math.round(totals.avgDuration / stats.length) : 0;

  // Aggregate device breakdown
  const deviceBreakdown = stats.reduce(
    (acc, day) => {
      const devices = day.device_breakdown || {};
      return {
        mobile: acc.mobile + (devices.mobile || 0),
        desktop: acc.desktop + (devices.desktop || 0),
        tablet: acc.tablet + (devices.tablet || 0),
      };
    },
    { mobile: 0, desktop: 0, tablet: 0 }
  );

  // Aggregate popular types
  const popularTypes = stats.reduce((acc, day) => {
    const types = day.popular_types || {};
    Object.entries(types).forEach(([type, count]) => {
      acc[type] = (acc[type] || 0) + (count as number);
    });
    return acc;
  }, {} as Record<string, number>);

  // Aggregate search queries
  const searchQueries = stats.reduce((acc, day) => {
    const queries = day.search_queries || {};
    Object.entries(queries).forEach(([query, count]) => {
      acc[query] = (acc[query] || 0) + (count as number);
    });
    return acc;
  }, {} as Record<string, number>);

  // Prepare chart data
  const chartData = stats.map(day => ({
    date: format(new Date(day.date), "d MMM", { locale: ru }),
    visitors: day.unique_visitors || 0,
    pageViews: day.page_views || 0,
  }));

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}с`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}м ${secs}с`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex gap-2">
        {(["7d", "30d", "90d"] as DateRange[]).map((range) => (
          <Button
            key={range}
            variant={dateRange === range ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(range)}
          >
            {range === "7d" ? "7 дней" : range === "30d" ? "30 дней" : "90 дней"}
          </Button>
        ))}
      </div>

      {/* Today's realtime stats */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Сегодня (в реальном времени)</h3>
        <div className="flex gap-6 text-sm">
          <span><strong>{realtimeStats.todayViews}</strong> просмотров</span>
          <span><strong>{realtimeStats.todayVisitors}</strong> посетителей</span>
          <span><strong>{realtimeStats.todayTelegram}</strong> переходов в Telegram</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Просмотры"
          value={totals.pageViews}
          icon={Eye}
        />
        <MetricCard
          title="Посетители"
          value={totals.uniqueVisitors}
          icon={Users}
        />
        <MetricCard
          title="Переходы в TG"
          value={totals.telegramClicks}
          icon={Send}
        />
        <MetricCard
          title="CTR в Telegram"
          value={totals.pageViews > 0 ? `${Math.round((totals.telegramClicks / totals.pageViews) * 100)}%` : "0%"}
          icon={TrendingDown}
        />
        <MetricCard
          title="Ср. время"
          value={formatDuration(avgDuration)}
          icon={Clock}
        />
        <MetricCard
          title="Bounce rate"
          value={`${avgBounceRate}%`}
          icon={Search}
        />
      </div>

      {/* Daily visitors and devices */}
      <div className="grid md:grid-cols-2 gap-4">
        <DailyVisitorsChart data={dailyVisitorsData} />
        <DevicesPieChart data={deviceBreakdown} />
      </div>

      {/* Retention table */}
      <RetentionTable data={retentionData} />

      {/* Original visitors chart */}
      <div className="grid md:grid-cols-2 gap-4">
        <VisitorsChart data={chartData} />
      </div>

      {/* Popular types and searches */}
      <div className="grid md:grid-cols-2 gap-4">
        <PopularTypesChart data={popularTypes} title="Популярные типы тренировок" />
        <TopSearchesTable data={searchQueries} />
      </div>

      {/* Channel analytics */}
      <div className="grid md:grid-cols-2 gap-4">
        <PopularChannelsChart data={channelData.popularChannels} />
        <ChannelTypesTable data={channelData.channelTypes} />
      </div>
    </div>
  );
}
