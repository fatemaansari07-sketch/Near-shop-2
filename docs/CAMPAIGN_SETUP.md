# NearShop Campaign + Push + Orders Setup

## A. Database migrations

Run these in Supabase SQL Editor in this exact order, only if they have not already been applied:

1. `supabase/migrations/20261119_admin_campaign_center.sql`
2. `supabase/migrations/20261121_campaign_fix.sql`
3. `supabase/migrations/20261123_campaign_delivery_security.sql`
4. `supabase/migrations/20261124_campaign_part1_audience_push_analytics.sql`
5. `supabase/migrations/20261125_orders_stock_coupons.sql`
6. `supabase/migrations/20261126_order_push.sql`
7. `supabase/migrations/20261127_campaign_order_security.sql` (new hardening + order-push retry fix)

Do not re-run older migrations just because this document lists them. If a migration is already applied, skip it. The new `20261127` migration should be run once after the earlier six.

## B. Firebase web configuration in Vercel

In Vercel Project → Settings → Environment Variables, add the Firebase **Web App config** and Web Push VAPID public key:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

Use the Firebase Console Web App config and Cloud Messaging → Web Push certificates → Generate key pair. Redeploy Vercel after changing these variables.

These `VITE_` values are public browser configuration. Never put a Firebase service-account private key in a `VITE_` variable.

## C. Firebase service-account secret (server only)

The Firebase service-account JSON private key is **not** a Vercel frontend variable and must never be committed to GitHub.

In Supabase Dashboard → Edge Functions → Secrets, add:

- Name: `FCM_SERVICE_ACCOUNT`
- Value: the complete Firebase service-account JSON (one-line JSON is easiest)

The service account must belong to the same Firebase project used by the Vercel web config and have permission to send Firebase Cloud Messaging messages.

## D. Deploy Supabase Edge Functions

Deploy both functions from these exact repository paths:

- `supabase/functions/send-campaign-push/index.ts` → function name `send-campaign-push`
- `supabase/functions/send-order-push/index.ts` → function name `send-order-push`

With Supabase CLI, from the repository root:

```bash
supabase functions deploy send-campaign-push
supabase functions deploy send-order-push
```

The app calls these function names directly. A function stored under a different folder name will not be found by `supabase.functions.invoke()`.

## E. How push delivery works

1. User opens NearShop while logged in.
2. User taps **Chalu karein** and allows browser notifications.
3. The app registers the Firebase device token through `register_device_token`.
4. Admin publishes a campaign, then opens its history card and taps **Push bhejein**.
5. The Edge Function validates the admin password, checks campaign status/date/channel, resolves the audience on the server, and sends through FCM.
6. Campaign notification click opens its linked NearShop product when a real product is attached; otherwise it opens the campaign URL.

A user who has not enabled browser notifications or has no valid device token cannot receive a push. Android Chrome is the primary web-Push test target. iPhone web push has additional Home Screen installation requirements.

## F. Campaign and order behaviour

- In-app campaigns appear in Feed, Deals and the Deals notification panel.
- Audience filtering is server-side: all, customers, shopkeepers, category, city, state and selected users.
- City/state matching depends on a user's audience profile or a shop location. The app updates the profile when it has a resolved location.
- A real product must be attached through **Real NearShop product jodein** for the campaign button to open that shop's live product and use its current price/stock.
- Campaign display-only product name/price/stock fields are snapshots, not inventory.
- Product orders use server-side `quote_order` / `place_order`; the shop deducts stock when it confirms the order. Cancellation/rejection restores deducted stock.
- Product coupon/campaign discounts are validated server-side. Paid-feature (`feature_offer`) discounts are still not connected to the paid plan checkout.
- Orders are pay-at-shop/pickup in this implementation; there is no online payment gateway here.
- WhatsApp Business API sending is not implemented. The current WhatsApp tables are preparation only.

## G. Quick test

1. Sign in with a normal customer account on the deployed HTTPS app.
2. Open Feed or Deals and tap **Chalu karein**.
3. Check that `public.user_devices` receives a row for the signed-in user (do not expose token values publicly).
4. As admin, publish an `all` audience campaign with Push enabled.
5. Tap **Push bhejein** in campaign history.
6. Confirm the device receives the notification and tapping it opens the campaign.
7. Attach a real product to a campaign and verify its button opens that exact product.
8. Place a product order, confirm it from the shop dashboard, and verify stock changes only on confirmation.

If a push fails, check the Edge Function logs first, then verify the Vercel web config, Supabase `FCM_SERVICE_ACCOUNT` secret, Firebase project match, VAPID key and device token registration.
