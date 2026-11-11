import React from "react";
import { X } from "lucide-react";

// Per-shop three-dot menu. Every item maps to an EXISTING feature; `can(perm)` hides owner-only items from staff.
export default function ShopMenuSheet({ shop, items, onPick, onClose }) {
  const groups = [["Quick Actions", items.filter((i) => i.group === "quick")], ["Shop Management", items.filter((i) => i.group === "manage")]];
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-2"><div><div className="font-extrabold">{shop.name}</div><div className="text-[11px] text-gray-400">Shop menu</div></div><button onClick={onClose} className="p-2"><X size={18}/></button></div>
      {groups.map(([title, list]) => list.length > 0 && <div key={title} className="mb-3">
        <div className="text-[11px] font-bold text-violet-700 uppercase mb-1">{title}</div>
        <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl">{list.map((i) => <button key={i.key} onClick={() => onPick(i.key)} className="w-full flex items-center gap-3 px-3 py-3.5 text-left min-h-[48px]"><span className="text-lg">{i.icon}</span><span className="flex-1 text-sm font-semibold">{i.label}</span>{i.note && <span className="text-[10px] text-gray-400">{i.note}</span>}</button>)}</div>
      </div>)}
    </div>
  </div>;
}
