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
    // Debug logging
    console.log('[PWA Debug] Component mounted');
    console.log('[PWA Debug] User Agent:', navigator.userAgent);
    console.log('[PWA Debug] isMobile:', isMobile);
    console.log('[PWA Debug] Platform:', getPlatform());
    
    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedTime = localStorage.getItem("pwa-install-dismissed-time");
    console.log('[PWA Debug] Dismissed status:', { dismissed, dismissedTime });
    
    // Show again after 7 days
    if (dismissed && dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      console.log('[PWA Debug] Days since dismissed:', daysSinceDismissed);
      if (daysSinceDismissed < 7) {
        console.log('[PWA Debug] Skipping - dismissed less than 7 days ago');
        return;
      }
    }

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    console.log('[PWA Debug] Standalone mode:', isStandalone);
    
    if (isStandalone) {
      console.log('[PWA Debug] Skipping - already installed (standalone)');
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    console.log('[PWA Debug] iOS detected:', iOS);

    // For Android/Chrome - listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      console.log('[PWA Debug] 🎉 beforeinstallprompt event fired!');
      console.log('[PWA Debug] Event type:', e.type);
      console.log('[PWA Debug] Event:', e);
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('[PWA Debug] Deferred prompt saved, will show banner in 3s');
      // Show banner with delay
      setTimeout(() => {
        console.log('[PWA Debug] Showing banner now');
        setIsVisible(true);
      }, 3000);
    };

    console.log('[PWA Debug] Adding beforeinstallprompt listener');
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Also log if event was already fired before we added listener
    console.log('[PWA Debug] Checking if beforeinstallprompt is supported...');

    // For iOS - show instructions after delay
    if (iOS && isMobile) {
      console.log('[PWA Debug] iOS mobile - will show instructions in 3s');
      setTimeout(() => setIsVisible(true), 3000);
    }

    return () => {
      console.log('[PWA Debug] Removing beforeinstallprompt listener');
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
    console.log('[PWA Debug] Install button clicked');
    console.log('[PWA Debug] Deferred prompt available:', !!deferredPrompt);
    
    if (deferredPrompt) {
      try {
        console.log('[PWA Debug] Calling prompt()...');
        await deferredPrompt.prompt();
        console.log('[PWA Debug] prompt() called, waiting for userChoice...');
        
        const choiceResult = await deferredPrompt.userChoice;
        console.log('[PWA Debug] userChoice result:', choiceResult);
        console.log('[PWA Debug] Outcome:', choiceResult.outcome);
        
        if (choiceResult.outcome === "accepted") {
          console.log('[PWA Debug] ✅ User ACCEPTED installation');
          trackEvent("pwa_install", { platform: "android" });
          setIsVisible(false);
        } else {
          console.log('[PWA Debug] ❌ User DISMISSED installation');
          trackEvent("pwa_install_cancelled", { platform: "android" });
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('[PWA Debug] Error during install:', error);
        trackEvent("pwa_install_error", { platform: "android", error: String(error) });
      }
    } else {
      console.log('[PWA Debug] No deferred prompt available!');
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
