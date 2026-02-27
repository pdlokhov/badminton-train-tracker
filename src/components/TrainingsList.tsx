import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { PromotionInfo } from "./TrainingCard";
import { useToast } from "@/hooks/use-toast";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { SearchBar } from "./SearchBar";
import { TrainingCard } from "./TrainingCard";
import { MobileTrainingItem } from "./MobileTrainingItem";
import { DatePicker } from "./DatePicker";
import { AdminFiltersBar } from "./AdminFiltersBar";
import { AdminTrainingsTable } from "./AdminTrainingsTable";
import { ManualTrainingForm } from "./ManualTrainingForm";
import { Button } from "./ui/button";
import { Calendar, Plus } from "lucide-react";

interface Training {
  id: string;
  channel_id: string;
  message_id: string;
  title: string | null;
  type: string | null;
  date: string | null;
  time_start: string | null;
  time_end: string | null;
  coach: string | null;
  level: string | null;
  price: number | null;
  location: string | null;
  location_id: string | null;
  description: string | null;
  raw_text: string;
  spots: number | null;
  spots_available?: number | null;
  signup_url?: string | null;
  discount_percent?: number | null;
  original_price?: number | null;
  discounted_price?: number | null;
  discount_expires_at?: string | null;
  is_recurring?: boolean;
  recurrence_day_of_week?: number | null;
  recurring_until?: string | null;
  recurring_template_id?: string | null;
  channels?: { 
    name: string; 
    default_coach: string | null; 
    username: string;
    default_location_id: string | null;
    permanent_signup_url_game?: string | null;
    permanent_signup_url_group?: string | null;
    default_location?: { name: string; address: string | null } | null;
  } | null;
  location_data?: { name: string; address: string | null } | null;
}

interface TrainingsListProps {
  refreshTrigger: number;
  isAdmin?: boolean;
}

