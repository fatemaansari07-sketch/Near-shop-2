import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { formatINR, daysToExpiry } from "../../data/mockData";
import { displayPackStock } from "../../lib/inventory";
import ShopPicker from "../../components/ShopPicker";

const card = "bg-white rounded-2xl p-4 border border-gray-100";
const stockText = (p) => (p.unit === "pack" ? displayPackStock(p.stock, p.packSize || 10) : `${p.stock ?? 0} ${({ weight: "kg", volume: "L", length: "m" }[p.unit] || "pcs")}`);

// 4) Staff-wise sales: who sold how much, per shop. Only bills made after the SQL migration carry a seller.
export function StaffSales({ from, to }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    supabase.rpc("owner_staff_sales", { p_from: new Date(from + "T00:00:00+05:30").toISOString(), p_to: new Date(to + "T23:59:59+05:30").toISOString() })
      .then(({ data, error }) => { if (!live) return; if (error) setErr(error.message); else setRows(data || []); });
    return () => { live = false; };
  }, [from, to]);
  const byShop = useMemo(() => { const m = new Map(); (rows || []).forEach((r) => { if (!m.has(r.shop_id)) m.set(r.shop_id, { name: r.shop_name, list: [] }); m.get(r.shop_id).list.push(r); }); return [...m.values()]; }, [rows]);
  return <div className={card}>
    <div className="font-extrabold text-sm mb-1">👥 Staff-wise sales</div>
    <div className="text-[10px] text-gray-400 mb-2">Kis ne kitni bikri ki (selected dates). Purane bills me seller ka record nahi hota.</div>
    {err && <div className="text-[11px] text-red-600">{err.includes("owner_staff_sales") ? "Database update baaki hai (SQL 20261115 chalayein)." : err}</div>}
    {!rows && !err && <div className="text-xs text-gray-400">Loading…</div>}
    {rows && !rows.length && <div className="text-xs text-gray-400">Is date range me koi bill nahi.</div>}
    {byShop.map((sh) => <div key={sh.name} className="mt-2"><div className="text-xs font-bold text-violet-700">🏪 {sh.name}</div>
      {sh.list.map((r, i) => <div key={i} className="flex justify-between text-xs py-1.5 border-t border-gray-50"><div className="min-w-0 truncate">{r.name}{r.is_owner ? " (owner)" : r.user_id ? " (staff)" : ""}<span className="text-gray-400"> · {r.bills} bill</span></div><b className="shrink-0">{formatINR(r.total)}</b></div>)}
    </div>)}
  </div>;
}

