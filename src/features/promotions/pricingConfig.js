export const DEFAULT_PLATFORM_PRICING = {
  promotions: {
    shop_boost: 10, product_boost: 10, discount: 10, flash: 20,
    nearby_first: 20, top_shop: 30, announcement: 10, new_stock: 10,
    coupon: 10, reward_wheel: 20, demand_alert: 10,
  },
  geography: { city: 10, state: 99, country: 999 },
  searchAds: { city: 10, state: 99, country: 999 },
  wholesale: { shopkeepers: 10, everyone: 99, market_intelligence_monthly: 999 },
  broadcast: { retail: 10, wholesale_shopkeepers: 10, wholesale_everyone: 99 },
  membership: { pro_monthly: 99 },
  misc: { feed_post: 10, ad_free_monthly: 99, additional_shop_fee: 4999, competitor_price_insight: 10 },
};

export function mergePricingSettings(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    promotions: { ...DEFAULT_PLATFORM_PRICING.promotions, ...(v.promotions || {}) },
    geography: { ...DEFAULT_PLATFORM_PRICING.geography, ...(v.geography || {}) },
    searchAds: { ...DEFAULT_PLATFORM_PRICING.searchAds, ...(v.searchAds || {}) },
    wholesale: { ...DEFAULT_PLATFORM_PRICING.wholesale, ...(v.wholesale || {}) },
    broadcast: { ...DEFAULT_PLATFORM_PRICING.broadcast, ...(v.broadcast || {}) },
    membership: { ...DEFAULT_PLATFORM_PRICING.membership, ...(v.membership || {}) },
    misc: { ...DEFAULT_PLATFORM_PRICING.misc, ...(v.misc || {}) },
  };
}
