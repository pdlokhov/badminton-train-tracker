import { Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
          СПБ
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Button variant="ghost" size="icon" onClick={onMenuClick}>
            <Menu className="h-6 w-6" />
          </Button>
        ) : (
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <User className="h-6 w-6" />
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