export function TrainingsList({ refreshTrigger, isAdmin = false }: TrainingsListProps) {
  const isMobile = useIsMobile();
  const { trackPageView, trackTelegramRedirect, trackSearch, trackDateChange, trackPromotionImpression, trackPromotionClick } = useAnalytics();
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [coachFilter, setCoachFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [locationSearch, setLocationSearch] = useState("");
  
  // Derived date filter string for API
  const dateFilter = format(selectedDate, "yyyy-MM-dd");
  
  // Manual training form
  const [formOpen, setFormOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  
  // Admin table sorting
  const [tableSortColumn, setTableSortColumn] = useState("time");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">("asc");
  
  // Data for filters
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [coaches, setCoaches] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [promotions, setPromotions] = useState<Map<string, PromotionInfo>>(new Map());
  const fetchChannels = async () => {
    const { data } = await supabase.from("channels").select("id, name").order("name");
    setChannels(data || []);
  };

  const fetchPromotions = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("channel_promotions")
      .select("id, channel_id, highlight_color, label, expires_at")
      .eq("is_active", true)
      .lte("starts_at", now) as { data: Array<{ id: string; channel_id: string; highlight_color: string; label: string | null; expires_at: string | null }> | null };

    const map = new Map<string, PromotionInfo>();
    (data || []).forEach((p) => {
      if (!p.expires_at || new Date(p.expires_at) > new Date()) {
        map.set(p.channel_id, { id: p.id, channel_id: p.channel_id, highlight_color: p.highlight_color, label: p.label });
      }
    });
    setPromotions(map);
  };

  useEffect(() => {
    fetchChannels();
    fetchPromotions();
    trackPageView();
  }, []);

  const fetchTrainings = async () => {
    setLoading(true);
    
    const filterDate = dateFilter || format(new Date(), "yyyy-MM-dd");
    
    let query = supabase
      .from("trainings")
      .select("*, channels(name, default_coach, username, default_location_id, permanent_signup_url_game, permanent_signup_url_group, default_location:locations(name, address)), location_data:locations(name, address)")
      .eq("date", filterDate)
      .order("time_start", { ascending: true, nullsFirst: false });

    if (coachFilter && coachFilter !== "all") {
      query = query.eq("coach", coachFilter);
    }
    if (levelFilter && levelFilter !== "all") {
      query = query.eq("level", levelFilter);
    }
    if (typeFilter && typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }
    if (channelFilter && channelFilter !== "all") {
      query = query.eq("channel_id", channelFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trainings:", error);
    } else {
      // Cast to include permanent_signup_url from channels (column exists but types not yet regenerated)
      setTrainings((data || []) as Training[]);
      
      const uniqueCoaches = new Set<string>();
      const uniqueLevels = new Set<string>();
      const uniqueTypes = new Set<string>();
      (data || []).forEach(training => {
        const coach = training.coach || training.channels?.default_coach;
        if (coach) uniqueCoaches.add(coach);
        if (training.level) uniqueLevels.add(training.level);
        if (training.type) uniqueTypes.add(training.type);
      });
      setCoaches(Array.from(uniqueCoaches).sort((a, b) => a.localeCompare(b, 'ru')));
      setLevels(Array.from(uniqueLevels).sort((a, b) => a.localeCompare(b, 'ru')));
      setTypes(Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b, 'ru')));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrainings();
  }, [refreshTrigger, dateFilter, coachFilter, levelFilter, typeFilter, channelFilter]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('trainings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainings',
        },
        (payload) => {
          console.log('Training changed:', payload.eventType);
          fetchTrainings();
          toast({
            title: "Расписание обновлено",
            duration: 2000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter]);

  // Reset filters
  const resetFilters = () => {
    setCoachFilter("all");
    setLevelFilter("all");
    setTypeFilter("all");
    setChannelFilter("all");
    setLocationSearch("");
  };

  // Handle admin table sort
  const handleTableSort = (column: string) => {
    if (tableSortColumn === column) {
      setTableSortDirection(tableSortDirection === "asc" ? "desc" : "asc");
    } else {
      setTableSortColumn(column);
      setTableSortDirection("asc");
    }
  };

  const handleEdit = (training: Training) => {
    setEditingTraining({
      id: training.id,
      channel_id: training.channel_id,
      date: training.date || format(new Date(), "yyyy-MM-dd"),
      time_start: training.time_start || "",
      time_end: training.time_end || "",
      title: training.title || "",
      type: training.type || "",
      level: training.level || "",
      coach: training.coach || "",
      location_id: training.location_id || "",
      spots: training.spots,
      price: training.price,
      description: training.description || "",
      signup_url: training.signup_url || "",
      is_recurring: training.is_recurring || false,
      recurring_until: training.recurring_until || null,
    });
    setFormOpen(true);
  };

  const handleDelete = async (trainingId: string) => {
    try {
      // Check if training is part of recurring series
      const training = trainings.find(t => t.id === trainingId);
      
      if (training?.recurring_template_id) {
        // Ask user if they want to delete the whole series
        const deleteAll = window.confirm(
          "Эта тренировка является частью регулярного расписания. Удалить все тренировки из этой серии?"
        );
        
        if (deleteAll) {
          const { error } = await supabase
            .from("trainings")
            .delete()
            .eq("recurring_template_id", training.recurring_template_id);

          if (error) throw error;

          toast({
            title: "Серия тренировок удалена",
            description: "Все повторяющиеся тренировки успешно удалены",
          });
        } else {
          const { error } = await supabase
            .from("trainings")
            .delete()
            .eq("id", trainingId);

          if (error) throw error;

          toast({
            title: "Тренировка удалена",
            description: "Только эта тренировка была удалена",
          });
        }
      } else {
        const { error } = await supabase.from("trainings").delete().eq("id", trainingId);

        if (error) throw error;

        toast({
          title: "Тренировка удалена",
          description: "Тренировка успешно удалена из расписания",
        });
      }

      fetchTrainings();
    } catch (error) {
      console.error("Error deleting training:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось удалить тренировку",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    fetchTrainings();
    setEditingTraining(null);
  };

  // Filter out past trainings (for today only) and by search/location query
  const filteredTrainings = useMemo(() => {
    const now = new Date();
    const currentDate = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");
    
    let result = trainings;
    
    // If viewing today and not admin, filter out past trainings
    if (dateFilter === currentDate && !isAdmin) {
      result = result.filter(t => {
        const endTime = t.time_end || t.time_start;
        if (!endTime) return true;
        const compareTime = endTime.length > 5 ? endTime.substring(0, 5) : endTime;
        return compareTime >= currentTime;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const normalizeForSearch = (value?: string | null) =>
        (value || "")
          .toLowerCase()
          .replace(/ё/g, "е")
          .replace(/[\s\-_.(),/\\]+/g, "");

      const query = normalizeForSearch(searchQuery);
      result = result.filter((t) => {
        const searchable = [
          t.type,
          t.location,
          t.channels?.name,
          t.coach,
        ].map(normalizeForSearch);

        return searchable.some((value) => value.includes(query));
      });
    }

    // Apply location search filter (admin only)
    if (locationSearch.trim()) {
      const query = locationSearch.toLowerCase();
      result = result.filter(t => {
        const loc = t.location_data?.name || t.location || t.channels?.default_location?.name || "";
        const addr = t.location_data?.address || t.channels?.default_location?.address || "";
        return loc.toLowerCase().includes(query) || addr.toLowerCase().includes(query);
      });
    }
    
    return result;
  }, [trainings, searchQuery, dateFilter, isAdmin, locationSearch]);

  // Sort trainings (for user view - always by time)
  const sortedTrainings = useMemo(() => {
    return [...filteredTrainings].sort((a, b) => {
      return (a.time_start || "").localeCompare(b.time_start || "");
    });
  }, [filteredTrainings]);

  // Sort trainings for admin table view
  const adminSortedTrainings = useMemo(() => {
    const dir = tableSortDirection === "asc" ? 1 : -1;
    return [...filteredTrainings].sort((a, b) => {
      switch (tableSortColumn) {
        case "date":
          return dir * (a.date || "").localeCompare(b.date || "");
        case "time":
          return dir * (a.time_start || "").localeCompare(b.time_start || "");
        case "type":
          return dir * (a.type || "").localeCompare(b.type || "", "ru");
        case "coach":
          const coachA = a.coach || a.channels?.default_coach || "";
          const coachB = b.coach || b.channels?.default_coach || "";
          return dir * coachA.localeCompare(coachB, "ru");
        case "level":
          return dir * (a.level || "").localeCompare(b.level || "", "ru");
        case "price":
          return dir * ((a.price ?? 9999) - (b.price ?? 9999));
        case "club":
          return dir * (a.channels?.name || "").localeCompare(b.channels?.name || "", "ru");
        default:
          return 0;
      }
    });
  }, [filteredTrainings, tableSortColumn, tableSortDirection]);


  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      if (targetDate.getTime() === today.getTime()) {
        return "Сегодня";
      }
      return format(date, "d MMMM", { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const getTelegramUrl = (training: Training) => {
    // Priority 1: permanent channel URL based on training type
    const isGameTraining = training.type?.toLowerCase().includes('игров');
    const permanentUrl = isGameTraining 
      ? training.channels?.permanent_signup_url_game 
      : training.channels?.permanent_signup_url_group;
    
    if (permanentUrl) {
      return permanentUrl;
    }
    // Priority 2: training-specific signup URL
    if (training.signup_url) {
      return training.signup_url;
    }
    // Priority 3: auto-generated message URL
    if (training.channels?.username && training.message_id) {
      return `https://t.me/${training.channels.username}/${training.message_id}`;
    }
    return undefined;
  };

  // Get location: use training's location_data, or location text, or fallback to channel's default location
  const getLocation = (training: Training) => {
    let locationName: string | null = null;
    let locationAddress: string | null = null;
    
    if (training.location_data) {
      locationName = training.location_data.name;
      locationAddress = training.location_data.address;
    } else if (training.location) {
      locationName = training.location;
    } else if (training.channels?.default_location) {
      locationName = training.channels.default_location.name;
      locationAddress = training.channels.default_location.address;
    }
    
    if (!locationName) return null;
    return locationAddress ? `${locationName}, ${locationAddress}` : locationName;
  };

  // Prepare trainings with location display for admin table
  const trainingsWithLocation = useMemo(() => {
    return adminSortedTrainings.map(t => ({
      ...t,
      locationDisplay: getLocation(t),
    }));
  }, [adminSortedTrainings]);

  // Admin view
  if (isAdmin) {
    return (
      <>
        <div className="space-y-4">
          {/* Add Training Button */}
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingTraining(null);
              setFormOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить тренировку
            </Button>
          </div>

          {/* Admin Filters Bar */}
          <AdminFiltersBar
            date={selectedDate}
            coach={coachFilter}
            level={levelFilter}
            type={typeFilter}
            locationSearch={locationSearch}
            channel={channelFilter}
            onDateChange={setSelectedDate}
            onCoachChange={setCoachFilter}
            onLevelChange={setLevelFilter}
            onTypeChange={setTypeFilter}
            onLocationSearchChange={setLocationSearch}
            onChannelChange={setChannelFilter}
            onReset={resetFilters}
            coaches={coaches}
            levels={levels}
            types={types}
            channels={channels}
          />

          {/* Count */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Найдено: {trainingsWithLocation.length} тренировок
            </span>
          </div>

          {/* Admin Table */}
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <AdminTrainingsTable
              trainings={trainingsWithLocation}
              sortColumn={tableSortColumn}
              sortDirection={tableSortDirection}
              onSort={handleTableSort}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Manual Training Form */}
        <ManualTrainingForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleFormSuccess}
          editingTraining={editingTraining}
        />
      </>
    );
  }

  // User view
  return (
    <div className="space-y-4">
      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={(value) => {
          setSearchQuery(value);
          trackSearch(value);
        }}
      />

      {/* Header with date picker and count */}
      <div className="flex items-center gap-2">
        <DatePicker 
          date={selectedDate} 
          onDateChange={(date) => {
            setSelectedDate(date);
            trackDateChange(format(date, "yyyy-MM-dd"));
          }} 
        />
        <span className="text-muted-foreground">•</span>
        <span className="text-base text-muted-foreground">{sortedTrainings.length} тренировок</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sortedTrainings.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
          <Calendar className="mb-2 h-8 w-8" />
          <p>Нет данных о тренировках</p>
        </div>
      ) : isMobile ? (
        // Mobile: List view
        <div className="divide-y divide-border">
          {sortedTrainings.map((training) => (
            <MobileTrainingItem
              key={training.id}
              id={training.id}
              timeStart={training.time_start}
              timeEnd={training.time_end}
              type={training.type}
              level={training.level}
              location={getLocation(training)}
              clubName={training.channels?.name || null}
              price={training.price}
              spots={training.spots}
              spotsAvailable={training.spots_available}
              discountPercent={training.discount_percent}
              originalPrice={training.original_price}
              discountedPrice={training.discounted_price}
              discountExpiresAt={training.discount_expires_at}
              promotion={promotions.get(training.channel_id) || null}
              onPromotionImpression={trackPromotionImpression}
              onPromotionClick={trackPromotionClick}
              onClick={(id, clubName, type) => {
                const url = getTelegramUrl(training);
                if (url) {
                  trackTelegramRedirect(id, clubName, type);
                  openExternalUrl(url);
                }
              }}
            />
          ))}
        </div>
      ) : (
        // Desktop: Card grid
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTrainings.map((training) => (
            <TrainingCard
              key={training.id}
              id={training.id}
              timeStart={training.time_start}
              timeEnd={training.time_end}
              type={training.type}
              level={training.level}
              location={getLocation(training)}
              clubName={training.channels?.name || null}
              price={training.price}
              spots={training.spots}
              spotsAvailable={training.spots_available}
              telegramUrl={getTelegramUrl(training)}
              onTelegramClick={trackTelegramRedirect}
              discountPercent={training.discount_percent}
              originalPrice={training.original_price}
              discountedPrice={training.discounted_price}
              discountExpiresAt={training.discount_expires_at}
              promotion={promotions.get(training.channel_id) || null}
              onPromotionImpression={trackPromotionImpression}
              onPromotionClick={trackPromotionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
