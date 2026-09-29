import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { SPONSORED_ADS } from "../../data/mockData";
import { Store } from "../../shared/icons";

const _adImpressionCounts = {};
function pickFairAd(pool) {
  if (pool.length === 0) return null;
  const minCount = Math.min(...pool.map((a) => _adImpressionCounts[a.id] || 0));
  const leastShown = pool.filter((a) => (_adImpressionCounts[a.id] || 0) === minCount);
  const chosen = leastShown[Math.floor(Math.random() * leastShown.length)];
  _adImpressionCounts[chosen.id] = (_adImpressionCounts[chosen.id] || 0) + 1;
  return chosen;
}

export function SponsoredLoadingCard({ realAds = [], onReportAd }) {
  const pool = useMemo(() => {
    const demo = SPONSORED_ADS.map((a) => ({ ...a, isReal: false }));
    const real = realAds.map((a) => ({
      id: a.id, brand: a.shopName, tagline: a.message, emoji: "📢",
      color: "from-violet-600 to-purple-700", isReal: true,
    }));
    return [...demo, ...real];
  }, [realAds]);

  const ad = useMemo(() => pickFairAd(pool), [pool]);
  if (!ad) return null;

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-4 bg-gradient-to-br ${ad.color} text-white flex items-center gap-3 animate-pulse`}>
        <div className="text-3xl">{ad.emoji}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] bg-white/25 inline-block px-2 py-0.5 rounded-full">SPONSORED</div>
            {ad.isReal && onReportAd && (
              <button onClick={() => onReportAd(ad.id)} className="text-[10px] text-white/70 underline">Report</button>
            )}
          </div>
          <div className="font-bold text-sm">{ad.brand}</div>
          <div className="text-xs text-white/90">{ad.tagline}</div>
        </div>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   FILE: screens/DiscoverTab.jsx
============================================================================ */

