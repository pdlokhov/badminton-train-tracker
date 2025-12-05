import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnalytics } from "@/hooks/useAnalytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const isMobile = useIsMobile();
  const { trackEvent } = useAnalytics();
  const hasTrackedView = useRef(false);

  const getPlatform = () => {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return "ios";
    if (/Android/.test(navigator.userAgent)) return "android";
    return "other";
  };

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedTime = localStorage.getItem("pwa-install-dismissed-time");
    
    // Show again after 7 days
    if (dismissed && dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) return;

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // For Android/Chrome - listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner with delay
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // For iOS - show instructions after delay
    if (iOS && isMobile) {
      setTimeout(() => setIsVisible(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [isMobile]);

  // Track banner view once when it becomes visible
  useEffect(() => {
    if (isVisible && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackEvent("pwa_banner_view", { platform: getPlatform() });
    }
  }, [isVisible, trackEvent]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        trackEvent("pwa_install", { platform: "android" });
        setIsVisible(false);
      } else {
        trackEvent("pwa_install_cancelled", { platform: "android" });
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    trackEvent("pwa_banner_dismiss", { platform: getPlatform() });
    localStorage.setItem("pwa-install-dismissed", "true");
    localStorage.setItem("pwa-install-dismissed-time", Date.now().toString());
    setIsVisible(false);
  };

  // Track iOS "Got it" as potential install intent
  const handleIOSConfirm = () => {
    trackEvent("pwa_ios_instructions_viewed", { platform: "ios" });
    localStorage.setItem("pwa-install-dismissed", "true");
    localStorage.setItem("pwa-install-dismissed-time", Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || !isMobile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-4 mb-4 rounded-xl border border-border bg-card p-4 shadow-lg md:mx-auto md:max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                Установите приложение
              </h3>
              {isIOS ? (
                <p className="text-sm text-muted-foreground">
                  Нажмите <Share className="inline h-4 w-4 mx-1" /> внизу экрана, затем «На экран Домой»
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Добавьте на главный экран для быстрого доступа к расписанию
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isIOS && deferredPrompt && (
            <Button onClick={handleInstall} size="sm">
              Установить
            </Button>
          )}
          <Button 
            onClick={isIOS ? handleIOSConfirm : handleDismiss} 
            variant="outline" 
            size="sm"
          >
            {isIOS ? "Понятно" : "Не сейчас"}
          </Button>
        </div>
      </div>
    </div>
  );
}
