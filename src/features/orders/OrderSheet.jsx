import React, { useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";

export const ORDER_CAMPAIGN_KEY = "ns_order_campaign";
export const readCampaignCtx = productId => { try { const c = JSON.parse(sessionStorage.getItem(ORDER_CAMPAIGN_KEY) || "null"); return c && c.productId === productId ? c.campaignId : null; } catch { return null; } };
export const pushOrder = (orderId, event) => { try { void supabase.functions.invoke("send-order-push", { body: { order_id: orderId, event } }); } catch {} };
export const orderError = e => String(e?.message || e || "").replace(/^[A-Z_]+:\s*/, "").replace("LOGIN_REQUIRED", "Login zaroori hai").replace(/STOCK_LOW:?\s*/, "Stock kam hai: ");

export default function OrderSheet({ product, shop, user, qty: qty0 = 1, unitLabel = "pcs", step = 1, maxQty = 1, onClose, onDone }) {
  const [qty, setQty] = useState(qty0);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [note, setNote] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [reqId] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : undefined));
  const campaignId = readCampaignCtx(product.id);
  const items = [{ product_id: product.id, qty }];
  const args = { p_shop: shop.id, p_items: items, p_coupon: coupon.trim() || null, p_campaign: coupon.trim() ? null : campaignId };

  const check = async (q = qty) => {
    setErr(""); setBusy(true);
    const { data, error } = await supabase.rpc("quote_order", { ...args, p_items: [{ product_id: product.id, qty: q }] });
    setBusy(false);
    if (error) { setQuote(null); setErr(orderError(error)); return false; }
    setQuote(data); return true;
  };
  React.useEffect(() => { check(qty); /* eslint-disable-next-line */ }, [qty, campaignId]);
  const place = async () => {
    if (!user?.id) return setErr("Order ke liye login karein.");
    setErr(""); setBusy(true);
    const { data, error } = await supabase.rpc("place_order", { p_shop: shop.id, p_items: items, p_name: name, p_phone: phone, p_note: note, p_coupon: args.p_coupon, p_campaign: args.p_campaign, p_request_id: reqId });
    setBusy(false);
    if (error) return setErr(orderError(error));
    try { sessionStorage.removeItem(ORDER_CAMPAIGN_KEY); } catch {}
    setDone(true); onDone?.(data);
    if (data?.order_id && !data.duplicate) pushOrder(data.order_id, "new");
  };

  return <div className="fixed inset-0 z-[70] flex items-end bg-black/50" onClick={onClose}>
    <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><h3 className="text-base font-extrabold">Order karein</h3><button onClick={onClose}><X size={20} /></button></div>
      {done ? <div className="py-8 text-center">
        <div className="text-4xl">✅</div>
        <div className="mt-2 font-extrabold">Order bhej diya!</div>
        <p className="mt-1 text-xs text-gray-500">Dukaan confirm karegi, phir aap shop se saaman le sakte hain aur wahin payment karein. Status "Mere Orders" me dikhega.</p>
        <button onClick={onClose} className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white">Theek hai</button>
      </div> : <>
        <div className="mt-3 text-sm font-bold">{product.name} <span className="font-normal text-gray-400">· {shop.name}</span></div>
        <div className="mt-3 flex items-center justify-between"><span className="text-sm font-bold">Quantity ({unitLabel})</span>
          <div className="flex items-center gap-3"><button onClick={() => setQty(q => Math.max(step, +(q - step).toFixed(3)))} className="h-8 w-8 rounded-full border"><Minus size={14} className="mx-auto" /></button><b className="w-8 text-center">{qty}</b><button onClick={() => setQty(q => Math.min(maxQty, +(q + step).toFixed(3)))} className="h-8 w-8 rounded-full border"><Plus size={14} className="mx-auto" /></button></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Aapka naam" className="rounded-xl border px-3 py-2.5 text-sm" />
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="numeric" placeholder="Phone" className="rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
        <div className="mt-2 flex gap-2"><input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code (optional)" className="flex-1 rounded-xl border px-3 py-2.5 text-sm" /><button onClick={() => check()} className="rounded-xl bg-gray-900 px-4 text-xs font-bold text-white">Lagayein</button></div>
        {campaignId && !coupon && <div className="mt-1 text-[11px] text-violet-700">Campaign offer automatically lagega.</div>}
        {quote && <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(quote.subtotal)}</span></div>
          {Number(quote.discount) > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>− {formatINR(quote.discount)}</span></div>}
          <div className="mt-1 flex justify-between border-t pt-1 font-extrabold"><span>Total (shop pe dein)</span><span>{formatINR(quote.total)}</span></div>
        </div>}
        {err && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{err}</div>}
        <button disabled={busy || !quote} onClick={place} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white disabled:opacity-50">{busy ? "Ruko…" : "Order bhejein (shop pe payment)"}</button>
        <p className="mt-2 text-center text-[10px] text-gray-400">Price aur discount server se check hote hain. Stock dukaan ke confirm karne par kam hota hai.</p>
      </>}
    </div></div>;
}
