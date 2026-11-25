import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

// Live ads come from the admin panel (table app_ads). RLS already hides expired / paused ads.
let cache = { t: 0, rows: null, p: null };
export function loadLiveAds() {
  if (cache.rows && Date.now() - cache.t < 120000) return Promise.resolve(cache.rows);
  if (!cache.p) cache.p = supabase.from("app_ads").select("*").then(({ data }) => { cache = { t: Date.now(), rows: data || [], p: null }; return cache.rows; }).catch(() => { cache.p = null; return []; });
  return cache.p;
}
const live = (a) => a.active && new Date(a.starts_at) <= new Date() && new Date(a.ends_at) > new Date();
const track = (ad, event) => {
  try {
    if (ad?._source === "advertiser") supabase.rpc("track_advertiser_campaign", { p_id: ad.id, p_event: event, p_placement: ad.delivery_placement || "feed" });
    else supabase.rpc("ad_track", { p_id: ad.id, p_event: event });
  } catch {}
};

export function useAd(placement, seed = 0) {
  const [ad, setAd] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadLiveAds(),
      supabase.rpc("live_advertiser_campaigns", { p_placement: placement }).catch(() => ({ data: [] }))
    ]).then(([rows, externalResult]) => {
      if (!alive) return;
      const regular = (rows || []).filter((a) => live(a) && (a.placements || []).includes(placement));
      const external = (externalResult?.data || []).map(c => ({
        id: c.id, _source: "advertiser", kind: "external", title: c.title, body: c.body,
        image_url: c.image_url, video_url: c.video_url, link_url: c.destination_url ||
          (c.whatsapp_number ? `https://wa.me/${String(c.whatsapp_number).replace(/[^0-9]/g,"")}` : ""),
        button_text: c.button_text, brand_name: c.brand_name, delivery_placement: placement, active: true,
        starts_at: new Date(0).toISOString(), ends_at: new Date(Date.now()+86400000).toISOString(),
        placements: [placement]
      }));
      const list = [...external, ...regular];
      setAd(list.length ? list[Math.floor((Date.now() / 60000 + seed) % list.length)] : null);
    }).catch(() => { if (alive) setAd(null); });
    return () => { alive = false; };
  }, [placement, seed]);
  return ad;
}
export const openAd = (ad) => {
  track(ad, "click");
  const url = ad?.link_url;
  if (url && /^https:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
};

export default function AdSlot({ placement, seed = 0, className = "" }) {
  const ad = useAd(placement, seed);
  const seen = useRef(null);
  useEffect(() => { if (ad && seen.current !== `${ad._source || "admin"}:${ad.id}`) { seen.current = `${ad._source || "admin"}:${ad.id}`; track(ad, "view"); } }, [ad]);
  if (!ad) return null;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-gray-400"><span className="font-bold tracking-wide">AD · {ad._source === "advertiser" ? `Sponsored · ${ad.brand_name || "Brand"}` : ad.kind === "affiliate" ? "Sponsored link" : "Promoted"}</span></div>
      {ad.image_url && <img src={ad.image_url} alt="" loading="lazy" className="w-full h-auto block mt-2" />}
      {!ad.image_url && ad.video_url && <video src={ad.video_url} controls playsInline className="w-full max-h-56 bg-black mt-2" />}
      <div className="px-4 py-3">
        <div className="font-bold text-sm text-gray-800">{ad.title}</div>
        {ad.body && <div className="text-xs text-gray-500 mt-1">{ad.body}</div>}
        <button onClick={() => openAd(ad)} className="mt-3 w-full bg-violet-600 text-white text-sm font-bold py-2.5 rounded-xl">{ad.button_text || "Dekhein"}</button>
        {ad.kind === "affiliate" && <div className="text-[9px] text-gray-400 mt-1.5">Is link se kharidne par humein commission mil sakta hai.</div>}
      </div>
    </div>
  );
}
