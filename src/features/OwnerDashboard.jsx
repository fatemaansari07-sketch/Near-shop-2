import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";
import { planRank, DEFAULT_PLANS } from "../../lib/platform";

const iso = (d) => d.toISOString().slice(0, 10);
const TONES = { violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700" };
const Tile = ({ label, value, tone = "violet" }) => <div className={`rounded-2xl p-3 ${TONES[tone].split(" ")[0]}`}><div className="text-[10px] text-gray-500">{label}</div><div className={`text-lg font-extrabold ${TONES[tone].split(" ")[1]}`}>{value}</div></div>;
const Locked = ({ title }) => <div className="bg-gray-100 rounded-2xl p-4 text-center text-xs text-gray-500">🔒 {title} — Business Pro plan me</div>;

// Combined multi-shop dashboard. All numbers come from the owner_business_overview RPC, which re-checks ownership
// and plan on the server and returns aggregates only (no customer identity).
export function OwnerDashboard({ shops, plan, plans = DEFAULT_PLANS, onBack, onOpenShopReport }) {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true); setErr("");
    supabase.rpc("owner_business_overview", { p_from: new Date(from + "T00:00:00+05:30").toISOString(), p_to: new Date(to + "T23:59:59+05:30").toISOString() })
      .then(({ data, error }) => { if (!live) return; if (error) setErr(error.message); else setData(data); setLoading(false); });
    return () => { live = false; };
  }, [from, to, plan]);
  const rank = planRank(data?.plan || plan);
  const totals = useMemo(() => {
    const sh = data?.shops || [];
    return { shops: sh.length, products: sh.reduce((a, x) => a + Number(x.products), 0), revenue: sh.reduce((a, x) => a + Number(x.revenue), 0), udhar: sh.reduce((a, x) => a + Number(x.pending_udhar), 0), low: sh.reduce((a, x) => a + Number(x.low_stock), 0) };
  }, [data]);
  const daily = useMemo(() => { const m = {}; (data?.daily || []).forEach((r) => { m[r.day] = (m[r.day] || 0) + Number(r.revenue); }); return Object.entries(m).map(([day, revenue]) => ({ day: day.slice(5), revenue })); }, [data]);
  const maxRev = Math.max(1, ...(data?.shops || []).map((x) => Number(x.revenue)));
  const planNames = ["free", "multi_shop", "business_pro"].map((k) => `${plans[k]?.label} ₹${plans[k]?.price}/mo`).join(" · ");

  return <div className="pb-24 min-h-screen bg-gray-50">
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-5 rounded-b-3xl text-white"><button onClick={onBack} className="mb-2 p-1"><ArrowLeft size={20}/></button><div className="text-xl font-extrabold">All Shops Dashboard</div><div className="text-white/80 text-xs">Plan: {plans[data?.plan || plan]?.label || plan}</div></div>
    <div className="px-5 mt-4 space-y-3">
      {err.includes("PLAN_REQUIRED") ? <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm"><div className="font-extrabold mb-1">Combined dashboard locked hai</div><div className="text-xs text-gray-500">Multiple shops ka combined dashboard Multi-Shop ya Business Pro plan me milta hai.<br/>{planNames}<br/>Abhi online payment connect nahi hai — plan NearShop admin activate karta hai. Har shop ka apna report "Report" button se milta rahega.</div></div>
      : err ? <div className="bg-red-50 text-red-700 text-xs rounded-2xl p-3">{err}</div> : <>
      <div className="flex gap-2"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="flex-1 border rounded-xl px-2 py-2 text-xs bg-white"/><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="flex-1 border rounded-xl px-2 py-2 text-xs bg-white"/></div>
      {loading && <div className="text-xs text-gray-400">Loading…</div>}
      {data && <>
        <div className="grid grid-cols-2 gap-2"><Tile label="Total shops" value={totals.shops}/><Tile label="Total products" value={totals.products}/><Tile label="Combined sales" value={formatINR(totals.revenue)} tone="emerald"/><Tile label="Pending Udhar" value={formatINR(totals.udhar)} tone="amber"/></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Shop-wise performance</div>
          {data.shops.map((x) => <div key={x.shop_id} className="mb-3"><div className="flex justify-between text-xs"><button onClick={() => onOpenShopReport(x.shop_id)} className="font-bold text-violet-700 text-left truncate">{x.name} ›</button><span className="font-bold">{formatINR(Number(x.revenue))}</span></div><div className="h-2 rounded bg-gray-100 mt-1"><div className="h-2 rounded bg-violet-500" style={{ width: `${(Number(x.revenue) / maxRev) * 100}%` }}/></div><div className="text-[10px] text-gray-400 mt-0.5">{x.bills} bills · {x.products} products · low stock {x.low_stock} · udhar {formatINR(Number(x.pending_udhar))}</div></div>)}</div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Best-selling products{rank < 2 ? " (top 5)" : ""}</div>{data.best_sellers.length === 0 && <div className="text-xs text-gray-400">Is period me sales nahi.</div>}{data.best_sellers.map((b) => <div key={b.name} className="flex justify-between text-xs py-1.5 border-b border-gray-50"><span className="truncate pr-2">{b.name} <span className="text-gray-400">· {b.shops} shop</span></span><b>{formatINR(Number(b.revenue))}</b></div>)}</div>
        {rank >= 2 ? <>
          {daily.length > 0 && <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Date-wise sales</div><div style={{ height: 160 }}><ResponsiveContainer><BarChart data={daily}><XAxis dataKey="day" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }} width={40}/><Tooltip/><Bar dataKey="revenue" fill="#7C3AED" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></div>}
          <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Slow-moving / non-selling</div>{data.slow_moving.length === 0 && <div className="text-xs text-gray-400">Koi nahi 🎉</div>}{data.slow_moving.map((b, i) => <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-50"><span className="truncate pr-2">{b.name} <span className="text-gray-400">· {b.shop}</span></span><span>stock {b.stock}</span></div>)}</div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Stock alerts</div>{data.stock_alerts.length === 0 && <div className="text-xs text-gray-400">Sab theek.</div>}{data.stock_alerts.map((b, i) => <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-50"><span className="truncate pr-2">{b.name} <span className="text-gray-400">· {b.shop}</span></span><b className="text-red-500">{b.stock}</b></div>)}</div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-1">Search demand insights</div><div className="text-[10px] text-gray-400 mb-2">Sirf aggregate (kam se kam 5 alag customers). Kisi customer ki pehchaan nahi dikhti.</div>{data.search_demand.length === 0 && <div className="text-xs text-gray-400">Abhi kaafi data nahi.</div>}{data.search_demand.map((b, i) => <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-50"><span className="truncate pr-2">{b.query} <span className="text-gray-400">· {b.category || "—"} · {b.area || "—"}</span></span><b>{b.searches}</b></div>)}</div>
        </> : <><Locked title="Date-wise reports, slow-moving products, stock alerts list & search demand"/></>}
      </>}
    </>}
    </div>
  </div>;
}
