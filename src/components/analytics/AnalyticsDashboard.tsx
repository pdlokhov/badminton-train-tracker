import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Eye, Users, Send, Clock, TrendingDown, Search, RefreshCw, UserCheck, CalendarDays } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { VisitorsChart } from "./VisitorsChart";
import { DevicesPieChart } from "./DevicesPieChart";
import { PopularTypesChart } from "./PopularTypesChart";
import { PopularChannelsChart } from "./PopularChannelsChart";
import { ChannelTypesTable } from "./ChannelTypesTable";
import { TopSearchesTable } from "./TopSearchesTable";
import { DailyVisitorsChart } from "./DailyVisitorsChart";
import { RetentionTable } from "./RetentionTable";
import { UserActivityTable } from "./UserActivityTable";
import { SignupDistributionChart } from "./SignupDistributionChart";
import { PWAMetricsCard } from "./PWAMetricsCard";
import { PWAInstallsChart } from "./PWAInstallsChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
  const [aggregating, setAggregating] = useState(false);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    pageViews: 0,
    uniqueVisitors: 0,
    telegramClicks: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
    avgSignupsPerUserPerWeek: 0,
    avgActiveDaysPerUser: 0,
  });
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [signupDistribution, setSignupDistribution] = useState<any[]>([]);
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
  const [pwaMetrics, setPwaMetrics] = useState({
    totalInstalls: 0,
    bannerViews: 0,
    bannerDismisses: 0,
    iosInstructions: 0,
    pwaSessions: 0,
    activePwaUsers: 0,
    conversionRate: 0,
    platformBreakdown: { ios: 0, android: 0, desktop: 0 },
  });
  const [pwaDailyData, setPwaDailyData] = useState<Array<{
    date: string;
    installs: number;
    sessions: number;
    bannerViews: number;
  }>>([]);
  const { toast } = useToast();

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

  // Fetch realtime stats and channel data from events
  useEffect(() => {
    async function fetchRealtimeStats() {
      const days = getDaysCount(dateRange);
      const startDate = subDays(new Date(), days);
      const startOfRange = startOfDay(startDate).toISOString();
      const endOfRange = endOfDay(new Date()).toISOString();

      const { data: events } = await supabase
        .from("analytics_events")
        .select("event_type, visitor_id, event_data, created_at, session_id")
        .gte("created_at", startOfRange)
        .lte("created_at", endOfRange);

      if (events) {
        // Calculate real-time metrics from all events in range
        const pageViews = events.filter(e => e.event_type === "page_view").length;
        const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size;
        const telegramClicks = events.filter(e => e.event_type === "telegram_redirect").length;

        // Calculate session duration and bounce rate
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

        let totalDuration = 0;
        let bounceSessions = 0;
        sessions.forEach(session => {
          const duration = (session.end.getTime() - session.start.getTime()) / 1000;
          totalDuration += duration;
          if (session.events === 1) bounceSessions++;
        });
        
        const avgSessionDuration = sessions.size > 0 ? Math.round(totalDuration / sessions.size) : 0;
        const bounceRate = sessions.size > 0 ? Math.round((bounceSessions / sessions.size) * 100) : 0;

        // Calculate user activity metrics
        const userStats = new Map<string, {
          signups: number;
          dates: Set<string>;
          trainings: Set<string>;
        }>();

        events.forEach(event => {
          if (!userStats.has(event.visitor_id)) {
            userStats.set(event.visitor_id, {
              signups: 0,
              dates: new Set(),
              trainings: new Set()
            });
          }
          const stats = userStats.get(event.visitor_id)!;
          
          if (event.event_type === 'telegram_redirect') {
            stats.signups++;
          }
          if (event.event_type === 'training_click') {
            const eventData = event.event_data as Record<string, unknown>;
            const trainingId = eventData?.training_id;
            if (trainingId) {
              stats.trainings.add(String(trainingId));
            }
          }
          stats.dates.add(event.created_at.split('T')[0]);
        });

        // Build user activity array
        const activityData = Array.from(userStats.entries()).map(([visitor_id, stats]) => ({
          visitor_id,
          total_signups: stats.signups,
          active_days: stats.dates.size,
          unique_trainings: stats.trainings.size,
          avg_signups_per_day: stats.dates.size > 0 ? stats.signups / stats.dates.size : 0
        })).filter(u => u.total_signups > 0);

        setUserActivity(activityData);

        // Calculate distribution buckets
        const buckets = [
          { bucket: '1', min: 1, max: 1, users: 0 },
          { bucket: '2-3', min: 2, max: 3, users: 0 },
          { bucket: '4-5', min: 4, max: 5, users: 0 },
          { bucket: '6-10', min: 6, max: 10, users: 0 },
          { bucket: '11+', min: 11, max: Infinity, users: 0 }
        ];

        activityData.forEach(user => {
          const bucket = buckets.find(b => user.total_signups >= b.min && user.total_signups <= b.max);
          if (bucket) bucket.users++;
        });

        setSignupDistribution(buckets);

        // Calculate average metrics
        const totalUsers = activityData.length;
        const daysInPeriod = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksInPeriod = daysInPeriod / 7;

        const totalSignups = activityData.reduce((sum, u) => sum + u.total_signups, 0);
        const totalActiveDays = activityData.reduce((sum, u) => sum + u.active_days, 0);

        const avgSignupsPerUserPerWeek = totalUsers > 0 && weeksInPeriod > 0 
          ? totalSignups / totalUsers / weeksInPeriod 
          : 0;
        const avgActiveDaysPerUser = totalUsers > 0 ? totalActiveDays / totalUsers : 0;

        setRealtimeMetrics({
          pageViews,
          uniqueVisitors,
          telegramClicks,
          avgSessionDuration,
          bounceRate,
          avgSignupsPerUserPerWeek,
          avgActiveDaysPerUser,
        });

        // Today's stats for the banner
        const today = new Date();
        const startOfToday = startOfDay(today).toISOString();
        const todayEvents = events.filter(e => e.created_at >= startOfToday);
        
        const todayPageViews = todayEvents.filter(e => e.event_type === "page_view").length;
        const todayUniqueVisitors = new Set(todayEvents.map(e => e.visitor_id)).size;
        const todayTelegramClicks = todayEvents.filter(e => e.event_type === "telegram_redirect").length;

        setRealtimeStats({
          todayViews: todayPageViews,
          todayVisitors: todayUniqueVisitors,
          todayTelegram: todayTelegramClicks,
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

        // Calculate PWA metrics
        const pwaInstalls = events.filter(e => e.event_type === "pwa_install").length;
        const pwaBannerViews = events.filter(e => e.event_type === "pwa_banner_view").length;
        const pwaBannerDismisses = events.filter(e => e.event_type === "pwa_banner_dismiss").length;
        const pwaIosInstructions = events.filter(e => e.event_type === "pwa_ios_instructions_viewed").length;
        const pwaSessions = events.filter(e => e.event_type === "pwa_session_start").length;
        
        // Count unique PWA users by platform
        const pwaUsers = new Set<string>();
        const pwaUsersByPlatform = {
          ios: new Set<string>(),
          android: new Set<string>(),
          desktop: new Set<string>(),
        };
        const platformSessions = { ios: 0, android: 0, desktop: 0 };
        
        events.forEach(event => {
          const eventData = event.event_data as Record<string, unknown>;
          if (eventData?.is_pwa === true) {
            pwaUsers.add(event.visitor_id);
          }
          if (event.event_type === "pwa_session_start") {
            const platform = (eventData?.platform as string) || "desktop";
            if (platform === "ios") {
              platformSessions.ios++;
              pwaUsersByPlatform.ios.add(event.visitor_id);
            } else if (platform === "android") {
              platformSessions.android++;
              pwaUsersByPlatform.android.add(event.visitor_id);
            } else {
              platformSessions.desktop++;
              pwaUsersByPlatform.desktop.add(event.visitor_id);
            }
          }
        });

        const platformUsers = {
          ios: pwaUsersByPlatform.ios.size,
          android: pwaUsersByPlatform.android.size,
          desktop: pwaUsersByPlatform.desktop.size,
        };

        const conversionRate = pwaBannerViews > 0 
          ? (pwaInstalls / pwaBannerViews) * 100 
          : 0;

        setPwaMetrics({
          totalInstalls: pwaInstalls,
          bannerViews: pwaBannerViews,
          bannerDismisses: pwaBannerDismisses,
          iosInstructions: pwaIosInstructions,
          pwaSessions: pwaSessions,
          activePwaUsers: pwaUsers.size,
          conversionRate: conversionRate,
          platformBreakdown: platformUsers,
        });

        // Calculate daily PWA data
        const pwaDailyMap = new Map<string, { installs: number; sessions: number; bannerViews: number }>();
        
        events.forEach(event => {
          const eventDate = format(new Date(event.created_at), "yyyy-MM-dd");
          if (!pwaDailyMap.has(eventDate)) {
            pwaDailyMap.set(eventDate, { installs: 0, sessions: 0, bannerViews: 0 });
          }
          const dayData = pwaDailyMap.get(eventDate)!;
          
          if (event.event_type === "pwa_install") dayData.installs++;
          if (event.event_type === "pwa_session_start") dayData.sessions++;
          if (event.event_type === "pwa_banner_view") dayData.bannerViews++;
        });

        const pwaDailyArray = Array.from(pwaDailyMap.entries())
          .map(([date, data]) => ({
            date,
            ...data,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setPwaDailyData(pwaDailyArray);
      }
    }

    fetchRealtimeStats();
    const interval = setInterval(fetchRealtimeStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [dateRange]);

  // Handle manual aggregation
  const handleAggregate = async () => {
    setAggregating(true);
    try {
      const { data, error } = await supabase.functions.invoke("aggregate-analytics", {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Агрегация завершена",
          description: `Статистика обновлена для ${data.date}`,
        });
        // Refresh daily stats
        const days = getDaysCount(dateRange);
        const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
        const { data: statsData } = await supabase
          .from("analytics_daily")
          .select("*")
          .gte("date", startDate)
          .order("date", { ascending: true });
        
        if (statsData) {
          setStats(statsData as DailyStats[]);
          
          const retentionTableData = statsData
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
      }
    } catch (error) {
      console.error("Aggregation error:", error);
      toast({
        title: "Ошибка агрегации",
        description: error instanceof Error ? error.message : "Не удалось обновить статистику",
        variant: "destructive",
      });
    } finally {
      setAggregating(false);
    }
  };

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
      {/* Date range selector and aggregation button */}
      <div className="flex gap-2 flex-wrap items-center">
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
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAggregate}
          disabled={aggregating}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${aggregating ? "animate-spin" : ""}`} />
          {aggregating ? "Агрегация..." : "Обновить статистику"}
        </Button>
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

      {/* Metric cards - using real-time metrics from events */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Просмотры"
          value={realtimeMetrics.pageViews}
          icon={Eye}
          description="Общее количество просмотров страниц. Считается по событиям 'page_view' из analytics_events."
        />
        <MetricCard
          title="Посетители"
          value={realtimeMetrics.uniqueVisitors}
          icon={Users}
          description="Уникальные посетители за выбранный период. Рассчитывается по уникальным visitor_id из событий."
        />
        <MetricCard
          title="Переходы в TG"
          value={realtimeMetrics.telegramClicks}
          icon={Send}
          description="Количество переходов в Telegram-каналы. Считается по событиям 'telegram_redirect'."
        />
        <MetricCard
          title="CTR в Telegram"
          value={realtimeMetrics.pageViews > 0 ? `${Math.round((realtimeMetrics.telegramClicks / realtimeMetrics.pageViews) * 100)}%` : "0%"}
          icon={TrendingDown}
          description="Click-Through Rate — процент пользователей, которые перешли в Telegram. Формула: (переходы в TG / просмотры) × 100%"
        />
        <MetricCard
          title="Ср. время"
          value={formatDuration(realtimeMetrics.avgSessionDuration)}
          icon={Clock}
          description="Среднее время на сайте за сессию. Рассчитывается как разница между первым и последним событием в каждой сессии."
        />
        <MetricCard
          title="Bounce rate"
          value={`${realtimeMetrics.bounceRate}%`}
          icon={Search}
          description="Процент отказов — доля сессий, в которых было только одно событие. Формула: (сессии с 1 событием / все сессии) × 100%"
        />
        <MetricCard
          title="Ср. записей/пользователь/неделю"
          value={realtimeMetrics.avgSignupsPerUserPerWeek.toFixed(1)}
          icon={UserCheck}
          description="Среднее количество переходов для записи на тренировки на одного пользователя в неделю. Рассчитывается как: (все переходы / пользователей / недель в периоде)"
        />
        <MetricCard
          title="Ср. активных дней/пользователь"
          value={realtimeMetrics.avgActiveDaysPerUser.toFixed(1)}
          icon={CalendarDays}
          description="Среднее количество дней, в которые пользователь заходил на сайт. Показывает, как часто пользователи возвращаются."
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
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <PopularChannelsChart data={channelData.popularChannels} />
        <ChannelTypesTable data={channelData.channelTypes} />
      </div>

      {/* User activity section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignupDistributionChart data={signupDistribution} />
        <div className="lg:col-span-1">
          <UserActivityTable data={userActivity} />
        </div>
      </div>

      {/* PWA Metrics */}
      <div className="grid md:grid-cols-2 gap-4">
        <PWAMetricsCard data={pwaMetrics} />
        <PWAInstallsChart data={pwaDailyData} />
      </div>
    </div>
  );
}
