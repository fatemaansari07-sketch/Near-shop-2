import React from "react";
import { formatINR, timeAgo } from "../../data/mockData";

const LABEL = { new_arrival: "🆕 Naya aaya", special: "🔥 Special", discount: "🏷️ Discount" };

// Customer ko dikhne wala broadcast: photos swipe, naam, price, message.
export default function BroadcastCard({ b, shop, onOpen }) {
  const off = b.oldPrice && b.price != null && b.oldPrice > b.price ? Math.round(((b.oldPrice - b.price) / b.oldPrice) * 100) : 0;
  const hrs = Math.max(1, Math.ceil((b.expiresAt - Date.now()) / 3600000));
  return <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden mb-3">
    {b.images.length > 0 && <div className="flex overflow-x-auto snap-x snap-mandatory bg-gray-100" style={{ scrollbarWidth: "none" }}>
      {b.images.map((u, i) => <img key={u + i} src={u} alt="" onClick={() => onOpen(b)} className="h-52 object-cover flex-shrink-0 snap-center" style={{ minWidth: "100%" }}/>)}
    </div>}
    {b.images.length > 1 && <div className="text-[10px] text-gray-400 text-center pt-1">{b.images.length} photos — swipe karein</div>}
    <div className="p-3 cursor-pointer" onClick={() => onOpen(b)}>
      <div className="flex justify-between items-center"><span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{LABEL[b.kind] || "📣"}</span><span className="text-[10px] text-gray-400">{timeAgo(b.createdAt)} · {hrs}h baaki</span></div>
      <div className="font-extrabold text-base mt-1.5">{b.title}</div>
      <div className="text-[11px] text-gray-400">{shop?.name}{shop?.area ? ` · ${shop.area}` : ""}</div>
      {b.price != null && <div className="flex items-end gap-2 mt-1"><span className="text-xl font-extrabold text-emerald-600">{formatINR(b.price)}</span>{off > 0 && <><span className="text-xs text-gray-400 line-through mb-0.5">{formatINR(b.oldPrice)}</span><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded mb-0.5">{off}% OFF</span></>}</div>}
      {b.message && <div className="text-sm text-gray-700 mt-1.5 whitespace-pre-line">{b.message}</div>}
      <div className="text-right text-xs font-bold text-indigo-600 mt-1">{b.productId ? "Product dekho ›" : "Dukaan dekho ›"}</div>
    </div>
  </div>;
}
