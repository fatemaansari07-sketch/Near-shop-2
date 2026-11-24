import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";
import { STATUS } from "./MyOrders";
import { orderError, pushOrder } from "./OrderSheet";

const NEXT = { placed: [["confirmed", "Confirm (stock kam hoga)", "bg-emerald-600"], ["rejected", "Mana karein", "bg-red-600"]], confirmed: [["ready", "Taiyaar hai", "bg-blue-600"], ["completed", "Diya gaya ✓", "bg-gray-800"], ["cancelled", "Cancel (stock wapas)", "bg-red-600"]], ready: [["completed", "Diya gaya ✓", "bg-gray-800"], ["cancelled", "Cancel (stock wapas)", "bg-red-600"]] };

export default function ShopOrdersPanel({ shops = [] }) {
  const [shopId, setShopId] = useState(shops[0]?.id || "");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(true);
  useEffect(() => { if (!shopId && shops[0]) setShopId(shops[0].id); }, [shops, shopId]);
  const load = useCallback(async () => {
    if (!shopId) return;
    const { data, error } = await supabase.rpc("shop_orders", { p_shop: shopId, p_open_only: open });
    if (error) setErr(orderError(error)); else { setErr(""); setRows(data || []); }
  }, [shopId, open]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const act = async (o, status) => {
    if (["rejected", "cancelled"].includes(status) && !window.confirm("Pakka?")) return;
    setBusy(o.id); setErr("");
    const { error } = await supabase.rpc("update_order_status", { p_order: o.id, p_status: status });
    setBusy(""); if (error) setErr(orderError(error)); else { pushOrder(o.id, "status"); load(); }
  };
  if (!shops.length) return null;
  return <section className="rounded-2xl border border-gray-100 bg-white p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold text-sm">📦 Customer Orders</h3>
      <div className="flex items-center gap-2 text-xs"><button onClick={() => setOpen(v => !v)} className="font-bold text-emerald-700">{open ? "Sab dekhein" : "Sirf naye"}</button><button onClick={load} className="font-bold text-gray-500">Refresh</button></div></div>
    {shops.length > 1 && <select value={shopId} onChange={e => setShopId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm">{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
    {err && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{err}</div>}
    {!rows.length && <p className="py-6 text-center text-xs text-gray-400">{open ? "Koi naya order nahi." : "Koi order nahi."}</p>}
    <div className="mt-2 space-y-3">{rows.map(o => <div key={o.id} className="rounded-xl border border-gray-100 p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-bold">{o.customer_name || "Customer"}</div>{o.customer_phone && <div className="flex gap-3 text-xs"><a href={`tel:${o.customer_phone}`} className="text-emerald-700">📞 {o.customer_phone}</a><a target="_blank" rel="noopener noreferrer" className="font-bold text-green-600" href={`https://wa.me/${o.customer_phone.length === 10 ? "91" + o.customer_phone : o.customer_phone}?text=${encodeURIComponent(`Namaste ${o.customer_name || ""}, aapka order (₹${o.total}) ${STATUS[o.status]?.[0] || ""}.`)}`}>WhatsApp</a></div>}</div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS[o.status]?.[1]}`}>{STATUS[o.status]?.[0]}</span></div>
      <div className="mt-2 space-y-0.5 text-xs text-gray-600">{o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>{formatINR(i.line_total)}</span></div>)}</div>
      {Number(o.discount_amount) > 0 && <div className="text-xs text-emerald-700">Discount {o.coupon_code ? `(${o.coupon_code})` : ""}: − {formatINR(o.discount_amount)}</div>}
      <div className="mt-1 flex justify-between border-t pt-1 text-sm font-extrabold"><span>Total lena hai</span><span>{formatINR(o.total)}</span></div>
      {o.note && <div className="mt-1 text-xs text-gray-500">Note: {o.note}</div>}
      <div className="mt-2 flex flex-wrap gap-2">{(NEXT[o.status] || []).map(([st, label, bg]) => <button key={st} disabled={busy === o.id} onClick={() => act(o, st)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${bg}`}>{label}</button>)}</div>
    </div>)}</div>
  </section>;
}
