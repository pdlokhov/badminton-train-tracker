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
  channels?: { name: string };
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  
  // Channels list for filter
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

  const fetchChannels = async () => {
    const { data } = await supabase.from("channels").select("id, name").order("name");
    setChannels(data || []);
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchTrainings = async () => {
    setLoading(true);
    
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm:ss");
    
    let query = supabase
      .from("trainings")
      .select("*, channels(name)")
      .or(`date.gt.${dateFrom || today},and(date.eq.${dateFrom || today},time_start.gte.${currentTime})`)
      .order("date", { ascending: true, nullsFirst: false })
      .order("time_start", { ascending: true, nullsFirst: false });

    if (dateTo) {
      query = query.lte("date", dateTo);
    }
    if (coachFilter) {
      query = query.ilike("coach", `%${coachFilter}%`);
    }
    if (levelFilter && levelFilter !== "all") {
      query = query.eq("level", levelFilter);
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
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrainings();
  }, [refreshTrigger, dateFrom, dateTo, coachFilter, levelFilter, locationFilter, channelFilter]);

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
          aVal = a.coach;
          bVal = b.coach;
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
    setDateFrom("");
    setDateTo("");
    setCoachFilter("");
    setLevelFilter("all");
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
        <div className="mb-4 grid gap-3 rounded-lg border bg-muted/50 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Дата от</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Дата до</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Тренер</label>
            <Input
              placeholder="Поиск по тренеру"
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Уровень</label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все уровни" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все уровни</SelectItem>
                <SelectItem value="Начинающий">Начинающий</SelectItem>
                <SelectItem value="Средний">Средний</SelectItem>
                <SelectItem value="Продвинутый">Продвинутый</SelectItem>
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
            <label className="text-xs font-medium text-muted-foreground">Канал</label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Все каналы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все каналы</SelectItem>
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
            <p className="text-sm">Добавьте каналы и нажмите "Обновить расписание"</p>
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
                    <span className="flex items-center">Канал<SortIcon field="channel" /></span>
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
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {training.type}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{training.coach || "—"}</TableCell>
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
