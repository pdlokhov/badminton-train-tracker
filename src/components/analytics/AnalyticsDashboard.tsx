import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Eye, Users, Send, Clock, TrendingDown, Search } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { VisitorsChart } from "./VisitorsChart";
import { DevicesPieChart } from "./DevicesPieChart";
import { PopularTypesChart } from "./PopularTypesChart";
import { TopSearchesTable } from "./TopSearchesTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DateRange = "7d" | "30d" | "90d";

interface DailyStats {
  date: string;
  page_views: number;
  unique_visitors: number;
  telegram_clicks: number;
  avg_session_duration: number;
  bounce_rate: number;
  device_breakdown: { mobile?: number; desktop?: number; tablet?: number };
  popular_types: Record<string, number>;
  search_queries: Record<string, number>;
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
      }
      setLoading(false);
    }

    fetchStats();
  }, [dateRange]);

  // Fetch today's realtime stats from events
  useEffect(() => {
    async function fetchRealtimeStats() {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      const { data: events } = await supabase
        .from("analytics_events")
        .select("event_type, visitor_id")
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday);

      if (events) {
        const pageViews = events.filter(e => e.event_type === "page_view").length;
        const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size;
        const telegramClicks = events.filter(e => e.event_type === "telegram_redirect").length;

        setRealtimeStats({
          todayViews: pageViews,
          todayVisitors: uniqueVisitors,
          todayTelegram: telegramClicks,
        });
      }
    }

    fetchRealtimeStats();
    const interval = setInterval(fetchRealtimeStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

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

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        <VisitorsChart data={chartData} />
        <DevicesPieChart data={deviceBreakdown} />
      </div>

      {/* Popular types and searches */}
      <div className="grid md:grid-cols-2 gap-4">
        <PopularTypesChart data={popularTypes} title="Популярные типы тренировок" />
        <TopSearchesTable data={searchQueries} />
      </div>
    </div>
  );
}
