# NearShop Database Migration Order

Run each migration only once unless its own comments explicitly say it is safe to re-run. If it has already been applied in Supabase, skip it.

## Existing base migrations

The project has already been using these earlier migrations:

- `20261106_nearshop_schema_reconciliation.sql`
- `20261106_nearshop_security_hardening.sql`
- `20261110_multishop_staff_plans_features.sql`
- `20261111_staff_khata_manager_dashboard.sql`
- `20261112_staff_feature_enforcement.sql`
- `20261113_feed_follow_like_comment.sql`
- `20261115_owner_staff_sales.sql`
- `20261116_admin_ads.sql`
- `20261118_shop_username_follow_khata_dashboard.sql`

Do not re-run an already-applied migration just because it appears in this list.

## Campaign Center + delivery + orders

Run the following in Supabase SQL Editor in exact order, skipping any migration already applied:

1. `supabase/migrations/20261119_admin_campaign_center.sql`
2. `supabase/migrations/20261121_campaign_fix.sql`
3. `supabase/migrations/20261123_campaign_delivery_security.sql`
4. `supabase/migrations/20261124_campaign_part1_audience_push_analytics.sql`
5. `supabase/migrations/20261125_orders_stock_coupons.sql`
6. `supabase/migrations/20261126_order_push.sql`
7. `supabase/migrations/20261127_campaign_order_security.sql` **(new patch migration)**

Important:
- `20261124` replaces the earlier live campaign function with the complete server-side audience matcher and adds product linking, analytics, device-token registration and campaign push target functions.
- `20261125` adds pay-at-shop orders, server-side product price/discount quoting and stock deduction when the shop confirms an order.
- `20261126` adds order push authorization and target resolution.
- `20261127` hardens execution grants for order/device RPCs and ensures a new-order push is marked sent only after FCM accepts a device delivery.
- If the earlier migrations were already run, do not run them again. Run only the missing migrations, especially `20261127` after its prerequisites.

## Deploy order

1. Apply missing database migrations.
2. Add the Firebase web config to Vercel and redeploy the web app.
3. Add `FCM_SERVICE_ACCOUNT` as a Supabase Edge Function secret (not a Vercel `VITE_` variable and not in GitHub).
4. Deploy `send-campaign-push` and `send-order-push` Edge Functions.
5. Deploy the updated frontend from GitHub/Vercel.

See `docs/CAMPAIGN_SETUP.md` for the Firebase and push test steps.
