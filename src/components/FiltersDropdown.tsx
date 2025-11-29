import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FiltersDropdownProps {
  coaches: string[];
  levels: string[];
  types: string[];
  channels: { id: string; name: string }[];
  selectedCoach: string;
  selectedLevel: string;
  selectedType: string;
  selectedChannel: string;
  onCoachChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onChannelChange: (value: string) => void;
}

export function FiltersDropdown({
  coaches,
  levels,
  types,
  channels,
  selectedCoach,
  selectedLevel,
  selectedType,
  selectedChannel,
  onCoachChange,
  onLevelChange,
  onTypeChange,
  onChannelChange,
}: FiltersDropdownProps) {
  const hasActiveFilters =
    selectedCoach !== "all" ||
    selectedLevel !== "all" ||
    selectedType !== "all" ||
    selectedChannel !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`h-12 gap-2 rounded-xl px-4 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
        >
          Фильтры
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover">
        {types.length > 0 && (
          <>
            <DropdownMenuLabel>Тип тренировки</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedType === "all"}
              onCheckedChange={() => onTypeChange("all")}
            >
              Все типы
            </DropdownMenuCheckboxItem>
            {types.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedType === type}
                onCheckedChange={() => onTypeChange(type)}
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {levels.length > 0 && (
          <>
            <DropdownMenuLabel>Уровень</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedLevel === "all"}
              onCheckedChange={() => onLevelChange("all")}
            >
              Все уровни
            </DropdownMenuCheckboxItem>
            {levels.map((level) => (
              <DropdownMenuCheckboxItem
                key={level}
                checked={selectedLevel === level}
                onCheckedChange={() => onLevelChange(level)}
              >
                {level}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {coaches.length > 0 && (
          <>
            <DropdownMenuLabel>Тренер</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedCoach === "all"}
              onCheckedChange={() => onCoachChange("all")}
            >
              Все тренеры
            </DropdownMenuCheckboxItem>
            {coaches.map((coach) => (
              <DropdownMenuCheckboxItem
                key={coach}
                checked={selectedCoach === coach}
                onCheckedChange={() => onCoachChange(coach)}
              >
                {coach}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {channels.length > 0 && (
          <>
            <DropdownMenuLabel>Клуб</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedChannel === "all"}
              onCheckedChange={() => onChannelChange("all")}
            >
              Все клубы
            </DropdownMenuCheckboxItem>
            {channels.map((channel) => (
              <DropdownMenuCheckboxItem
                key={channel.id}
                checked={selectedChannel === channel.id}
                onCheckedChange={() => onChannelChange(channel.id)}
              >
                {channel.name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
