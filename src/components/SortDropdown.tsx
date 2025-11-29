import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortOption = "time" | "price" | "type";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortLabels: Record<SortOption, string> = {
  time: "По времени",
  price: "По цене",
  type: "По типу",
};

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          {sortLabels[value]}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortOption)}>
          <DropdownMenuRadioItem value="time">По времени</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="price">По цене</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="type">По типу</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
