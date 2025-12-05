/**
 * Detects if app is running as PWA in standalone mode
 */
export const isPWAStandalone = (): boolean => {
  // iOS standalone check
  const isIOSStandalone = 'standalone' in window.navigator && 
    (window.navigator as any).standalone === true;
  
  // Android/other standalone check
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  
  return isIOSStandalone || isStandaloneMedia;
};

/**
 * Converts Telegram web URL to tg:// deep link scheme
 */
const convertToTelegramDeepLink = (url: string): string | null => {
  // Match t.me URLs: https://t.me/channel, https://t.me/channel/123
  const telegramMatch = url.match(/https?:\/\/t\.me\/([^\/]+)(?:\/(\d+))?/);
  
  if (telegramMatch) {
    const domain = telegramMatch[1];
    const post = telegramMatch[2];
    
    // tg://resolve?domain=channel&post=123
    return post 
      ? `tg://resolve?domain=${domain}&post=${post}`
      : `tg://resolve?domain=${domain}`;
  }
  
  return null;
};

/**
 * Opens external URL with PWA-aware handling
 * - In PWA mode: uses tg:// scheme for Telegram links (opens app directly)
 * - In browser mode: uses standard window.open
 */
export const openExternalUrl = (url: string): void => {
  if (isPWAStandalone()) {
    // Try to convert Telegram URLs to deep links
    const telegramDeepLink = convertToTelegramDeepLink(url);
    
    if (telegramDeepLink) {
      // Open Telegram app directly via deep link
      window.location.href = telegramDeepLink;
      return;
    }
    
    // For non-Telegram URLs in PWA, use location.href to avoid blank screen on iOS
    window.location.href = url;
  } else {
    // Standard browser behavior
    window.open(url, "_blank");
  }
};
