NEARSHOP CAMPAIGN AUDIT FIX — INSTALL GUIDE

This is a PATCH ZIP. Keep the folder paths exactly as shown.

REPLACE THESE EXISTING FILES:
1. src/App.jsx
2. src/features/admin/CampaignAdmin.jsx
3. src/features/admin/CampaignFeed.jsx
4. src/features/product/ProductDetail.jsx
5. src/features/orders/OrderSheet.jsx
6. public/sw.js
7. docs/CAMPAIGN_SETUP.md
8. DATABASE_MIGRATION_ORDER.md

CREATE THESE NEW FILES:
9. supabase/functions/send-campaign-push/index.ts
10. supabase/functions/send-order-push/index.ts
11. supabase/migrations/20261127_campaign_order_security.sql

IMPORTANT:
- Do not replace Admin.jsx. The existing Campaigns tab integration is preserved.
- The old malformed folder `supabase/functions/send-order-pushndex.ts/` is not used by this patch. The correct deployed function path is `supabase/functions/send-order-push/index.ts`.
- Keep the Firebase service-account JSON private. Do not upload it to GitHub or put it in a VITE_ variable.
- Vercel holds only the public Firebase Web App config and VAPID public key.
- `FCM_SERVICE_ACCOUNT` must be stored in Supabase Dashboard → Edge Functions → Secrets.

DATABASE:
If the earlier campaign/order migrations are already applied, do not run them again. Run only missing migrations in the order shown in DATABASE_MIGRATION_ORDER.md. The new migration in this patch is 20261127 and must run after 20261124, 20261125 and 20261126.

EDGE FUNCTIONS:
Deploy these two Supabase Edge Functions:
- send-campaign-push
- send-order-push

With Supabase CLI from the repository root:
  supabase functions deploy send-campaign-push
  supabase functions deploy send-order-push

After the files, SQL and Edge Functions are deployed:
1. Redeploy the Vercel app.
2. Sign in to NearShop on Android Chrome.
3. Open Feed or Deals and allow notifications using "Chalu karein".
4. Admin publishes a campaign with Push enabled, then taps "Push bhejein" in campaign history.

WHAT THIS PATCH FIXES:
- Campaign product button now opens the exact shop/product inside App.
- Push notification campaign link can reopen the app at its linked product.
- Campaign push Edge Function is added.
- Order push Edge Function is placed at the correct Supabase function path.
- Order push is marked sent only after FCM accepts at least one token.
- Previously granted browser notification permission re-registers the current user's device token.
- Campaign audience wording and setup instructions are corrected.
- Order/device RPC execution grants are hardened.

NOT INCLUDED / STILL FUTURE:
- WhatsApp Business message sending.
- Paid-feature discount application inside the paid plan checkout.
- Online payment gateway.
- NearShop Official Store's separate seller/order/fulfilment identity. The campaign can link to an existing shop product.
- Live Supabase execution and live Firebase delivery verification. Those require your deployed project credentials and real test accounts.
