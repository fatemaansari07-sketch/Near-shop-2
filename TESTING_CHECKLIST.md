# Testing checklist
Automated (done here): build passes; jsdom tests: shop switch shows only the active shop's products, Report/Sell/menu present, employee(sell-only) UI hides Report/owner actions, SellFlow renders. SQL syntax parsed (pglast).
Manual on staging (NOT run):
- [ ] SellFlow: add item -> Udhar -> pick customer -> "Wapas" returns -> Payment mila saves once. Double-tap saves one bill.
- [ ] Two shops: inventory/khata/broadcast never mix after switching.
- [ ] Admin: switch a promo type OFF -> hidden in Promote; direct insert fails with FEATURE_OFF. Broadcast OFF same.
- [ ] Free owner adding 2nd shop -> PLAN_SHOP_LIMIT. After admin activates Multi-Shop it works.
- [ ] Free owner: All Shops shows locked; Multi-Shop: limited; Pro: full.
- [ ] Pro owner adds employee (@username, sell only): can sell, cannot read khata/bills of other shops, cannot edit products; revoke blocks immediately.
- [ ] Non-owner calling owner_business_overview sees only own shops.
