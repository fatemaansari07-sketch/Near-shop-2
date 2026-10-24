import React from "react";
import { distanceKm, formatKm, formatINR, timeAgo } from "../../data/mockData";
import { promotionRank } from "../promotions/promotionService";

// Discover aur Deals ke sabse upar: 📣 Dukaan ki khabar (broadcast) + ⭐ Promoted Shops.
export default function TopStrips({ shops = [], broadcasts = [], userCoords, category = "All", onOpenShop }) {
  const live = shops.filter((s) => !s.isBlocked && (category === "All" || s.category === category));
  const byId = Object.fromEntries(live.map((s) => [s.id, s]));
  const now = Date.now();

  const bcs = broadcasts.filter((b) => b.expiresAt > now && byId[b.shopId]).sort((a, b) => b.createdAt - a.createdAt);
  const promoted = live
    .map((s) => ({ s, d: distanceKm(userCoords?.lat, userCoords?.lng, s.lat, s.lng) }))
    .filter((x) => promotionRank(x.s.promotion, x.d) >= 80)
    .sort((a, b) => promotionRank(b.s.promotion, b.d) - promotionRank(a.s.promotion, a.d) || (a.d ?? 999) - (b.d ?? 999));
  if (!bcs.length && !promoted.length) return null;

  return <div>
    {bcs.length > 0 && <div className="mt-4">
      <div className="px-5 mb-2 flex justify-between items-center"><div className="font-extrabold text-sm">📣 Dukaan ki khabar</div><span className="text-[10px] text-gray-400">{bcs.length} live</span></div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x" style={{ scrollbarWidth: "none" }}>
        {bcs.map((b) => {
          const shop = byId[b.shopId];
          const off = b.oldPrice && b.price != null && b.oldPrice > b.price ? Math.round(((b.oldPrice - b.price) / b.oldPrice) * 100) : 0;
          return <div key={b.id} onClick={() => onOpenShop(shop, b.productId ? { id: b.productId } : undefined)} className="snap-start flex-shrink-0 w-64 bg-white rounded-2xl border border-indigo-100 overflow-hidden cursor-pointer active:scale-[.99]">
            <div className="relative h-32 bg-gray-100">
              {b.images[0] ? <img src={b.images[0]} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-3xl">📣</div>}
              {b.images.length > 1 && <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/60 text-white rounded-full px-2 py-0.5">{b.images.length} photos</span>}
              {off > 0 && <span className="absolute top-1.5 left-1.5 text-[10px] bg-emerald-600 text-white rounded-full px-2 py-0.5 font-bold">{off}% OFF</span>}
            </div>
            <div className="p-3">
              <div className="text-[10px] text-indigo-600 font-bold truncate">{shop.name} · {timeAgo(b.createdAt)}</div>
              <div className="font-bold text-sm truncate">{b.title}</div>
              {b.price != null && <div className="flex items-end gap-1.5"><span className="font-extrabold text-emerald-600">{formatINR(b.price)}</span>{off > 0 && <span className="text-[10px] text-gray-400 line-through mb-0.5">{formatINR(b.oldPrice)}</span>}</div>}
              {b.message && <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{b.message}</div>}
            </div>
          </div>;
        })}
      </div>
    </div>}
    {promoted.length > 0 && <div className="mt-4">
      <div className="px-5 mb-2 flex justify-between items-center"><div className="font-extrabold text-sm">⭐ Promoted Shops</div><span className="text-[10px] text-gray-400">Sponsored</span></div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x" style={{ scrollbarWidth: "none" }}>
        {promoted.map(({ s, d }) => <div key={s.id} onClick={() => onOpenShop(s)} className="snap-start flex-shrink-0 w-56 bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-3 cursor-pointer active:scale-[.99]">
          <div className="flex justify-between items-start gap-2"><div className="font-bold text-sm truncate">{s.name}</div><span className="text-[9px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">{s.promotion.type === "top_shop" ? "🏆 TOP SHOP" : "⭐ PROMOTED"}</span></div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">{s.category} · {s.area}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{d != null ? formatKm(d) : ""}{s.rating ? ` · ⭐ ${s.rating}` : ""}</div>
        </div>)}
      </div>
    </div>}
  </div>;
}
