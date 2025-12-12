const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const VISITOR_ID_KEY = "analytics_visitor_id";
const SESSION_ID_KEY = "analytics_session_id";
const SESSION_START_KEY = "analytics_session_start";
const FIRST_VISIT_KEY = "analytics_first_visit";
const ANALYTICS_CONSENT_KEY = "analytics_consent";

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Get or create visitor ID
export function getOrCreateVisitorId(): string {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
    localStorage.setItem(FIRST_VISIT_KEY, new Date().toISOString());
  }
  return visitorId;
}

// Get or create session ID (expires after 30 min of inactivity)
export function getOrCreateSessionId(): string {
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  const sessionStart = sessionStorage.getItem(SESSION_START_KEY);
  const now = Date.now();
  
  if (!sessionId || !sessionStart || now - parseInt(sessionStart) > SESSION_TIMEOUT) {
    sessionId = generateId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
  } else {
    // Update session activity
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
  }
  
  return sessionId;
}

// Get device type
export function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

// Check if running as PWA (standalone mode)
export function isPWAStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

// Get PWA platform
export function getPWAPlatform(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// Check analytics consent
export function hasAnalyticsConsent(): boolean {
  const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return consent === "true" || consent === "all";
}

// Set analytics consent
export function setAnalyticsConsent(value: boolean | "all" | "necessary"): void {
  if (value === true || value === "all") {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "true");
  } else {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "false");
  }
}

// Get consent status
export function getConsentStatus(): "pending" | "accepted" | "rejected" {
  const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (consent === null) return "pending";
  return consent === "true" || consent === "all" ? "accepted" : "rejected";
}

// Check if first visit
export function isFirstVisit(): boolean {
  return !localStorage.getItem(FIRST_VISIT_KEY);
}

// Send event via edge function
export async function sendEvent(
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<void> {
  if (!hasAnalyticsConsent()) {
    return;
  }

  try {
    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    const deviceType = getDeviceType();
    const isPwa = isPWAStandalone();

    await fetch(`${SUPABASE_URL}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        event_type: eventType,
        event_data: {
          ...eventData,
          is_pwa: isPwa,
        },
        page_path: window.location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        device_type: deviceType,
      }),
    });
  } catch (error) {
    console.error("Analytics error:", error);
  }
}

// Debounce helper
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}
