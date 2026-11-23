# Campaign Part 1 — setup

## 1. Supabase SQL
Run `supabase/migrations/20261124_campaign_part1_audience_push_analytics.sql` (after 20261119, 20261121_campaign_fix, 20261123).

## 2. Firebase push (one time)
1. Firebase console -> project -> Project settings -> General -> add a **Web app** -> copy config values.
2. Cloud Messaging tab -> Web configuration -> **Generate key pair** (VAPID key).
3. Project settings -> Service accounts -> **Generate new private key** (JSON file).
4. Vercel -> Project -> Settings -> Environment Variables (then Redeploy):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`.
5. Supabase -> Edge Functions -> create function `send-campaign-push`, paste `supabase/functions/send-campaign-push/index.ts`, deploy.
   Secrets: `FCM_SERVICE_ACCOUNT` = the whole service-account JSON (never put it in the app / GitHub).
6. Admin -> Campaigns -> Publish -> history card -> **Push bhejein**.
Customers see "Notification chalu karein" on Home; iPhone needs the app added to Home Screen.

## 3. Audience rules (server side)
all / customers (no shop, no staff) / shopkeepers / category (owner or staff shop category, or follows a shop of it) /
city + state (shop location or the app-detected nearest city/state) / selected (phone or @username list).

## 4. WhatsApp Business API — architecture (not sending yet)
- Needs: Meta Business account, verified business, WhatsApp Cloud API number, **approved message templates** (marketing messages cost per conversation).
- Consent: `set_whatsapp_optin(phone, true)` stores opt-in in `whatsapp_optins`. Only opted-in users may be messaged.
- Flow: admin picks campaign -> Edge Function reads opted-in users matching audience -> inserts rows into `whatsapp_outbox` (queued) -> worker calls Cloud API with template -> Meta webhook updates status (sent/delivered/read/failed).
- Secrets (WA token, phone-number id) live only in Edge Function secrets. Tables have no client access.
- Still to build when you have the Meta account: opt-in UI, sender function, webhook function.

## 5. Not included (needs an Orders module first)
Stock deduction on order, coupon/discount validation at checkout, revenue. `record_campaign_conversion()` is ready for the future order flow; analytics already shows orders/revenue columns (0 until then).
