# NearShop Campaign Center — Integrated Patch

## Files to replace/add

1. Replace `src/features/admin/Admin.jsx` with the included file.
2. Add `src/features/admin/CampaignAdmin.jsx`.
3. Add/run `supabase/migrations/20261119_admin_campaign_center.sql` in Supabase SQL Editor.

The supplied `Admin.jsx` is the exact file from your uploaded project ZIP, with only the Campaign Center import, tab entry, and render condition added. Existing admin tabs and handlers are retained.

## Before running SQL

The migration calls `public.nearshop_admin_ok(text)`. Your uploaded project contains this helper in `supabase/migrations/20261116_admin_ads.sql`. Make sure that migration has already been run successfully in this Supabase project before running the Campaign Center migration.

## Important current limitations

- This patch adds the Campaign Center management screen inside Admin Panel.
- Push notification sending is NOT activated by this patch. Firebase Cloud Messaging, device-token registration, and a secure server-side sender/Edge Function are still required.
- Campaign audience options are saved, but actual audience filtering and customer-side campaign rendering are NOT wired by this patch. Do not assume city/category/selected-user targeting is live yet.
- Official Store product fields are campaign display snapshots only. This patch does not create orders, accept payments, reserve stock, or deduct inventory.
- Feature discounts/coupons are stored as campaign details only. They are NOT enforced by checkout yet.
- Do not expose `live_admin_campaigns()` in the customer app until audience filtering and the customer-facing campaign placement are implemented and verified.

## Installation order

1. Confirm the existing `20261116_admin_ads.sql` migration is already applied.
2. Replace/add the two JSX files at the exact paths above.
3. Run `20261119_admin_campaign_center.sql` in Supabase SQL Editor.
4. Build and test the app, then open Admin Panel and select the new `campaigns` tab.

This patch does not modify GitHub or Supabase automatically.
