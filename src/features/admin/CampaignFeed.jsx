import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { pushSupported, pushPermission, enablePush } from "../../lib/push";

// Campaign audience is filtered by live_admin_campaigns() on the server.
// Client-side filters are intentionally not treated as an authorization boundary.
function loadLive() {
  return Promise.all([
    supabase.rpc("live_admin_campaigns"),
    supabase.rpc("live_advertiser_campaigns", { p_placement: "feed" })
  ]).then(([admin, external]) => {
    const a = admin.error ? [] : (admin.data || []);
    const b = external.error ? [] : (external.data || []).map(c => ({
      ...c, seller_type: "advertiser", campaign_type: "external_ad",
      primary_url: c.destination_url, advertiser_brand: c.brand_name, _source: "advertiser"
    }));
    return [...b, ...a];
  }).catch(() => []);
}
const track = (campaign, event, placement = "feed") => {
  try {
    if (campaign?._source === "advertiser") void supabase.rpc("track_advertiser_campaign", { p_id: campaign.id, p_event: event, p_placement: placement });
    else void supabase.rpc("track_admin_campaign", { p_id: campaign.id, p_event: event });
  } catch {}
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
        track(c, "view");
      }
    });
  }, [list.map(c => c.id).join("|")]);
  const [prods, setProds] = useState({});
  const pids = list.map(c => c.product_id).filter(Boolean).join(",");
  useEffect(() => {
    if (!pids) return;
    Promise.resolve(supabase.from("products").select("id,shop_id,name,price,stock").in("id", pids.split(",")))
      .then(({ data }) => setProds(Object.fromEntries((data || []).map(p => [p.id, p])))).catch(() => {});
  }, [pids]);
  const [perm, setPerm] = useState(pushPermission());
  const [pushMsg, setPushMsg] = useState("");
  useEffect(() => {
    // If the browser permission was granted earlier, refresh/register this user's token.
    if (pushSupported() && pushPermission() === "granted") {
      enablePush().catch(error => setPushMsg(error?.message || "Push token register nahi hua."));
    }
  }, []);
  const turnOn = async () => { try { await enablePush(); setPerm("granted"); setPushMsg("Notification chalu ho gaya."); } catch (e) { setPerm(pushPermission()); setPushMsg(e.message); } };
  const optIn = pushSupported() && perm !== "granted" && perm !== "denied"
    ? <div className="flex items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3"><span className="text-xs text-violet-800">🔔 Naye offers ka notification paayein</span><button onClick={turnOn} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">Chalu karein</button></div> : null;
  if (!list.length) return optIn ? <div className={className}>{optIn}{pushMsg && <div className="mt-1 text-[11px] text-slate-500">{pushMsg}</div>}</div> : null;
  const openProduct = c => {
    track(c, "product_open");
    try { sessionStorage.setItem("ns_order_campaign", JSON.stringify({ productId: c.product_id, campaignId: c.id })); } catch {}
    window.dispatchEvent(new CustomEvent("nearshop:open-product", { detail: { shopId: c.shop_id, productId: c.product_id, campaignId: c.id } }));
  };
  const close = id => {
    const n = [...gone, id];
    setGone(n);
    try { localStorage.setItem(DKEY, JSON.stringify(n)); } catch {}
  };
  const open = c => {
    track(c, "click");
    const u = safeUrl(c.primary_url) || (c.whatsapp_number ? `https://wa.me/${String(c.whatsapp_number).replace(/[^0-9]/g,"")}` : "") || safeUrl(c.video_url);
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };
  return <section className={`space-y-3 ${className}`} aria-label="NearShop campaigns">
    {optIn}
    {pushMsg && <div className="text-[11px] text-slate-500">{pushMsg}</div>}
    {list.map(c => {
      const url = safeUrl(c.primary_url) || (c.whatsapp_number ? `https://wa.me/${String(c.whatsapp_number).replace(/[^0-9]/g,"")}` : "") || safeUrl(c.video_url);
      const lp = c.product_id ? prods[c.product_id] : null;
      return <article key={c.id} className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
        <button onClick={() => close(c.id)} aria-label="Campaign band karein" className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-black/50 text-xs text-white">✕</button>
        {c.image_url && <img src={c.image_url} alt="" loading="lazy" className={`block w-full object-cover ${compact ? "max-h-36" : "max-h-64"}`} />}
        {!c.image_url && c.video_url && <video src={c.video_url} controls playsInline className={`block w-full bg-black ${compact ? "max-h-36" : "max-h-64"}`} />}
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">{c._source === "advertiser" ? `Sponsored · ${c.advertiser_brand || "Brand"}` : c.seller_type === "platform" ? "NearShop Official" : "Sponsored"}</div>
          <div className="mt-1 text-sm font-extrabold text-slate-900">{c.title}</div>
          {!!c.body && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{c.body}</p>}
          {c.product_id && lp ? <div className="mt-2 text-sm font-bold text-emerald-700">{lp.name} · {money(lp.price)}{Number(lp.stock) <= 0 && <span className="ml-2 text-xs font-semibold text-red-600">Stock khatam</span>}</div> : c.campaign_type === "store_product" && c.product_price != null && <div className="mt-2 text-sm font-bold text-emerald-700">{c.product_name} · {money(c.product_price)}</div>}
          {c.campaign_type === "feature_offer" && c.discount_value != null && <div className="mt-2 text-xs font-bold text-amber-700">{c.discount_type === "fixed" ? money(c.discount_value) : c.discount_value + "%"} OFF{c.coupon_code ? ` · Code: ${c.coupon_code}` : ""}</div>}
          {c.product_id && c.shop_id && <button onClick={() => openProduct(c)} className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white">{c.button_text || "Product dekhein"}</button>}
          {!(c.product_id && c.shop_id) && url && <button onClick={() => open(c)} className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white">{c.button_text || "Abhi Dekhein"}</button>}
        </div>
      </article>;
    })}
  </section>;
}
