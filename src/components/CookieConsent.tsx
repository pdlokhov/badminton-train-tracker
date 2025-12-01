import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getConsentStatus, setAnalyticsConsent } from "@/lib/analytics";
import { X } from "lucide-react";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const status = getConsentStatus();
    if (status === "pending") {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    setAnalyticsConsent("all");
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    setAnalyticsConsent("necessary");
    setIsVisible(false);
  };

  const handleClose = () => {
    setAnalyticsConsent("necessary");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-4 mb-4 rounded-xl border border-border bg-card p-4 shadow-lg md:mx-auto md:max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              Мы используем cookies
            </h3>
            <p className="text-sm text-muted-foreground">
              Мы собираем анонимную статистику посещений для улучшения сервиса. 
              Данные не передаются третьим лицам.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleAcceptAll} size="sm">
            Принять все
          </Button>
          <Button onClick={handleAcceptNecessary} variant="outline" size="sm">
            Только необходимые
          </Button>
        </div>
      </div>
    </div>
  );
}
