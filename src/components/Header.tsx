import { Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { isAdmin } = useAuth();

  const handleContactDeveloper = () => {
    window.open("https://t.me/your_developer_username", "_blank");
  };

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
          <Button variant="ghost" size="sm" onClick={handleContactDeveloper}>
            <MessageCircle className="h-5 w-5 mr-2" />
            Связаться
          </Button>
        )}
      </div>
    </header>
  );
}
