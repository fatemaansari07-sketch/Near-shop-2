import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";
import { orderError } from "./OrderSheet";

export const STATUS = { placed: ["Shop ke jawab ka intezaar", "bg-amber-100 text-amber-700"], confirmed: ["Confirm ho gaya", "bg-blue-100 text-blue-700"], ready: ["Taiyaar — shop se le lein", "bg-emerald-100 text-emerald-700"], completed: ["Poora hua", "bg-gray-100 text-gray-600"], cancelled: ["Cancel", "bg-red-100 text-red-600"], rejected: ["Shop ne mana kiya", "bg-red-100 text-red-600"] };

export default function MyOrders({ onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { const { data, error } = await supabase.rpc("my_orders"); if (error) setErr(orderError(error)); else setRows(data || []); }, []);
  useEffect(() => { load(); }, [load]);
  const cancel = async o => { if (!window.confirm("Order cancel karein?")) return; const { error } = await supabase.rpc("cancel_my_order", { p_order: o.id }); if (error) setErr(orderError(error)); else load(); };
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-50">
    <div className="mx-auto max-w-md pb-10">
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm"><button onClick={onClose}><ArrowLeft size={20} /></button><h2 className="font-extrabold">Mere Orders</h2><button onClick={load} className="ml-auto text-xs font-bold text-emerald-700">Refresh</button></div>
      {err && <div className="m-4 rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</div>}
      {rows && !rows.length && <p className="py-16 text-center text-sm text-gray-400">Abhi koi order nahi.</p>}
      <div className="space-y-3 p-4">{(rows || []).map(o => <div key={o.id} className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-extrabold">{o.shop_name}</div><div className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString("en-IN")}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS[o.status]?.[1]}`}>{STATUS[o.status]?.[0]}</span></div>
        <div className="mt-2 space-y-0.5 text-xs text-gray-600">{o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>{formatINR(i.line_total)}</span></div>)}</div>
        {Number(o.discount_amount) > 0 && <div className="mt-1 flex justify-between text-xs text-emerald-700"><span>Discount {o.coupon_code ? `(${o.coupon_code})` : ""}</span><span>− {formatINR(o.discount_amount)}</span></div>}
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-extrabold"><span>Total</span><span>{formatINR(o.total)}</span></div>
        {o.shop_note && <div className="mt-1 text-xs text-gray-500">Shop: {o.shop_note}</div>}
        <div className="mt-2 flex gap-4 text-xs font-bold">{o.status === "placed" && <button onClick={() => cancel(o)} className="text-red-600">Cancel karein</button>}{o.shop_phone && <a href={`tel:${o.shop_phone}`} className="text-emerald-700">Shop ko call</a>}</div>
      </div>)}</div>
    </div></div>;
}
