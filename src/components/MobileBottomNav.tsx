import { Calendar, Map, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const navItems: NavItem[] = [
  { id: "schedule", label: "Расписание", icon: <Calendar className="h-6 w-6" /> },
  { id: "map", label: "Карта", icon: <Map className="h-6 w-6" /> },
  { id: "favorites", label: "Избранное", icon: <Heart className="h-6 w-6" /> },
  { id: "profile", label: "Профиль", icon: <User className="h-6 w-6" /> },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
              activeTab === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
