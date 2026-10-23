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
  message: r.message || "", images: Array.isArray(r.images) ? r.images : [],
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
  const city = nearest?.s.city;
  const inCity = (s) => !city || !s.city || s.city === city;
  const byId = Object.fromEntries(visible.map((s) => [s.id, s]));
  const items = [];
  broadcasts.forEach((b) => {
    const s = byId[b.shopId];
    if (!s || !inCity(s) || b.expiresAt <= Date.now()) return;
    items.push({ id: "b:" + b.id, kind: "broadcast", sub: b.kind, shopId: s.id, shopName: s.name, productId: b.productId, title: b.title, text: b.message, price: b.price, oldPrice: b.oldPrice, images: b.images, at: b.createdAt });
  });
  visible.filter(inCity).forEach((s) => {
    const p = s.promotion;
    if (isPromotionActive(p) && ["announcement", "new_stock", "coupon", "reward_wheel"].includes(p.type))
      items.push({ id: `p:${s.id}:${p.type}:${p.expiresAt}`, kind: p.type, shopId: s.id, shopName: s.name, title: p.type === "coupon" ? "Coupon" : s.name, text: p.coupon || p.message || "", images: [], at: new Date(p.createdAt || Date.now()).getTime() });
    (s.products || []).forEach((pr) => {
      const q = pr.promotion;
      if (isPromotionActive(q) && ["discount", "flash", "product_boost"].includes(q.type))
        items.push({ id: `d:${pr.id}:${q.type}:${q.expiresAt}`, kind: q.type, shopId: s.id, shopName: s.name, productId: pr.id, title: pr.name, text: q.discount > 0 ? `${q.discount}% OFF` : "Featured product", price: q.newPrice ?? pr.price, oldPrice: q.discount > 0 ? (q.originalPrice ?? pr.price) : null, images: [pr.imageUrl].filter(Boolean), at: new Date(q.createdAt || Date.now()).getTime() });
    });
  });
  return items.sort((a, b) => b.at - a.at);
}
