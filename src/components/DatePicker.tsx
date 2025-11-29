import { format, addDays, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

export function DatePicker({ date, onDateChange }: DatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  const isTomorrow = format(date, "yyyy-MM-dd") === format(addDays(today, 1), "yyyy-MM-dd");
  
  const getDateLabel = () => {
    if (isToday) return "Сегодня";
    if (isTomorrow) return "Завтра";
    return format(date, "d MMMM", { locale: ru });
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onDateChange(subDays(date, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "gap-2 text-base font-semibold",
              isToday && "text-primary"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {getDateLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            initialFocus
            locale={ru}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onDateChange(addDays(date, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
