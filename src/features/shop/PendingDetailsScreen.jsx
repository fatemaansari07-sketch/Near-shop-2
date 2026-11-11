import React from "react";
import { ArrowLeft } from "lucide-react";
import { isPending } from "./PendingDetailsCard";

// Separate screen listing every product of the ACTIVE shop whose details are still pending.
export default function PendingDetailsScreen({ shop, onBack, onEdit }) {
  const rows = (shop.products || []).filter((p) => isPending(p) && !p.archived_at);
  return <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-5 rounded-b-3xl text-white"><button onClick={onBack} className="mb-2"><ArrowLeft size={20}/></button><div className="text-xl font-extrabold">Pending Product Details</div><div className="text-white/80 text-xs">{shop.name} · {rows.length} baaki</div></div>
    <div className="px-5 mt-4 space-y-2">{rows.length === 0 && <div className="text-center text-sm text-gray-400 mt-10">Sab products ki detail poori hai 🎉</div>}
      {rows.map((p) => <div key={p.id} className="bg-white rounded-2xl p-3 flex items-center justify-between gap-2 border border-gray-100">
        <div className="flex items-center gap-2 min-w-0">{p.imageUrl ? <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover"/> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">📦</div>}<div className="min-w-0"><div className="text-sm font-bold truncate">{p.name}</div><div className="text-[11px] text-gray-400">₹{p.price}</div></div></div>
        <button onClick={() => onEdit(p, shop)} className="text-xs font-bold text-amber-700 border border-amber-300 rounded-lg px-3 py-2 min-h-[40px]">Detail bharo</button></div>)}
    </div>
  </div>;
}