// 5) One discount, many shops. Pick a product name that exists in your shops, choose %, apply to every shop that has it.
export function BulkDiscount({ shops, onApply }) {
  const [q, setQ] = useState("");
  const [pct, setPct] = useState(10);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("all");
  const [picked, setPicked] = useState(() => new Set());
  const term = q.trim().toLowerCase();
  const groups = useMemo(() => {
    if (term.length < 2) return [];
    const m = new Map();
    shops.forEach((sh) => (sh.products || []).forEach((p) => {
      if (p.archived_at || !String(p.name || "").toLowerCase().includes(term)) return;
      const k = String(p.name).trim().toLowerCase();
      if (!m.has(k)) m.set(k, { name: p.name, targets: [] });
      m.get(k).targets.push({ shopId: sh.id, shop: sh.name, productId: p.id, price: Number(p.price) || 0 });
    }));
    return [...m.values()].slice(0, 8);
  }, [shops, term]);
  const chosen0 = pick && groups.find((g) => g.name === pick);
  const chosen = chosen0 && { ...chosen0, targets: mode === "pick" ? chosen0.targets.filter((t) => picked.has(t.shopId)) : chosen0.targets };
  const go = async () => {
    if (!chosen || busy || !chosen.targets.length) return;
    if (!window.confirm(`"${chosen.name}" par ${pct}% discount ${chosen.targets.length} dukaan me lagana hai? (24 ghante)`)) return;
    setBusy(true); await onApply?.(chosen.targets, pct); setBusy(false);
  };
  return <div className={card}>
    <div className="font-extrabold text-sm mb-1">🏷️ Ek click me sab dukaano par discount</div>
    <div className="text-[10px] text-gray-400 mb-2">Product chuno, % chuno. Jis jis dukan me ye product hai wahan Deals me lag jayega.</div>
    <input value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder="Product ka naam" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
    {groups.map((g) => <button key={g.name} onClick={() => setPick(g.name)} className={`w-full text-left mt-2 rounded-xl border px-3 py-2 text-xs ${pick === g.name ? "border-violet-400 bg-violet-50" : "border-gray-100"}`}>
      <div className="font-bold">{g.name} <span className="text-gray-400 font-normal">· {g.targets.length} dukaan</span></div>
      <div className="text-[10px] text-gray-500">{g.targets.map((t) => `${t.shop} ${formatINR(t.price)}`).join(" · ")}</div></button>)}
    {term.length >= 2 && !groups.length && <div className="text-xs text-gray-400 mt-2">Koi product nahi mila.</div>}
    {chosen0 && <ShopPicker shops={shops.filter((x) => chosen0.targets.some((t) => t.shopId === x.id))} mode={mode} setMode={setMode} picked={picked} setPicked={setPicked} />}
    {chosen && <div className="mt-3">
      <div className="flex gap-2">{[5, 10, 15, 20, 30].map((v) => <button key={v} onClick={() => setPct(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${pct === v ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{v}%</button>)}</div>
      <div className="text-[11px] text-gray-500 mt-2">{chosen.targets.map((t) => `${t.shop}: ${formatINR(t.price)} → ${formatINR(+(t.price * (1 - pct / 100)).toFixed(2))}`).join("  ·  ")}</div>
      <button onClick={go} disabled={busy || !chosen.targets.length} className="w-full mt-2 bg-violet-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{busy ? "Laga raha hu…" : chosen.targets.length ? `${chosen.targets.length} dukaano par ${pct}% lagao` : "Pehle dukaan chuniye"}</button>
    </div>}
  </div>;
}

// 7) Expiry across all shops in one list.
export function ExpiryAcrossShops({ shops }) {
  const [days, setDays] = useState(30);
  const list = useMemo(() => shops.flatMap((sh) => (sh.products || []).filter((p) => !p.archived_at && p.expiryDate && Number(p.stock) > 0)
    .map((p) => ({ shop: sh.name, name: p.name, left: daysToExpiry(p.expiryDate), text: stockText(p) }))).filter((x) => x.left != null && x.left <= days).sort((a, b) => a.left - b.left), [shops, days]);
  return <div className={card}>
    <div className="flex items-center justify-between mb-2"><div className="font-extrabold text-sm">⏳ Expiry — sab dukaan</div>
      <div className="flex gap-1">{[7, 30, 60].map((d) => <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${days === d ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>{d} din</button>)}</div></div>
    {!list.length && <div className="text-xs text-gray-400">{days} din me koi expiry nahi 🎉</div>}
    {list.slice(0, 40).map((x, i) => <div key={i} className="flex justify-between text-xs py-1.5 border-t border-gray-50"><div className="min-w-0"><div className="font-semibold truncate">{x.name}</div><div className="text-[10px] text-gray-400">🏪 {x.shop} · stock {x.text}</div></div>
      <b className={`shrink-0 ${x.left < 0 ? "text-red-600" : x.left <= 7 ? "text-red-500" : "text-amber-600"}`}>{x.left < 0 ? "Expire" : x.left === 0 ? "Aaj" : `${x.left} din`}</b></div>)}
    {list.length > 40 && <div className="text-[10px] text-gray-400 mt-1">Aur {list.length - 40} items… (download me poori list)</div>}
  </div>;
}

// 9) CSV download (opens in Excel / Google Sheets). Built in the browser, nothing is uploaded.
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function downloadCsv(name, rows) {
  const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function ExportBar({ shops, overview }) {
  const today = new Date().toISOString().slice(0, 10);
  const stock = () => downloadCsv(`stock-${today}.csv`, [["Dukaan", "Product", "Stock", "Unit", "Price", "Expiry", "Barcode"], ...shops.flatMap((sh) => (sh.products || []).filter((p) => !p.archived_at).map((p) => [sh.name, p.name, p.stock, p.unit || "", p.price, p.expiryDate || "", p.barcode || ""]))]);
  const sales = () => downloadCsv(`sales-summary-${today}.csv`, [["Dukaan", "Bikri (Rs)", "Bills", "Udhar baaki (Rs)", "Kam stock items", "Products"], ...(overview?.shops || []).map((x) => [x.name, x.revenue, x.bills, x.pending_udhar, x.low_stock, x.products])]);
  return <div className={card}>
    <div className="font-extrabold text-sm mb-1">📥 Download (Excel / CSV)</div>
    <div className="text-[10px] text-gray-400 mb-2">File phone me download hogi, Excel ya Google Sheets me khul jayegi.</div>
    <div className="flex gap-2"><button onClick={stock} className="flex-1 bg-emerald-50 text-emerald-700 font-bold text-xs py-2.5 rounded-xl">Sab dukaan ka stock</button>
      <button onClick={sales} disabled={!overview?.shops?.length} className="flex-1 bg-violet-50 text-violet-700 disabled:opacity-40 font-bold text-xs py-2.5 rounded-xl">Sales summary</button></div>
  </div>;
}
