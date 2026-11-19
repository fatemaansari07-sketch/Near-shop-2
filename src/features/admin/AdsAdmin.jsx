import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const PLACES = [["home", "Home (Feed ke neeche)"], ["feed", "Feed ke beech me"], ["deals", "Deals screen"], ["popup", "Popup (app khulte waqt)"]];
const UNITS = { ghante: 3600000, din: 86400000 };
const blank = { kind: "affiliate", title: "", body: "", image_url: "", link_url: "", button_text: "Dekhein", placements: ["home"], amount: 7, unit: "din" };
// Phone photo -> max 1000px JPEG (~100-200 KB) kept inside the ad row, so no storage setup is needed.
async function compressImage(file, max = 1000) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  for (const q of [0.8, 0.65, 0.5]) { const u = c.toDataURL("image/jpeg", q); if (u.length < 450000) return u; }
  return c.toDataURL("image/jpeg", 0.4);
}
const state = (a) => { const now = Date.now(); if (!a.active) return ["Band", "bg-gray-100 text-gray-600"]; if (new Date(a.ends_at) <= now) return ["Khatam", "bg-red-100 text-red-600"]; if (new Date(a.starts_at) > now) return ["Aane wala", "bg-amber-100 text-amber-700"]; return ["Chalu", "bg-emerald-100 text-emerald-700"]; };
const left = (a) => { const ms = new Date(a.ends_at) - Date.now(); if (ms <= 0) return ""; const h = Math.floor(ms / 3600000); return h >= 48 ? `${Math.floor(h / 24)} din baaki` : `${h} ghante baaki`; };

export default function AdsAdmin({ adminPassword }) {
  const [ads, setAds] = useState(null);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_ads", { p_password: adminPassword });
    if (error) setMsg("Ads load nahi hue (SQL 20261116 chalaya?): " + error.message); else setAds(data || []);
  }, [adminPassword]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setMsg("");
    if (!f.title.trim()) return setMsg("Title likhiye.");
    if (!/^https:\/\//i.test(f.link_url.trim())) return setMsg("Link https:// se shuru hona chahiye.");
    if (f.image_url.trim() && !/^(https:\/\/|data:image\/)/i.test(f.image_url.trim())) return setMsg("Image link https:// se shuru hona chahiye, ya phone se photo chuniye.");
    if (!f.placements.length) return setMsg("Kam se kam ek jagah chuniye.");
    const dur = Number(f.amount) * UNITS[f.unit];
    if (!(dur > 0)) return setMsg("Kitne time ke liye lagana hai wo likhiye.");
    setBusy(true);
    const now = new Date();
    const { data, error } = await supabase.rpc("admin_save_ad", { p_password: adminPassword, p_ad: { kind: f.kind, title: f.title.trim(), body: f.body.trim(), image_url: f.image_url.trim(), link_url: f.link_url.trim(), button_text: f.button_text.trim() || "Dekhein", placements: f.placements, starts_at: now.toISOString(), ends_at: new Date(now.getTime() + dur).toISOString(), active: true } });
    setBusy(false);
    if (error || !data) return setMsg("Save nahi hua: " + (error?.message || "password galat?"));
    setMsg("Ad lag gaya ✔ (users ko 2 minute me dikhne lagega)"); setF(blank); load();
  };
  const patch = async (a, p) => { const { error } = await supabase.rpc("admin_save_ad", { p_password: adminPassword, p_ad: { id: a.id, ...p } }); if (error) setMsg(error.message); load(); };
  const extend = (a, days) => patch(a, { ends_at: new Date(Math.max(Date.now(), new Date(a.ends_at).getTime()) + days * 86400000).toISOString() });
  const del = async (a) => { if (!window.confirm(`"${a.title}" delete karein?`)) return; await supabase.rpc("admin_delete_ad", { p_password: adminPassword, p_id: a.id }); load(); };
  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";
  return <div className="px-5 mt-4 space-y-4">
    <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
      <div className="font-extrabold text-sm">📢 Naya Ad lagao</div>
      <div className="flex gap-2">{[["affiliate", "Affiliate (Amazon etc.)"], ["app_promo", "App / Promotion"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, kind: k })} className={`flex-1 py-2 rounded-xl text-xs font-bold ${f.kind === k ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}</div>
      <input className={inp} placeholder="Title (jaise: Amazon Great Sale)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
      <textarea className={inp} rows={2} placeholder="Chhota description (optional)" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={300} />
      <div className="text-[11px] text-gray-500 font-semibold">Image (optional)</div>
      <input type="file" accept="image/*" className="w-full text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setF((x) => ({ ...x })); const u = await compressImage(file); setF((x) => ({ ...x, image_url: u })); setMsg(""); } catch { setMsg("Photo padhi nahi gayi, dusri try karein."); } }} />
      {f.image_url.startsWith("data:") ? <div className="relative"><img src={f.image_url} alt="" className="w-full max-h-44 object-contain rounded-xl border border-gray-100" /><button onClick={() => setF({ ...f, image_url: "" })} className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">Hatao</button></div>
        : <input className={inp} placeholder="ya image ka link https://…" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />}
      <input className={inp} placeholder="Ad ka link https://… (affiliate link yahan)" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} />
      <input className={inp} placeholder="Button ka text (Dekhein / Kharidein)" value={f.button_text} onChange={(e) => setF({ ...f, button_text: e.target.value })} maxLength={20} />
      <div className="text-[11px] text-gray-500 font-semibold">Kahan dikhana hai</div>
      <div className="grid grid-cols-2 gap-2">{PLACES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs"><input type="checkbox" className="w-4 h-4" checked={f.placements.includes(k)} onChange={() => setF({ ...f, placements: f.placements.includes(k) ? f.placements.filter((x) => x !== k) : [...f.placements, k] })} />{l}</label>)}</div>
      <div className="text-[11px] text-gray-500 font-semibold">Kitne time ke liye</div>
      <div className="flex gap-2"><input type="number" min="1" className={inp} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={inp} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option value="ghante">Ghante</option><option value="din">Din</option></select></div>
      <button onClick={save} disabled={busy} className="w-full bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">{busy ? "Lag raha hai…" : "Ad lagao"}</button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <div className="font-extrabold text-sm mb-2">Saare Ads</div>
      {!ads && <div className="text-xs text-gray-400">Loading…</div>}
      {ads && !ads.length && <div className="text-xs text-gray-400">Abhi koi ad nahi.</div>}
      {(ads || []).map((a) => { const [lab, cls] = state(a); const ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : "0"; return <div key={a.id} className="border-t border-gray-50 py-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="font-bold text-sm truncate">{a.title}</div>
          <div className="text-[10px] text-gray-400">{a.kind === "affiliate" ? "Affiliate" : "App promo"} · {(a.placements || []).join(", ")}{left(a) ? ` · ${left(a)}` : ""}</div></div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{lab}</span></div>
        <div className="text-[11px] text-gray-500 mt-1">👁 {a.impressions} views · 👆 {a.clicks} clicks · {ctr}%</div>
        <div className="flex gap-3 mt-2 text-[11px] font-bold">
          <button onClick={() => patch(a, { active: !a.active })} className="text-violet-700">{a.active ? "Pause" : "Chalu karo"}</button>
          <button onClick={() => extend(a, 1)} className="text-emerald-700">+1 din</button>
          <button onClick={() => extend(a, 7)} className="text-emerald-700">+7 din</button>
          <button onClick={() => del(a)} className="text-red-500">Delete</button></div>
      </div>; })}
    </div>
  </div>;
}
