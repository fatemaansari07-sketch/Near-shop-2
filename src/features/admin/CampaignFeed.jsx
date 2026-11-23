import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

// Campaign audience is filtered by live_admin_campaigns() on the server.
// Client-side filters are intentionally not treated as an authorization boundary.
function loadLive() {
  return Promise.resolve(supabase.rpc("live_admin_campaigns"))
    .then(({ data, error }) => { if (error) throw error; return data || []; })
    .catch(() => []);
}
const track = (id, event) => {
  try { void supabase.rpc("track_admin_campaign", { p_id: id, p_event: event }); } catch {}
};
const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const DKEY = "ns_dismissed_campaigns";
const getDismissed = () => { try { return JSON.parse(localStorage.getItem(DKEY) || "[]"); } catch { return []; } };
const safeUrl = value => {
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
};

export default function CampaignFeed({ className = "", limit = 5, compact = false }) {
  const [rows, setRows] = useState([]);
  const [gone, setGone] = useState(getDismissed);
  const seen = useRef(new Set());
  useEffect(() => {
    let alive = true;
    const refresh = () => loadLive().then(r => { if (alive) setRows(r || []); });
    refresh();
    const timer = setInterval(refresh, 60000);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => refresh());
    return () => { alive = false; clearInterval(timer); authListener?.subscription?.unsubscribe?.(); };
  }, []);
  const list = rows.filter(c => !gone.includes(c.id)).slice(0, limit);
  useEffect(() => {
    list.forEach(c => {
      if (!seen.current.has(c.id)) {
        seen.current.add(c.id);
        track(c.id, "view");
      }
    });
  }, [list.map(c => c.id).join("|")]);
  if (!list.length) return null;
  const close = id => {
    const n = [...gone, id];
    setGone(n);
    try { localStorage.setItem(DKEY, JSON.stringify(n)); } catch {}
  };
  const open = c => {
    track(c.id, "click");
    const u = safeUrl(c.primary_url || c.video_url);
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };
  return <section className={`space-y-3 ${className}`} aria-label="NearShop campaigns">
    {list.map(c => {
      const url = safeUrl(c.primary_url || c.video_url);
      return <article key={c.id} className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
        <button onClick={() => close(c.id)} aria-label="Campaign band karein" className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-black/50 text-xs text-white">✕</button>
        {c.image_url && <img src={c.image_url} alt="" loading="lazy" className={`block w-full object-cover ${compact ? "max-h-36" : "max-h-64"}`} />}
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">{c.seller_type === "platform" ? "NearShop Official" : "Sponsored"}</div>
          <div className="mt-1 text-sm font-extrabold text-slate-900">{c.title}</div>
          {!!c.body && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{c.body}</p>}
          {c.campaign_type === "store_product" && c.product_price != null && <div className="mt-2 text-sm font-bold text-emerald-700">{c.product_name} · {money(c.product_price)} {c.compare_at_price && <del className="ml-1 text-xs font-normal text-slate-400">{money(c.compare_at_price)}</del>}</div>}
          {c.campaign_type === "feature_offer" && c.discount_value != null && <div className="mt-2 text-xs font-bold text-amber-700">{c.discount_type === "fixed" ? money(c.discount_value) : c.discount_value + "%"} OFF{c.coupon_code ? ` · Code: ${c.coupon_code}` : ""}</div>}
          {url && <button onClick={() => open(c)} className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white">{c.button_text || "Abhi Dekhein"}</button>}
        </div>
      </article>;
    })}
  </section>;
}
