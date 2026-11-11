# Implementation notes
## Done
- SellFlow: Udhar customer pick no longer saves instantly -> confirm step with "Wapas (payment badlo)". Double-submit lock (ref) + DB idempotency key (`p_request_id`). Back warns if cart not empty.
- My Shop: swipeable shop switcher; every panel receives ONLY the active shop; unsaved product-edit warning on switch; compact "N products ki details baaki" card -> separate list screen; Khata / Broadcast / Deal-interested kept in original order; Report + Sell on dashboard; product list/archive/edit/hide kept.
- Three-dot menu (11 items) mapped to existing panels. Notes: "NearShop Pro Shop" opens the Promote panel (membership lives there); "Udhar Khata Settings" opens the existing Khata screen (no separate settings exist).
- Admin > "features" tab: Live/Off for 14 ad features, plan price/limit editing, manual subscription activation. DB triggers reject new broadcasts/promotions of an Off type; old data untouched.
- Plans FREE/MULTI-SHOP/BUSINESS PRO: shop-limit trigger, plan-gated `owner_business_overview`. NO payment gateway: activation is admin-manual (no fake payment).
- Owner combined dashboard ("All Shops"): totals, shop-wise, udhar, best sellers; Pro adds date-wise, slow-moving, stock alerts, search demand (>=5 distinct searchers, no customer ids).
- Staff (manager/employee; sell/inventory/reports): RLS additive policies + RPCs; owner can revoke.
- Shop profile: logo, cover, about, WhatsApp, opening hours (editor in Shop Settings; shown on public ShopDetail).
## Not done / limits
- Not tested against a live Supabase (no DB here): SQL was only syntax-parsed. Run TESTING_CHECKLIST.md on a staging DB first.
- Staff can't use khata/broadcast/promotions (owner-only by design). Combined dashboard is owner-only.
- Per-shop reports for staff use existing report screen over RLS-visible sales_log.
- Removed dead, unreachable code in old ShopManagement (unused quick-add draft state).
- Logo/cover upload reuses the "product-images" bucket; check its storage policy allows it.
- Spam controls: existing phone/shop verification + retail broadcast cap (5/24h) untouched.
- Vercel: no new env vars/settings.
