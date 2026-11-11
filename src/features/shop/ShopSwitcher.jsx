import React from "react";
import { Store } from "lucide-react";

// Horizontal swipeable shop cards. Only switches the active shop; data scoping is done by the parent.
export default function ShopSwitcher({ shops, activeId, onSelect }) {
  if (shops.length < 2) return null;
  return <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
    {shops.map((s) => {
      const on = s.id === activeId;
      return <button key={s.id} onClick={() => onSelect(s.id)} className={`snap-start flex-shrink-0 min-w-[140px] max-w-[190px] text-left rounded-2xl px-3 py-2.5 border ${on ? "bg-white text-violet-700 border-white shadow" : "bg-white/15 text-white border-white/30"}`}>
        <div className="flex items-center gap-1.5">{s.logo_url ? <img src={s.logo_url} alt="" className="w-5 h-5 rounded-full object-cover"/> : <Store size={14}/>}<span className="text-xs font-extrabold truncate">{s.name}</span></div>
        <div className={`text-[10px] truncate ${on ? "text-gray-400" : "text-white/70"}`}>{s.area}</div>
      </button>;
    })}
  </div>;
}
