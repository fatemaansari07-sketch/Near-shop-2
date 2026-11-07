import { useSyncExternalStore } from "react";
import { distanceKm } from "../../data/mockData";
import { isPromotionActive } from "../promotions/promotionService";

// "Dekh liya" store: kaunsi deals/broadcasts user ne pehle hi dekh li (phone me yaad rehta hai).
const KEY = "ns_deal_seen";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
let seen = read();
const subs = new Set();
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useDealSeen = () => useSyncExternalStore(subscribe, () => seen);
export function markDealsSeen(ids) {
  const add = ids.filter((i) => !seen.includes(i));
  if (!add.length) return;
  seen = [...seen, ...add].slice(-600);
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch {}
  subs.forEach((f) => f());
}

export const broadcastFromRow = (r) => ({
  id: r.id, shopId: r.shop_id, productId: r.product_id, kind: r.kind, title: r.title,
  price: r.price != null ? Number(r.price) : null, oldPrice: r.old_price != null ? Number(r.old_price) : null,
  message: r.message || "", images: Array.isArray(r.images) ? r.images : [], audience: r.audience || "everyone", targetScope: r.target_scope || "city",
  createdAt: new Date(r.created_at).getTime(), expiresAt: new Date(r.expires_at).getTime(),
});

const LABEL = {
  new_arrival: "🆕 Naya aaya", special: "🔥 Special", discount: "🏷️ Discount",
  coupon: "🏷️ Coupon", announcement: "📢 Offer", new_stock: "🆕 New Stock", reward_wheel: "🎡 Spin & Win",
  flash: "⚡ Flash Deal", product_boost: "⭐ Featured",
};
export const feedLabel = (it) => (it.kind === "broadcast" ? LABEL[it.sub] : LABEL[it.kind]) || "🔔 Deal";

// Ek hi jagah se: Deals ke saare naye items (broadcast + coupon + discount + offers) newest pehle.
export function buildFeed({ shops, broadcasts = [], userCoords, userId }) {
  const own = new Set(shops.filter((s) => s.owner_id === userId).map((s) => s.id));
  const visible = shops.filter((s) => !s.isBlocked && !own.has(s.id));
  const nearest = [...visible].map((s) => ({ s, d: distanceKm(userCoords?.lat, userCoords?.lng, s.lat, s.lng) })).sort((a, b) => (a.d ?? 999) - (b.d ?? 999))[0];
  const viewerCity = nearest?.s.city, viewerState = nearest?.s.state, viewerCountry = nearest?.s.country;
  const matchesScope = (shop, scope = "city") => {
    if (!nearest) return true;
    if (scope === "country") return Boolean(viewerCountry && shop.country === viewerCountry);
    if (scope === "state") return Boolean(viewerState && shop.state === viewerState);
    return Boolean(viewerCity && shop.city === viewerCity);
  };
  const ownerShops = shops.filter(s => s.owner_id === userId);
  const canSeeWholesale = (shop, audience) => audience !== "shopkeepers" || ownerShops.some(o => o.category === shop.category);
  const byId = Object.fromEntries(visible.map((s) => [s.id, s]));
  const items = [];
  broadcasts.forEach((b) => {
    const s = byId[b.shopId];
    if (!s || !matchesScope(s, b.targetScope) || !canSeeWholesale(s, b.audience) || b.expiresAt <= Date.now()) return;
    if (b.productId) { const p=(s.products||[]).find(x=>x.id===b.productId); if (!p || p.archived_at || (s.productVisibilityMode||"public")==="disabled" || (p.visibilityMode||"public")!=="public") return; }
    items.push({ id: "b:" + b.id, kind: "broadcast", sub: b.kind, shopId: s.id, shopName: s.name, productId: b.productId, title: b.title, text: b.message, price: s.hideProductPrices ? null : b.price, oldPrice: s.hideProductPrices ? null : b.oldPrice, images: b.images, at: b.createdAt, audience: b.audience });
  });
  visible.filter(s => matchesScope(s, s.promotion?.targetScope) && canSeeWholesale(s, s.promotion?.audience)).forEach((s) => {
    const p = s.promotion;
    if (isPromotionActive(p) && ["announcement", "new_stock", "coupon", "reward_wheel"].includes(p.type))
      items.push({ id: `p:${s.id}:${p.type}:${p.expiresAt}`, kind: p.type, shopId: s.id, shopName: s.name, title: p.type === "coupon" ? "Coupon" : s.name, text: p.coupon || p.message || "", images: [], at: new Date(p.createdAt || Date.now()).getTime(), audience: p.audience || "everyone" });
    (s.products || []).forEach((pr) => {
      const q = pr.promotion;
      if (!pr.archived_at && (s.productVisibilityMode||"public")!=="disabled" && (pr.visibilityMode||"public")==="public" && isPromotionActive(q) && matchesScope(s, q.targetScope) && canSeeWholesale(s, q.audience) && ["discount", "flash", "product_boost"].includes(q.type))
        items.push({ id: `d:${pr.id}:${q.type}:${q.expiresAt}`, kind: q.type, shopId: s.id, shopName: s.name, productId: pr.id, title: pr.name, text: q.discount > 0 ? `${q.discount}% OFF` : "Featured product", price: s.hideProductPrices ? null : (q.newPrice ?? pr.price), oldPrice: s.hideProductPrices ? null : (q.discount > 0 ? (q.originalPrice ?? pr.price) : null), images: [pr.imageUrl].filter(Boolean), at: new Date(q.createdAt || Date.now()).getTime(), audience: q.audience || "everyone" });
    });
  });
  return items.sort((a, b) => (b.audience === "shopkeepers" ? 1 : 0) - (a.audience === "shopkeepers" ? 1 : 0) || b.at - a.at);
}
