import { DatePicker } from "./DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";

interface AdminFiltersBarProps {
  date: Date;
  coach: string;
  level: string;
  type: string;
  locationSearch: string;
  channel: string;
  onDateChange: (date: Date) => void;
  onCoachChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onLocationSearchChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onReset: () => void;
  coaches: string[];
  levels: string[];
  types: string[];
  channels: { id: string; name: string }[];
}

export function AdminFiltersBar({
  date,
  coach,
  level,
  type,
  locationSearch,
  channel,
  onDateChange,
  onCoachChange,
  onLevelChange,
  onTypeChange,
  onLocationSearchChange,
  onChannelChange,
  onReset,
  coaches,
  levels,
  types,
  channels,
}: AdminFiltersBarProps) {
  const hasActiveFilters =
    coach !== "all" ||
    level !== "all" ||
    type !== "all" ||
    channel !== "all" ||
    locationSearch.trim() !== "";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <DatePicker date={date} onDateChange={onDateChange} />

      <Select value={coach} onValueChange={onCoachChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Все тренеры" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все тренеры</SelectItem>
          {coaches.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={level} onValueChange={onLevelChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Все уровни" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все уровни</SelectItem>
          {levels.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Все типы" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все типы</SelectItem>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Поиск по месту"
        value={locationSearch}
        onChange={(e) => onLocationSearchChange(e.target.value)}
        className="w-[180px]"
      />

      <Select value={channel} onValueChange={onChannelChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Все клубы" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все клубы</SelectItem>
          {channels.map((ch) => (
            <SelectItem key={ch.id} value={ch.id}>
              {ch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
