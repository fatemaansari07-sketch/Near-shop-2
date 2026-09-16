# Need It / Item Request setup

1. In Supabase SQL Editor, run `supabase/migrations/20260910_need_it_requests.sql`.
2. The migration creates `need_requests`, `need_responses`, the `need-images` storage bucket and basic image read/upload policies.
3. The app routes requests by exact shop category: Pharmacy, Footwear, Clothing, Electronics, Paint. A request is shown only to matching nearby shops (within 15 km when GPS is available).
4. Requests are treated as expired after 2 hours by the app and are hidden immediately. The refresh loop also marks expired open requests as `expired` in the database.
5. Customer gets in-app availability alerts (plus vibration when supported). `YES` responses appear under the request with Shop/Coming actions. `Already Bought / Close` immediately stops the request from appearing to shop owners.
6. Need It entry opens the existing interstitial sponsored ad. Shop Requests entry also opens the same ad before the request list. For production ad revenue, replace the existing interstitial component with the platform's approved ad SDK/mediation integration.


## Daily loop + shop monetization

The same migration also adds `shops.promotion`, `products.promotion`, `price_alerts`, `search_events`, and `promotion_events`. The app now has separate feature modules for Aaj Ka NearShop, Daily Reward, Price Alert, shop/product promotions, competitor price insight, and demand-search logging. Need It remains FREE; no lead fee is charged.

Promotion buttons currently save a `mock_paid` promotion record; a real ₹10/₹20/₹30 payment gateway is intentionally not wired yet. Connect the final payment flow only after deciding the Android/Play billing architecture.
