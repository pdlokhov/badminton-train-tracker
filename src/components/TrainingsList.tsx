import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
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

export function TrainingsList({ refreshTrigger }: TrainingsListProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");

  const fetchTrainings = async () => {
    setLoading(true);
    
    // Получаем сегодняшнюю дату в формате YYYY-MM-DD
    const today = format(new Date(), "yyyy-MM-dd");
    
    let query = supabase
      .from("trainings")
      .select("*, channels(name)")
      .gte("date", dateFrom || today) // По умолчанию показываем только будущие тренировки
      .order("date", { ascending: true, nullsFirst: false });

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
    if (priceFrom) {
      query = query.gte("price", parseFloat(priceFrom));
    }
    if (priceTo) {
      query = query.lte("price", parseFloat(priceTo));
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
  }, [refreshTrigger, dateFrom, dateTo, coachFilter, levelFilter, locationFilter, priceFrom, priceTo]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCoachFilter("");
    setLevelFilter("all");
    setLocationFilter("");
    setPriceFrom("");
    setPriceTo("");
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

  // Get unique values for filters
  const uniqueCoaches = [...new Set(trainings.map(t => t.coach).filter(Boolean))];
  const uniqueLocations = [...new Set(trainings.map(t => t.location).filter(Boolean))];

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
            <label className="text-xs font-medium text-muted-foreground">Цена от</label>
            <Input
              type="number"
              placeholder="₽"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Цена до</label>
            <Input
              type="number"
              placeholder="₽"
              value={priceTo}
              onChange={(e) => setPriceTo(e.target.value)}
              className="h-9"
            />
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
                  <TableHead>Дата</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Тренер</TableHead>
                  <TableHead>Уровень</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Место</TableHead>
                  <TableHead>Канал</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.map((training) => (
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