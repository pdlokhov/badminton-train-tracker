const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const VAPID_PUBLIC_KEY_STORAGE = "vapid_public_key";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!("PushManager" in window)) {
      console.log("[Push] PushManager not supported");
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("[Push] Service Worker not supported");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[Push] Notification permission denied");
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Fetch VAPID public key from edge function
    let vapidKey = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE);
    if (!vapidKey) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/push-subscribe`, {
        method: "GET",
      });
      if (!res.ok) {
        console.error("[Push] Failed to get VAPID key");
        return false;
      }
      const data = await res.json();
      vapidKey = data.vapid_public_key;
      if (vapidKey) {
        localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE, vapidKey);
      }
    }

    if (!vapidKey) {
      console.error("[Push] No VAPID public key available");
      return false;
    }

    const pm = (registration as any).pushManager;

    // Check existing subscription
    let subscription = await pm.getSubscription();
    if (!subscription) {
      subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Send subscription to backend
    const visitorId = localStorage.getItem("analytics_visitor_id") || null;
    const subJson = subscription.toJSON();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/push-subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        visitor_id: visitorId,
      }),
    });

    if (!response.ok) {
      console.error("[Push] Failed to save subscription");
      return false;
    }

    console.log("[Push] Successfully subscribed");
    return true;
  } catch (error) {
    console.error("[Push] Subscription error:", error);
    return false;
  }
}

export function isPushSupported(): boolean {
  return "PushManager" in window && "serviceWorker" in navigator && "Notification" in window;
}

export function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}
