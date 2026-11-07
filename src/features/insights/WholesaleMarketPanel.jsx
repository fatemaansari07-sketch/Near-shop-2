import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";
import { DEFAULT_PLATFORM_PRICING, mergePricingSettings } from "../promotions/pricingConfig";

export default function WholesaleMarketPanel({ shop, onUpdateShopSettings }) {
  const [pricing, setPricing] = useState(DEFAULT_PLATFORM_PRICING);
  const [sales, setSales] = useState([]);
  const [stateSales, setStateSales] = useState([]);
  const [searches, setSearches] = useState([]);
  const [seasonality, setSeasonality] = useState([]);
  const [busy, setBusy] = useState(false);
  const plan = shop?.wholesaleMarketIntelligence || {};
  const active = Boolean(plan.active && (!plan.expiresAt || new Date(plan.expiresAt).getTime() > Date.now()));

  useEffect(() => {
    let live = true;
    supabase.from("platform_settings").select("settings").eq("id", "pricing").maybeSingle()
      .then(({ data }) => { if (live && data?.settings) setPricing(mergePricingSettings(data.settings)); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    if (!active) return () => { live = false; };
    (async () => {
      const [s, st, q, m] = await Promise.all([
        supabase.from("wholesale_market_insights").select("*").eq("category", shop.category).eq("city", shop.city).order("units_sold", { ascending: false }).limit(8),
        supabase.from("wholesale_state_market_insights").select("*").eq("category", shop.category).eq("state", shop.state).order("units_sold", { ascending: false }).limit(8),
        supabase.from("wholesale_search_insights").select("*").eq("category", shop.category).order("searches", { ascending: false }).limit(8),
        supabase.from("wholesale_seasonality_insights").select("*").eq("category", shop.category).order("sales_month", { ascending: false }).limit(12),
      ]);
      if (!live) return;
      setSales(s.data || []); setStateSales(st.data || []); setSearches(q.data || []); setSeasonality(m.data || []);
    })();
    return () => { live = false; };
  }, [active, shop.id, shop.category, shop.city, shop.state]);

  const activate = async () => {
    if (!window.confirm(`₹${pricing.wholesale.market_intelligence_monthly}/month ka Wholesale Market Intelligence activate karein? Abhi payment gateway test mode me hai; koi real payment nahi katega.`)) return;
    setBusy(true);
    const now = new Date();
    const value = { active: true, status: "mock_active", startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(), price: Number(pricing.wholesale.market_intelligence_monthly), category: shop.category };
    await onUpdateShopSettings?.(shop.id, { wholesale_market_intelligence: value });
    setBusy(false);
  };

  return <section className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
    <div className="flex items-start justify-between gap-2"><div><div className="font-extrabold text-sm">📊 Wholesale Market Intelligence</div><div className="text-[11px] text-gray-500 mt-1">{shop.category} category · {shop.city || "City not set"}</div></div><span className="text-xs font-bold text-amber-700">{formatINR(pricing.wholesale.market_intelligence_monthly)}/month</span></div>
    <div className="text-[11px] text-gray-600">Pata chalega ki market me kaunse products move ho rahe hain, kaunse searches badh rahe hain aur monthly demand ka trend kya hai.</div>
    {!active ? <button disabled={busy} onClick={activate} className="w-full rounded-xl bg-amber-500 text-white py-3 text-xs font-bold disabled:opacity-50">{busy ? "Please wait..." : "Activate 30 days (test mode)"}</button> : <>
      <div className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-lg">Active · expires {new Date(plan.expiresAt).toLocaleDateString("en-IN")} · anonymized aggregate data only</div>
      <div><div className="font-bold text-xs mb-2">Top products sold in your city</div>{sales.length ? sales.map((x,i)=><div key={`${x.product_name}-${i}`} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{x.product_name}</span><b>{Number(x.units_sold).toLocaleString("en-IN")} units</b></div>) : <div className="text-[11px] text-gray-400">Abhi 5 alag shops ka minimum aggregate data available nahi hai.</div>}</div>
      <div><div className="font-bold text-xs mb-2">Top products across {shop.state || "your state"}</div>{stateSales.length ? stateSales.map((x,i)=><div key={`${x.product_name}-${i}`} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{x.product_name}</span><b>{Number(x.units_sold).toLocaleString("en-IN")} units</b></div>) : <div className="text-[11px] text-gray-400">State-level data ke liye 5 alag shops ka threshold abhi poora nahi hua.</div>}</div>
      <div><div className="font-bold text-xs mb-2">Rising search demand</div>{searches.length ? searches.map((x,i)=><div key={`${x.query}-${i}`} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{x.query} <span className="text-gray-400">· {x.area || "Area not set"}</span></span><b>{x.searches} searches</b></div>) : <div className="text-[11px] text-gray-400">5 alag logged-in customers ka threshold abhi poora nahi hua.</div>}</div>
      <div><div className="font-bold text-xs mb-2">Monthly sales trend</div>{seasonality.length ? seasonality.map((x,i)=><div key={`${x.product_name}-${x.sales_month}-${i}`} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{x.product_name} · {new Date(x.sales_month).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}</span><b>{Number(x.units_sold).toLocaleString("en-IN")}</b></div>) : <div className="text-[11px] text-gray-400">Seasonality ke liye abhi sufficient aggregate sales nahi.</div>}</div>
    </>}
    <div className="text-[10px] text-gray-400">Privacy: kisi individual shop ki sales, customer, selling price, stock ya expiry nahi dikhayi jaati. Data sirf 5+ shops / 5+ unique searchers ke aggregate par dikhaya jaata hai.</div>
  </section>;
}
