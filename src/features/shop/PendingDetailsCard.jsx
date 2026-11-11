import React from "react";

export const isPending = (p) => !!p?.categoryData?.pending;

// Jaldi me add hue products ki "detail baaki hai" yaad dilane wala card.
export default function PendingDetailsCard({ shops = [], onEdit, onOpenAll }) {
  const rows = shops.flatMap((s) => (s.products || []).filter(isPending).map((p) => ({ p, s })));
  if (!rows.length) return null;
  if (onOpenAll) return <button onClick={onOpenAll} className="w-full text-left bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between min-h-[48px]"><span className="font-extrabold text-sm">📝 {rows.length} product{rows.length > 1 ? "s" : ""} ki details baaki hain</span><span className="text-amber-700 text-xs font-bold">Dekho ›</span></button>;
  return <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
    <div className="font-extrabold text-sm">📝 {rows.length} product{rows.length > 1 ? "s" : ""} ki detail baaki hai</div>
    <div className="text-[11px] text-gray-500 mb-2">Jaldi me add hue the. Free ho to poori detail bhar do (stock, expiry, photos...).</div>
    <div className="space-y-1.5">{rows.slice(0, 5).map(({ p, s }) => <div key={p.id} className="bg-white rounded-xl p-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">{p.imageUrl ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover"/> : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">📦</div>}<div className="min-w-0"><div className="text-sm font-bold truncate">{p.name}</div><div className="text-[10px] text-gray-400">₹{p.price}{rows.length > 0 && shops.length > 1 ? ` · ${s.name}` : ""}</div></div></div>
      <button onClick={() => onEdit(p, s)} className="text-xs font-bold text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 flex-shrink-0">Detail bharo</button></div>)}</div>
    {rows.length > 5 && <div className="text-[11px] text-gray-400 mt-1.5">+ {rows.length - 5} aur</div>}
  </div>;
}
