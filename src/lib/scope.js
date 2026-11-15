import { distanceKm } from "../data/mockData";

const norm = (v) => String(v ?? "").trim().toLowerCase();

// Decides whether an offer/broadcast of `shop` is meant for this viewer (city / state / country scope).
// Rules: missing city/state data never hides an offer; the owner always sees his own offers;
// viewer's place = nearest shop with a known distance, else the viewer's own shop, else no filtering at all.
export function makeScopeMatcher(shops = [], userCoords, userId) {
  const near = shops.filter((s) => !s.isBlocked)
    .map((s) => ({ s, d: distanceKm(userCoords?.lat, userCoords?.lng, s.lat, s.lng) }))
    .filter((x) => x.d != null).sort((a, b) => a.d - b.d)[0];
  const own = userId ? shops.find((s) => s.owner_id === userId) : null;
  const viewer = near?.s || own || null;
  return (shop, scope = "city") => {
    if (!viewer) return true;
    if (userId && shop.owner_id === userId) return true;
    const key = scope === "country" ? "country" : scope === "state" ? "state" : "city";
    const a = norm(shop[key]), b = norm(viewer[key]);
    return !a || !b || a === b;
  };
}
