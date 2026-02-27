

# Plan: Last Minute Discounts + Push Notifications for PWA

## Overview
Two parts: (1) store and display "last minute" discount offers on training cards, (2) send Web Push notifications to PWA users when a discount appears.

---

## Part 1: Database -- Add discount columns

New columns on `trainings` table:
- `discount_percent` (integer, nullable)
- `original_price` (numeric, nullable)
- `discounted_price` (numeric, nullable)
- `discount_expires_at` (timestamptz, nullable)

New table `push_subscriptions` for storing PWA push subscriptions:
- `id` (uuid, PK, default gen_random_uuid())
- `endpoint` (text, unique, not null)
- `p256dh` (text, not null)
- `auth` (text, not null)
- `visitor_id` (text, nullable) -- to link with analytics visitor
- `created_at` (timestamptz, default now())

RLS: public INSERT (anyone can subscribe), no SELECT/UPDATE/DELETE for anon.

---

## Part 2: Webhook -- Handle `discount.created` event

**File: `supabase/functions/external-api-webhook/index.ts`**

Add event-based routing before the existing flow:

```text
if body.event === "discount.created":
  For each item in body.trainings:
    1. Find training by message_id containing item.session_id or item.id
    2. UPDATE trainings SET discount_percent, original_price, discounted_price, discount_expires_at
    3. If is_active === false, clear discount fields (set to null)
  After updates, send push notifications to all subscribers
  Return { success, updated }
else:
  Existing upsert flow (unchanged)
```

---

## Part 3: Web Push Notifications

### 3a. Generate VAPID keys (secret)

Need to store `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as backend secrets. These are generated once and stored permanently.

A new edge function `generate-vapid-keys` will be created (or keys generated manually) and stored via the secrets tool.

### 3b. New edge function: `push-subscribe`

**File: `supabase/functions/push-subscribe/index.ts`**

- Accepts POST with `{ endpoint, keys: { p256dh, auth }, visitor_id }`
- Stores subscription in `push_subscriptions` table
- `verify_jwt = false` (public endpoint)

### 3c. Push sending in webhook

When `discount.created` is processed, after updating the trainings table:
1. Fetch all subscriptions from `push_subscriptions`
2. For each subscription, send a Web Push notification using the `web-push` protocol (RFC 8030) with VAPID auth
3. Notification content:
   - Title: "Last Minute -30%!"
   - Body: "Training_title, time, discounted_price r (was original_price r)"
   - Icon: /pwa-192x192.png
   - URL: / (opens the app)

### 3d. Client-side: Subscribe to push in PWA

**File: `src/lib/pushSubscription.ts`** (new)

- Check if Push API is available (`'PushManager' in window`)
- Check if service worker is registered
- Request notification permission
- Subscribe using VAPID public key
- Send subscription to `push-subscribe` edge function

**File: `src/components/PWAInstallPrompt.tsx`** (update)

After successful PWA install or on app load in standalone mode:
- Auto-request push permission and subscribe

---

## Part 4: UI -- Discount display on training cards

### Visual design

When a training has an active discount (discount_expires_at > now):

```text
Desktop card (TrainingCard):
+-----------------------------------+
| 18:00 - 19:30    [1800 r] 1260 r  |
|                    ^^^^           |
|                 crossed out       |
| [групповая] [E-F]  2/12          |
| [LAST MINUTE -30%]               |  <-- red badge with fire icon
| Спорткомплекс, ул. Ленина        |
| ЛБ Бадминтон                     |
+-----------------------------------+

Mobile item (MobileTrainingItem):
18:00-19:30  [1800] 1260 r   2/12
[групповая] [E-F] [LAST MINUTE -30%]
Спорткомплекс
ЛБ Бадминтон
```

- Original price: crossed out, muted color
- Discounted price: bold, red/accent color
- Badge: red background, white text, fire emoji, "-30%"
- Card gets a subtle red/orange left border or glow to stand out

### Files to update

**`src/components/TrainingCard.tsx`**
- Add props: `discountPercent`, `originalPrice`, `discountedPrice`, `discountExpiresAt`
- Price area: show crossed-out original + highlighted discount price
- Add "Last Minute" badge below type/level badges
- Add left border accent when discount is active

**`src/components/MobileTrainingItem.tsx`**
- Same discount props and display logic

**`src/components/TrainingsList.tsx`**
- Add discount fields to Training interface
- Pass discount props to TrainingCard and MobileTrainingItem
- Client-side filter: only show discount UI when `discount_expires_at > now()`

---

## Part 5: Service Worker -- Handle push events

**File: `public/sw-push.js`** or integrate into vite-plugin-pwa custom service worker

Add push event listener to show notifications:
```text
self.addEventListener('push', (event) => {
  const data = event.data.json()
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url }
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  clients.openWindow(event.notification.data.url || '/')
})
```

VitePWA config needs `injectManifest` mode or `importScripts` to include push handling.

---

## Technical Considerations

- **Web Push without npm**: The webhook edge function will implement Web Push protocol directly (ECDH + HKDF + AES-GCM encryption) using Deno's crypto APIs, or use `web-push` npm package via esm.sh
- **VAPID keys**: Need to be generated once and stored as secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
- **Realtime**: Existing realtime subscription already refreshes UI when trainings are updated, so discount changes will appear instantly for active users
- **Expired discounts**: Client-side check `discount_expires_at > new Date()` before rendering discount UI
- **Migration SQL**:
```text
ALTER TABLE trainings
  ADD COLUMN discount_percent integer,
  ADD COLUMN original_price numeric,
  ADD COLUMN discounted_price numeric,
  ADD COLUMN discount_expires_at timestamptz;

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  visitor_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can read subscriptions" ON push_subscriptions FOR SELECT USING (true);
```

## Summary of files

| Action | File |
|--------|------|
| Migration | Add discount columns + push_subscriptions table |
| Edit | `supabase/functions/external-api-webhook/index.ts` -- event routing + push sending |
| New | `supabase/functions/push-subscribe/index.ts` |
| Edit | `supabase/config.toml` -- add push-subscribe function |
| Edit | `src/components/TrainingCard.tsx` -- discount UI |
| Edit | `src/components/MobileTrainingItem.tsx` -- discount UI |
| Edit | `src/components/TrainingsList.tsx` -- pass discount props |
| New | `src/lib/pushSubscription.ts` -- push subscription helper |
| Edit | `src/components/PWAInstallPrompt.tsx` -- trigger push subscribe |
| Edit | `vite.config.ts` -- add custom SW for push events |
| Secrets | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

