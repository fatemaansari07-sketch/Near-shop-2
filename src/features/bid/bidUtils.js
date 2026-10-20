import { useSyncExternalStore } from "react";

// Chhota shared "seen" store: kaunsi bid/offers dekh li gayi (phone me yaad rehta hai).
const KO = "ns_bid_owner_seen", KC = "ns_bid_cust_seen";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
let owner = read(KO, []);
let cust = read(KC, {});
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const useOwnerSeen = () => useSyncExternalStore(subscribe, () => owner);
export const useCustSeen = () => useSyncExternalStore(subscribe, () => cust);
export function markOwnerSeen(keys) {
  const add = keys.filter((k) => !owner.includes(k));
  if (!add.length) return;
  owner = [...owner, ...add].slice(-400); save(KO, owner); emit();
}
export function markCustSeen(bidId, count) {
  if (cust[bidId] === count) return;
  cust = { ...cust, [bidId]: count }; save(KC, cust); emit();
}

// Shopkeeper: naye open bids (apni category) + jin customers ne offer chuna.
export function ownerBidAlerts(bids, myShops, seen) {
  const ids = new Set(myShops.map((s) => s.id)), cats = new Set(myShops.map((s) => s.category)), owners = new Set(myShops.map((s) => s.owner_id));
  const fresh = bids.filter((b) => b.status === "open" && cats.has(b.category) && !owners.has(b.customerId) && !(b.offers || []).some((o) => ids.has(o.shopId)) && !seen.includes("n:" + b.id));
  const accepted = bids.filter((b) => b.status === "accepted" && ids.has(b.acceptedShopId) && !seen.includes("a:" + b.id));
  return { fresh, accepted, count: fresh.length + accepted.length };
}
// Customer: apni open bids par kitne naye offers aaye.
export const customerNewOffers = (bids, userId, seenMap) =>
  bids.filter((b) => b.customerId === userId && b.status === "open").reduce((n, b) => n + Math.max(0, (b.offers?.length || 0) - (seenMap[b.id] || 0)), 0);
