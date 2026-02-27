

# Plan: Auto-sync external API channels + Webhook endpoint

## Current State
- `parse-channels` runs daily at 23:59 UTC via cron, but does NOT handle `external_api` channels -- it only processes `telegram_text` and `telegram_images` modes
- `external-api-sync` exists as a separate function but is only called manually
- No webhook exists for receiving real-time pushes from data sources

## Changes

### 1. Add external_api channels to `parse-channels` cron cycle

**File: `supabase/functions/parse-channels/index.ts`**

In the main channel processing loop, add a check for `parse_mode === 'external_api'` before the existing `parse_images` / `use_ai_text_parsing` / text branches. When detected:
- Read `external_api_config` from the channel record
- Call the same logic as `external-api-sync` (fetch from endpoint, map, delete old + insert new)
- Skip the Telegram scraping path entirely

This way the daily cron (and manual single-channel runs) automatically handles external API channels alongside Telegram ones.

The `Channel` interface in `parse-channels` will need the `parse_mode` and `external_api_config` fields added.

### 2. Create webhook endpoint for real-time updates

**New file: `supabase/functions/external-api-webhook/index.ts`**

A new edge function that accepts POST requests from the external data source with training updates in real-time. It will:

- Accept JSON payload (single training or array of trainings)
- Authenticate via `x-api-key` header matched against the channel's `external_api_config.api_key`
- Look up the channel by API key
- Map incoming data using the same `mapToTraining` / `parseTypeFromCode` / `parseLevelFromTitle` logic
- Upsert trainings to the database (update existing, add new)
- Return success/error response

**File: `supabase/config.toml`** -- add `[functions.external-api-webhook]` with `verify_jwt = false`

### 3. Update cron frequency (optional)

The current daily 23:59 cron is sufficient since the webhook handles real-time updates. No cron changes needed unless you want more frequent full re-syncs.

## Technical Details

### parse-channels update (step 1)
```text
Channel interface additions:
  + parse_mode: string | null
  + external_api_config: any
  + permanent_signup_url_game: string | null  (if not present)
  + permanent_signup_url_group: string | null  (if not present)

In the channel loop, add before existing branches:
  if (channel.parse_mode === 'external_api') {
    // Reuse external-api-sync logic inline
    // Fetch from config.endpoint_url, map, delete old extapi: trainings, insert new
    continue
  }
```

### Webhook endpoint (step 2)
- Endpoint: `POST /functions/v1/external-api-webhook`
- Auth: `x-api-key` header matched to channel config
- Body: `{ trainings: [...] }` or `[...]` (array of training objects)
- Each training: `{ date, time_start, time_end, title, coach, price, spots, spots_available, signup_url, ... }`
- Response: `{ success: true, upserted: N }`
- Uses upsert on `channel_id,date,time_start,message_id` conflict

The `mapToTraining`, `parseTypeFromCode`, `parseLevelFromTitle` functions will be duplicated in this function (since edge functions can't share code across files).

