import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Training {
  id: string;
  channel_id: string;
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
  channels?: { name: string; default_coach: string | null };
}

interface TrainingsListProps {
  refreshTrigger: number;
}

type SortField = 'date' | 'time_start' | 'type' | 'coach' | 'level' | 'price' | 'location' | 'channel';
type SortDirection = 'asc' | 'desc' | null;

export function TrainingsList({ refreshTrigger }: TrainingsListProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [coachFilter, setCoachFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  
  // Channels list for filter
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  
  // Coaches list for filter (extracted from trainings)
  const [coaches, setCoaches] = useState<string[]>([]);
  
  // Levels list for filter (extracted from trainings)
  const [levels, setLevels] = useState<string[]>([]);
  
  // Types list for filter (extracted from trainings)
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
      .select("*, channels(name, default_coach)")
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
    if (locationFilter) {
      query = query.ilike("location", `%${locationFilter}%`);
    }
    if (channelFilter && channelFilter !== "all") {
      query = query.eq("channel_id", channelFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trainings:", error);
    } else {
      setTrainings(data || []);
      
      // Extract unique coaches, levels, types from all trainings for the filter
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
  }, [refreshTrigger, dateFilter, coachFilter, levelFilter, typeFilter, locationFilter, channelFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTrainings = useMemo(() => {
    if (!sortField || !sortDirection) return trainings;

    return [...trainings].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'date':
          aVal = a.date;
          bVal = b.date;
          break;
        case 'time_start':
          aVal = a.time_start;
          bVal = b.time_start;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'coach':
          aVal = a.coach || a.channels?.default_coach;
          bVal = b.coach || b.channels?.default_coach;
          break;
        case 'level':
          aVal = a.level;
          bVal = b.level;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'location':
          aVal = a.location;
          bVal = b.location;
          break;
        case 'channel':
          aVal = a.channels?.name || null;
          bVal = b.channels?.name || null;
          break;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal), 'ru');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [trainings, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const clearFilters = () => {
    setDateFilter(format(new Date(), "yyyy-MM-dd"));
    setCoachFilter("all");
    setLevelFilter("all");
    setTypeFilter("all");
    setLocationFilter("");
    setChannelFilter("all");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (start: string | null, end: string | null) => {
    if (!start) return "—";
    return end ? `${start} - ${end}` : start;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "—";
    return `${price} ₽`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Расписание тренировок ({trainings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 grid gap-3 rounded-lg border bg-muted/50 p-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Дата</label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Тренер</label>
            <Select value={coachFilter} onValueChange={setCoachFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все тренеры" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все тренеры</SelectItem>
                {coaches.map((coach) => (
                  <SelectItem key={coach} value={coach}>
                    {coach}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Уровень</label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все уровни" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все уровни</SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Тип</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Место</label>
            <Input
              placeholder="Поиск по месту"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Клуб</label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все клубы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все клубы</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters} className="h-9 w-full">
              Сбросить фильтры
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : trainings.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
            <Calendar className="mb-2 h-8 w-8" />
            <p>Нет данных о тренировках</p>
            <p className="text-sm">Добавьте клубы и нажмите "Обновить расписание"</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('date')}
                  >
                    <span className="flex items-center">Дата<SortIcon field="date" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('time_start')}
                  >
                    <span className="flex items-center">Время<SortIcon field="time_start" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('type')}
                  >
                    <span className="flex items-center">Тип<SortIcon field="type" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('coach')}
                  >
                    <span className="flex items-center">Тренер<SortIcon field="coach" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('level')}
                  >
                    <span className="flex items-center">Уровень<SortIcon field="level" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('price')}
                  >
                    <span className="flex items-center">Цена<SortIcon field="price" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('location')}
                  >
                    <span className="flex items-center">Место<SortIcon field="location" /></span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('channel')}
                  >
                    <span className="flex items-center">Клуб<SortIcon field="channel" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrainings.map((training) => (
                  <TableRow key={training.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDate(training.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTime(training.time_start, training.time_end)}
                    </TableCell>
                    <TableCell>
                      {training.type ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {training.type}
                          </span>
                          {training.spots && (
                            <span className="text-xs text-muted-foreground">{training.spots} мест</span>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{training.coach || training.channels?.default_coach || "—"}</TableCell>
                    <TableCell>
                      {training.level && (
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          training.level === "Начинающий" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                          training.level === "Средний" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}>
                          {training.level}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatPrice(training.price)}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={training.location || ""}>
                      {training.location || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {training.channels?.name || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
