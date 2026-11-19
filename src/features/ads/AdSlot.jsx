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
const track = (id, event) => { try { supabase.rpc("ad_track", { p_id: id, p_event: event }); } catch {} };

export function useAd(placement, seed = 0) {
  const [ad, setAd] = useState(null);
  useEffect(() => {
    let alive = true;
    loadLiveAds().then((rows) => {
      if (!alive) return;
      const list = (rows || []).filter((a) => live(a) && (a.placements || []).includes(placement));
      setAd(list.length ? list[Math.floor((Date.now() / 60000 + seed) % list.length)] : null);
    });
    return () => { alive = false; };
  }, [placement, seed]);
  return ad;
}
export const openAd = (ad) => { track(ad.id, "click"); window.open(ad.link_url, "_blank", "noopener,noreferrer"); };

export default function AdSlot({ placement, seed = 0, className = "" }) {
  const ad = useAd(placement, seed);
  const seen = useRef(null);
  useEffect(() => { if (ad && seen.current !== ad.id) { seen.current = ad.id; track(ad.id, "view"); } }, [ad]);
  if (!ad) return null;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-gray-400"><span className="font-bold tracking-wide">AD · {ad.kind === "affiliate" ? "Sponsored link" : "Promoted"}</span></div>
      {ad.image_url && <img src={ad.image_url} alt="" loading="lazy" className="w-full h-auto block mt-2" />}
      <div className="px-4 py-3">
        <div className="font-bold text-sm text-gray-800">{ad.title}</div>
        {ad.body && <div className="text-xs text-gray-500 mt-1">{ad.body}</div>}
        <button onClick={() => openAd(ad)} className="mt-3 w-full bg-violet-600 text-white text-sm font-bold py-2.5 rounded-xl">{ad.button_text || "Dekhein"}</button>
        {ad.kind === "affiliate" && <div className="text-[9px] text-gray-400 mt-1.5">Is link se kharidne par humein commission mil sakta hai.</div>}
      </div>
    </div>
  );
}
