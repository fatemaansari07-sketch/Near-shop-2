import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

// Customer-side view of admin campaigns (rpc live_admin_campaigns). Only published + in-app + within time window come back.
let cache = { t: 0, rows: null, p: null };
function loadLive() {
  if (cache.rows && Date.now() - cache.t < 60000) return Promise.resolve(cache.rows);
  if (!cache.p) cache.p = Promise.resolve(supabase.rpc("live_admin_campaigns")).then(({ data }) => { cache = { t: Date.now(), rows: data || [], p: null }; return cache.rows; }).catch(() => { cache.p = null; return []; });
  return cache.p;
}
const track = (id, event) => { try { supabase.rpc("track_admin_campaign", { p_id: id, p_event: event }); } catch {} };
const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const DKEY = "ns_dismissed_campaigns";
const getDismissed = () => { try { return JSON.parse(localStorage.getItem(DKEY) || "[]"); } catch { return []; } };

function matches(c, { hasShop, city, category }) {
  switch (c.audience_type) {
    case "customers": return !hasShop;
    case "shopkeepers": return !!hasShop;
    case "city": return !!city && String(c.audience_city || "").trim().toLowerCase() === String(city).trim().toLowerCase();
    case "category": return !!category && category !== "All" && String(c.audience_category || "").trim().toLowerCase() === String(category).toLowerCase();
    case "state": case "selected": return false; // no reliable data in app yet -> don't show to wrong people
    default: return true;
  }
}

export default function CampaignFeed({ hasShop = false, city = "", category = "", className = "" }) {
  const [rows, setRows] = useState([]);
  const [gone, setGone] = useState(getDismissed);
  const seen = useRef(new Set());
  useEffect(() => { let a = true; loadLive().then(r => a && setRows(r || [])); return () => { a = false; }; }, []);
  const list = rows.filter(c => !gone.includes(c.id) && matches(c, { hasShop, city, category })).slice(0, 3);
  useEffect(() => { list.forEach(c => { if (!seen.current.has(c.id)) { seen.current.add(c.id); track(c.id, "view"); } }); });
  if (!list.length) return null;
  const close = id => { const n = [...gone, id]; setGone(n); try { localStorage.setItem(DKEY, JSON.stringify(n)); } catch {} };
  const open = c => { track(c.id, "click"); const u = c.primary_url || c.video_url; if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  return <div className={`space-y-3 ${className}`}>{list.map(c => (
    <div key={c.id} className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <button onClick={() => close(c.id)} aria-label="Band karein" className="absolute right-2 top-2 z-10 h-6 w-6 rounded-full bg-black/40 text-xs text-white">✕</button>
      {c.image_url && <img src={c.image_url} alt="" loading="lazy" className="block h-auto w-full" />}
      <div className="p-4">
        <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">{c.seller_type === "platform" ? "NearShop Official" : "Sponsored"}</div>
        <div className="mt-1 text-sm font-extrabold text-slate-900">{c.title}</div>
        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{c.body}</p>
        {c.campaign_type === "store_product" && c.product_price != null && <div className="mt-2 text-sm font-bold text-emerald-700">{c.product_name} · {money(c.product_price)} {c.compare_at_price && <del className="ml-1 text-xs font-normal text-slate-400">{money(c.compare_at_price)}</del>}</div>}
        {c.campaign_type === "feature_offer" && c.discount_value != null && <div className="mt-2 text-xs font-bold text-amber-700">{c.discount_type === "fixed" ? money(c.discount_value) : c.discount_value + "%"} OFF{c.coupon_code ? ` · Code: ${c.coupon_code}` : ""}</div>}
        {(c.primary_url || c.video_url) && <button onClick={() => open(c)} className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white">{c.button_text || "Abhi Dekhein"}</button>}
      </div>
    </div>))}</div>;
}
