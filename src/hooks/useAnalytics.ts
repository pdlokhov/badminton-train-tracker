import { useCallback, useEffect, useRef } from "react";
import { sendEvent, debounce, hasAnalyticsConsent, isPWAStandalone, getPWAPlatform } from "@/lib/analytics";

export function useAnalytics() {
  const hasTrackedPageView = useRef(false);
  const hasTrackedPwaSession = useRef(false);

  // Track page view (only once per mount)
  const trackPageView = useCallback(() => {
    if (!hasTrackedPageView.current && hasAnalyticsConsent()) {
      hasTrackedPageView.current = true;
      sendEvent("page_view", {
        url: window.location.href,
        title: document.title,
      });
    }
  }, []);

  // Track generic event
  const trackEvent = useCallback(
    (eventType: string, eventData: Record<string, unknown> = {}) => {
      sendEvent(eventType, eventData);
    },
    []
  );

  // Track training click
  const trackTrainingClick = useCallback(
    (trainingId: string, trainingData: Record<string, unknown> = {}) => {
      sendEvent("training_click", {
        training_id: trainingId,
        ...trainingData,
      });
    },
    []
  );

  // Track Telegram redirect
  const trackTelegramRedirect = useCallback(
    (trainingId: string, channelName: string, trainingType?: string) => {
      sendEvent("telegram_redirect", {
        training_id: trainingId,
        channel_name: channelName,
        training_type: trainingType,
      });
    },
    []
  );

  // Track search with debounce
  const trackSearchDebounced = useRef(
    debounce((query: string) => {
      if (query.trim().length >= 2) {
        sendEvent("search", { query: query.trim() });
      }
    }, 1000)
  );

  const trackSearch = useCallback((query: string) => {
    trackSearchDebounced.current(query);
  }, []);

  // Track date change
  const trackDateChange = useCallback((date: string) => {
    sendEvent("date_change", { date });
  }, []);

  // Track filter apply
  const trackFilterApply = useCallback(
    (filterType: string, filterValue: string) => {
      sendEvent("filter_apply", {
        filter_type: filterType,
        filter_value: filterValue,
      });
    },
    []
  );

  // Track session start and PWA session on mount
  useEffect(() => {
    if (hasAnalyticsConsent()) {
      const sessionStarted = sessionStorage.getItem("session_start_tracked");
      if (!sessionStarted) {
        sendEvent("session_start", {
          referrer: document.referrer,
          landing_page: window.location.pathname,
        });
        sessionStorage.setItem("session_start_tracked", "true");
      }

      // Track PWA session start (only once per session)
      if (!hasTrackedPwaSession.current && isPWAStandalone()) {
        hasTrackedPwaSession.current = true;
        const pwaSessionTracked = sessionStorage.getItem("pwa_session_tracked");
        if (!pwaSessionTracked) {
          sendEvent("pwa_session_start", {
            platform: getPWAPlatform(),
          });
          sessionStorage.setItem("pwa_session_tracked", "true");
        }
      }
    }
  }, []);

  return {
    trackPageView,
    trackEvent,
    trackTrainingClick,
    trackTelegramRedirect,
    trackSearch,
    trackDateChange,
    trackFilterApply,
  };
}
