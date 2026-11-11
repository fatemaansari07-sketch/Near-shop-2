import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Feature keys the admin can switch Live/Off (missing key = Live, so old data keeps working).
export const FEATURE_LIST = [
  ["shop_boost", "Promote Shop"], ["product_boost", "Promote Product"], ["discount", "Discount Deal"], ["flash", "Flash Deal"],
  ["nearby_first", "Nearby Me First"], ["top_shop", "Top Shop"], ["announcement", "Announcement"], ["new_stock", "New Stock"],
  ["coupon", "Coupon"], ["reward_wheel", "Spin & Win"], ["demand_alert", "Demand Alert Unlock"],
  ["broadcast", "Product Broadcast"], ["competitor_price_insight", "Competitor Price Insight"], ["wholesale_market_intelligence", "Wholesale Market Intelligence"],
];
export const DEFAULT_PLANS = {
  free: { label: "Free", price: 0, max_shops: 1 },
  multi_shop: { label: "Multi-Shop", price: 499, max_shops: 10 },
  business_pro: { label: "Business Pro", price: 4999, max_shops: 100 },
};
export const planRank = (p) => (p === "business_pro" ? 2 : p === "multi_shop" ? 1 : 0);

// Live/Off flags. UI hides; the database ALSO rejects new broadcasts/promotions when Off (see migration).
export function usePlatformFeatures() {
  const [flags, setFlags] = useState({});
  useEffect(() => {
    let live = true;
    supabase.from("platform_settings").select("settings").eq("id", "features").maybeSingle()
      .then(({ data }) => { if (live && data?.settings) setFlags(data.settings); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return { flags, isOn: (key) => flags[key] !== false };
}

// Current owner's plan (read-only; activated by admin) + editable plan prices.
export function useMyPlan(userId) {
  const [plan, setPlan] = useState("free");
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  useEffect(() => {
    let live = true;
    supabase.from("platform_settings").select("settings").eq("id", "plans").maybeSingle()
      .then(({ data }) => { if (live && data?.settings) setPlans({ ...DEFAULT_PLANS, ...data.settings }); }).catch(() => {});
    if (userId) {
      supabase.from("owner_subscriptions").select("plan,status,valid_until").eq("owner_id", userId).maybeSingle()
        .then(({ data }) => {
          if (!live || !data) return;
          const ok = data.status === "active" && (!data.valid_until || new Date(data.valid_until) > new Date());
          setPlan(ok ? data.plan : "free");
        }).catch(() => {});
    }
    return () => { live = false; };
  }, [userId]);
  return { plan, plans, rank: planRank(plan) };
}
