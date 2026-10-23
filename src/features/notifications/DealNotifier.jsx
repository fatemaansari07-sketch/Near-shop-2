import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatINR, timeAgo } from "../../data/mockData";
import { useDealSeen, markDealsSeen, feedLabel } from "./notifyStore";

// Naya deal aate hi upar se chhota banner (app khula ho tab).
export default function DealNotifier({ feed, onOpen }) {
  const seen = useDealSeen();
  const prev = useRef(null);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const ids = new Set(feed.map((i) => i.id));
    if (prev.current === null) { prev.current = ids; return; }
    const fresh = feed.filter((i) => !prev.current.has(i.id) && !seen.includes(i.id));
    prev.current = ids;
    if (fresh.length) setToast({ item: fresh[0], more: fresh.length - 1 });
  }, [feed]); // eslint-disable-line
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t); }, [toast]);
  if (!toast) return null;
  const it = toast.item;
  return <div className="fixed top-3 left-0 right-0 z-[70] px-4 max-w-md mx-auto">
    <button onClick={() => { markDealsSeen([it.id]); onOpen(it); setToast(null); }} className="w-full text-left bg-white shadow-xl border border-orange-200 rounded-2xl p-3 flex gap-3 items-center">
      {it.images?.[0] ? <img src={it.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover"/> : <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-xl">🔔</div>}
      <div className="min-w-0 flex-1"><div className="text-[10px] font-bold text-orange-600">{feedLabel(it)} · {it.shopName}</div><div className="text-sm font-bold truncate">{it.title}{it.price != null ? ` — ${formatINR(it.price)}` : ""}</div><div className="text-[11px] text-gray-500 truncate">{it.text}{toast.more > 0 ? ` (+${toast.more} aur)` : ""}</div></div>
    </button>
  </div>;
}

// Deals screen ki bell ke andar poori list.
export function DealFeedPanel({ items, seen, onClose, onOpen }) {
  return <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
    <div className="max-w-md mx-auto pb-10">
      <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-center"><b>🔔 Notifications</b><button onClick={onClose}><X size={20}/></button></div>
      {items.length === 0 && <div className="text-center text-gray-400 text-sm mt-16 px-8">Abhi koi naya deal ya broadcast nahi. Dukaan koi offer lagayegi to yahin dikhega.</div>}
      <div className="px-4 pt-3 space-y-2">{items.map((it) => { const isNew = !seen.includes(it.id); return <button key={it.id} onClick={() => onOpen(it)} className={`w-full text-left rounded-2xl border p-3 flex gap-3 items-center ${isNew ? "border-orange-300 bg-orange-50/50" : "border-gray-100 bg-white"}`}>
        {it.images?.[0] ? <img src={it.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0"/> : <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🔔</div>}
        <div className="min-w-0 flex-1"><div className="flex justify-between"><span className="text-[10px] font-bold text-orange-600">{feedLabel(it)}</span>{isNew && <span className="text-[9px] bg-red-500 text-white rounded-full px-1.5 font-bold">NEW</span>}</div><div className="text-sm font-bold truncate">{it.shopName}</div><div className="text-xs text-gray-600 truncate">{it.title}{it.price != null ? ` — ${formatINR(it.price)}` : ""}{it.text ? ` · ${it.text}` : ""}</div><div className="text-[10px] text-gray-400">{timeAgo(it.at)}</div></div>
      </button>; })}</div>
    </div>
  </div>;
}
