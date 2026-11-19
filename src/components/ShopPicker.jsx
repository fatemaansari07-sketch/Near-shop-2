import React from "react";

// Two clear choices for multi-shop owners: "Sab dukaan ek saath" or "Dukaan chuno" (tick the shops you want).
// `allowOne` adds a third, "Sirf ye ek dukaan" mode (used in Feed where one shop is already selected above).
export default function ShopPicker({ shops, mode, setMode, picked, setPicked, allowOne = false }) {
  const modes = [...(allowOne ? [["one", "Sirf ye dukaan"]] : []), ["all", `Sab dukaan (${shops.length})`], ["pick", "Dukaan chuno"]];
  const toggle = (id) => { const n = new Set(picked); n.has(id) ? n.delete(id) : n.add(id); setPicked(n); };
  return <div className="mt-3">
    <div className="flex gap-1.5">{modes.map(([k, l]) => <button type="button" key={k} onClick={() => setMode(k)} className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${mode === k ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}</div>
    {mode === "pick" && <div className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-50">
      {shops.map((s) => <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm"><input type="checkbox" className="w-4 h-4" checked={picked.has(s.id)} onChange={() => toggle(s.id)} /><span className="truncate">{s.name}</span></label>)}
      <div className="px-3 py-1.5 text-[10px] text-gray-400 flex justify-between"><span>{picked.size} chuni gayi</span><button type="button" className="text-violet-600 font-bold" onClick={() => setPicked(new Set(picked.size === shops.length ? [] : shops.map((s) => s.id)))}>{picked.size === shops.length ? "Sab hatao" : "Sab chuno"}</button></div>
    </div>}
  </div>;
}
