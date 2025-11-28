import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Footer = () => {
  const { isAdmin, signOut } = useAuth();

  return (
    <footer className="border-t bg-muted/30 py-4 mt-8">
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Расписание тренировок
        </p>
        <div className="flex items-center gap-4">
          {isAdmin ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          ) : (
            <Link 
              to="/admin" 
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              •
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
};
