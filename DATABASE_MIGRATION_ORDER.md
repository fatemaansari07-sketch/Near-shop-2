# Database migration order
Already run (do NOT re-run): `20261106_nearshop_schema_reconciliation.sql`, `20261106_nearshop_security_hardening.sql`.

Run now, once, in Supabase SQL Editor:
1. `supabase/migrations/20261110_multishop_staff_plans_features.sql`

Idempotent (safe to re-run). It adds: shop profile columns, `features`/`plans` rows in platform_settings (+ admin RPC),
owner_subscriptions, shop_staff (+ RPCs), plan shop-limit trigger, feature-flag triggers, `owner_business_overview` RPC,
and replaces `complete_sale` (adds `p_request_id`, SECURITY DEFINER + permission check) and `void_sale`.

Deploy order: run the SQL FIRST, then push the code (new SellFlow sends `p_request_id`, which the old DB function does not accept).

Behaviour changes to know:
- Free plan = 1 shop. Existing owners with several shops keep them (grandfathered); only NEW shops are blocked until admin activates a plan.
- Staff only work while the owner is on Business Pro.

## Follow-up (run after 20261110)
2. `supabase/migrations/20261111_staff_khata_manager_dashboard.sql` - staff `khata` permission + manager combined dashboard.
