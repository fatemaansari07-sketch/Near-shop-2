import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { iconOf, safeImg, isFeatured } from "./serviceData";

const TONE = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-600", blocked: "bg-gray-200 text-gray-600" };
export default function ServicesAdmin({ adminPassword }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_service_profiles", { p_password: adminPassword });
    if (error || !data) setMsg("Load nahi hua (Services v2 SQL 20261121 chalaya? password sahi?) " + (error?.message || "")); else setRows(data);
  }, [adminPassword]);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (p, status, featDays) => {
    const reason = status === "rejected" ? window.prompt("Professional ko kya correction karna hai? (optional reason)", p.rejection_reason || "") : null;
    if (status === "rejected" && reason === null) return;
    const until = featDays == null ? null : featDays <= 0 ? new Date(Date.now() - 1000).toISOString() : new Date(Math.max(Date.now(), p.featured_until ? new Date(p.featured_until).getTime() : 0) + featDays * 86400000).toISOString();
    const { data, error } = await supabase.rpc("admin_set_service_status", { p_password: adminPassword, p_id: p.id, p_status: status || p.status, p_featured_until: until, p_rejection_reason: reason || null });
    setMsg(error || data !== true ? "Nahi hua: " + (error?.message || "") : "Ho gaya ✔"); load();
  };
  const shown = (rows || []).filter((r) => filter === "all" || (filter === "reported" ? r.reports > 0 : r.status === filter));
  return <div className="px-5 mt-4 space-y-3">
    <div className="flex gap-2 overflow-x-auto">{["pending", "approved", "reported", "rejected", "blocked", "all"].map((k) => <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize whitespace-nowrap ${filter === k ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>{k} {rows ? `(${rows.filter((r) => k === "all" || (k === "reported" ? r.reports > 0 : r.status === k)).length})` : ""}</button>)}</div>
    {msg && <div className="text-xs text-gray-600">{msg}</div>}
    {!rows && <div className="text-xs text-gray-400">Loading…</div>}
    {rows && !shown.length && <div className="text-xs text-gray-400">Koi profile nahi.</div>}
    {shown.map((p) => <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex gap-3">{safeImg(p.photo_url) ? <img src={safeImg(p.photo_url)} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-xl">{iconOf(p.category)}</div>}
        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="font-bold text-sm truncate">{p.name}</div><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TONE[p.status]}`}>{p.status}</span></div>
          <div className="text-[11px] text-gray-500">{p.category} · {p.city}{p.area ? `, ${p.area}` : ""} · {p.experience_years ?? "?"} saal</div>
          <div className="text-[11px] text-gray-500">📞 {p.phone}{isFeatured(p) ? " · ⭐ Featured" : ""}{p.reports > 0 ? ` · 🚩 ${p.reports} report` : ""}</div></div></div>
      {p.tagline && <div className="text-xs font-semibold text-violet-700 mt-2">{p.tagline}</div>}
      {p.about && <div className="text-xs text-gray-600 mt-2 line-clamp-3">{p.about}</div>}
      {(p.skills || []).length > 0 && <div className="text-[10px] text-gray-500 mt-1">Skills: {p.skills.join(", ")}</div>}
      {(p.service_areas || []).length > 0 && <div className="text-[10px] text-gray-500">Areas: {p.service_areas.join(", ")}</div>}
      {p.property_details?.rera_number && <div className="text-[10px] text-amber-700 mt-1">RERA: {p.property_details.rera_number} · {p.property_details.verification_status}</div>}
      {p.rejection_reason && <div className="text-[10px] text-red-600 mt-1">Previous feedback: {p.rejection_reason}</div>}
      {(p.work_photos || []).length > 0 && <div className="flex gap-1.5 mt-2 overflow-x-auto">{p.work_photos.map(safeImg).filter(Boolean).map((u, i) => <img key={i} src={u} alt="" className="h-16 rounded-lg" />)}</div>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-bold">
        {p.status !== "approved" && <button onClick={() => setStatus(p, "approved")} className="text-emerald-700">Approve</button>}
        {p.status !== "rejected" && <button onClick={() => setStatus(p, "rejected")} className="text-red-500">Reject</button>}
        {p.status === "approved" && <button onClick={() => setStatus(p, "blocked")} className="text-gray-600">Block</button>}
        {p.status === "approved" && <><button onClick={() => setStatus(p, "approved", 7)} className="text-amber-600">⭐ Featured +7 din</button><button onClick={() => setStatus(p, "approved", 30)} className="text-amber-600">+30 din</button>{isFeatured(p) && <button onClick={() => setStatus(p, "approved", 0)} className="text-gray-500">Featured hatao</button>}</>}
      </div></div>)}
  </div>;
}
