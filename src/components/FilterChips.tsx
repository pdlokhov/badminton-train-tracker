import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface FilterChip {
  id: string;
  label: string;
  active?: boolean;
  hasDropdown?: boolean;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onChipClick: (chipId: string) => void;
}

export function FilterChips({ chips, onChipClick }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChipClick(chip.id)}
          className={cn(
            "flex items-center gap-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            chip.active
              ? "bg-foreground text-background"
              : "bg-card border border-border text-foreground hover:bg-muted"
          )}
        >
          {chip.label}
          {chip.hasDropdown && <ChevronDown className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}
