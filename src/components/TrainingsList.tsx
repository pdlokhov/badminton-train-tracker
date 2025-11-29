import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { SearchBar } from "./SearchBar";
import { FiltersDropdown } from "./FiltersDropdown";
import { SortDropdown, SortOption } from "./SortDropdown";
import { TrainingCard } from "./TrainingCard";
import { MobileTrainingItem } from "./MobileTrainingItem";
import { FilterChips } from "./FilterChips";
import { DatePicker } from "./DatePicker";
import { Calendar } from "lucide-react";

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
  description: string | null;
  raw_text: string;
  spots: number | null;
  channels?: { name: string; default_coach: string | null; username: string };
}

interface TrainingsListProps {
  refreshTrigger: number;
}

export function TrainingsList({ refreshTrigger }: TrainingsListProps) {
  const isMobile = useIsMobile();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [coachFilter, setCoachFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  
  // Derived date filter string for API
  const dateFilter = format(selectedDate, "yyyy-MM-dd");
  
  // Sort
  const [sortOption, setSortOption] = useState<SortOption>("time");
  
  // Data for filters
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [coaches, setCoaches] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  const fetchChannels = async () => {
    const { data } = await supabase.from("channels").select("id, name").order("name");
    setChannels(data || []);
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchTrainings = async () => {
    setLoading(true);
    
    const filterDate = dateFilter || format(new Date(), "yyyy-MM-dd");
    
    let query = supabase
      .from("trainings")
      .select("*, channels(name, default_coach, username)")
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
      setTrainings(data || []);
      
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

  // Filter out past trainings (for today only) and by search query
  const filteredTrainings = useMemo(() => {
    const now = new Date();
    const currentDate = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");
    
    let result = trainings;
    
    // If viewing today, filter out past trainings
    if (dateFilter === currentDate) {
      result = result.filter(t => {
        // Use time_end if available, otherwise time_start
        const endTime = t.time_end || t.time_start;
        if (!endTime) return true; // Show if no time info
        // Compare time strings (HH:mm:ss or HH:mm format)
        const compareTime = endTime.length > 5 ? endTime.substring(0, 5) : endTime;
        return compareTime >= currentTime;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.type?.toLowerCase().includes(query) ||
        t.location?.toLowerCase().includes(query) ||
        t.channels?.name?.toLowerCase().includes(query) ||
        t.coach?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [trainings, searchQuery, dateFilter]);

  // Sort trainings
  const sortedTrainings = useMemo(() => {
    return [...filteredTrainings].sort((a, b) => {
      switch (sortOption) {
        case "time":
          return (a.time_start || "").localeCompare(b.time_start || "");
        case "price":
          return (a.price ?? 9999) - (b.price ?? 9999);
        case "type":
          return (a.type || "").localeCompare(b.type || "", "ru");
        default:
          return 0;
      }
    });
  }, [filteredTrainings, sortOption]);

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

  // Filter chips for mobile
  const filterChips = useMemo(() => {
    const chips = [{ id: "filters", label: "Фильтры", hasDropdown: true, active: false }];
    
    types.slice(0, 3).forEach(type => {
      chips.push({
        id: `type-${type}`,
        label: type,
        active: typeFilter === type,
        hasDropdown: false,
      });
    });
    
    return chips;
  }, [types, typeFilter]);

  const handleChipClick = (chipId: string) => {
    if (chipId === "filters") return;
    
    if (chipId.startsWith("type-")) {
      const type = chipId.replace("type-", "");
      setTypeFilter(typeFilter === type ? "all" : type);
    }
  };

  const getTelegramUrl = (training: Training) => {
    if (training.channels?.username && training.message_id) {
      return `https://t.me/${training.channels.username}/${training.message_id}`;
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={isMobile ? "Поиск по залу, виду спорта" : "Поиск по залу, виду спорта или району"}
          />
        </div>
        {!isMobile && (
          <FiltersDropdown
            coaches={coaches}
            levels={levels}
            types={types}
            channels={channels}
            selectedCoach={coachFilter}
            selectedLevel={levelFilter}
            selectedType={typeFilter}
            selectedChannel={channelFilter}
            onCoachChange={setCoachFilter}
            onLevelChange={setLevelFilter}
            onTypeChange={setTypeFilter}
            onChannelChange={setChannelFilter}
          />
        )}
      </div>

      {/* Mobile Filter Chips */}
      {isMobile && (
        <FilterChips chips={filterChips} onChipClick={handleChipClick} />
      )}

      {/* Header with date picker, count and sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
          <span className="text-muted-foreground">•</span>
          <span className="text-base text-muted-foreground">{sortedTrainings.length} тренировок</span>
        </div>
        <SortDropdown value={sortOption} onChange={setSortOption} />
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
              timeStart={training.time_start}
              timeEnd={training.time_end}
              type={training.type}
              location={training.location}
              clubName={training.channels?.name || null}
              price={training.price}
              spots={training.spots}
              onClick={() => {
                const url = getTelegramUrl(training);
                if (url) window.open(url, "_blank");
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
              timeStart={training.time_start}
              timeEnd={training.time_end}
              type={training.type}
              location={training.location}
              clubName={training.channels?.name || null}
              price={training.price}
              telegramUrl={getTelegramUrl(training)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
