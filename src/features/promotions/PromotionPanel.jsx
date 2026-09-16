import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { PROMOTION_OPTIONS } from './promotionService';
import { BadgePercent, Bell, Megaphone, Store, Zap } from '../../shared/icons';

export default function PromotionPanel({ shops, onPromote }) {
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [type, setType] = useState('shop_boost');
  const [productId, setProductId] = useState('');
  const [discount, setDiscount] = useState('');
  const [message, setMessage] = useState('');
  const [coupon, setCoupon] = useState('');
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [demand, setDemand] = useState([]);

  useEffect(() => { if (!shopId && shops[0]) setShopId(shops[0].id); }, [shops, shopId]);
  const shop = shops.find(s => s.id === shopId) || shops[0];
  const products = shop?.products || [];
  const option = PROMOTION_OPTIONS.find(x => x.key === type) || PROMOTION_OPTIONS[0];
  const charge = option.price * Math.max(1, Math.ceil(Number(hours || 24) / 24));
  useEffect(() => { if (!productId && products[0]) setProductId(products[0].id); }, [products, productId]);

  useEffect(() => {
    let alive = true;
    supabase.from('search_events').select('query,created_at,category').order('created_at', { ascending: false }).limit(250).then(({ data }) => {
      if (!alive) return;
      const map = {};
      (data || []).forEach(r => { const q = String(r.query || '').trim().toLowerCase(); if (q) map[q] = (map[q] || 0) + 1; });
      setDemand(Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([query,count])=>({query,count})));
    });
    return () => { alive = false; };
  }, [shopId]);

  const preview = useMemo(() => {
    const p = products.find(x => x.id === productId);
    const pct = Number(discount) || 0;
    return p && pct > 0 && pct < 100 ? +(Number(p.price) * (1 - pct / 100)).toFixed(2) : null;
  }, [products, productId, discount]);

  const submit = async () => {
    if (!shop) return alert('Pehle shop select kariye.');
    if (option.scope === 'product' && !products.find(p => p.id === productId)) return alert('Product select kariye.');
    if (type === 'discount' || type === 'flash') {
      if (!(Number(discount) > 0 && Number(discount) < 100)) return alert('1-99% discount daaliye.');
    }
    if ((type === 'announcement' || type === 'new_stock') && !message.trim()) return alert('Customer ko dikhane ke liye message likhiye.');
    if (type === 'coupon' && !coupon.trim()) return alert('Coupon offer likhiye.');
    setBusy(true);
    try {
      await onPromote({ shopId: shop.id, productId, type, amount: charge, hours, discount: Number(discount) || 0, message: message.trim(), coupon: coupon.trim() });
      setMessage(''); setCoupon(''); setDiscount('');
    } finally { setBusy(false); }
  };

  return <div className="bg-white rounded-2xl p-4 border border-violet-100">
    <div className="flex items-center gap-2 font-extrabold text-sm"><Zap size={16} className="text-violet-600"/> Promote — customer attention lo</div>
    <div className="text-[11px] text-gray-400 mt-1 mb-3">₹10 se start. Paid placement ko hamesha Sponsored/Promoted label milega.</div>
    <select value={shop?.id || ''} onChange={e=>setShopId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-2 bg-white">
      {shops.map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}
    </select>
    <select value={type} onChange={e=>setType(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-2 bg-white">
      {PROMOTION_OPTIONS.map(x=><option key={x.key} value={x.key}>{x.label} — ₹{x.price}/day</option>)}
    </select>
    {option.scope === 'product' && <select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-2 bg-white">{products.map(p=><option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}</select>}
    {(type === 'discount' || type === 'flash') && <><input value={discount} onChange={e=>setDiscount(e.target.value.replace(/\D/g,''))} placeholder="Discount %" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>{preview && <div className="bg-emerald-50 rounded-xl p-2 text-xs mb-2">₹{products.find(p=>p.id===productId)?.price} → <b>₹{preview}</b></div>}</>}
    {(type === 'announcement' || type === 'new_stock') && <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={type==='new_stock'?'Example: New baby diapers stock aa gaya':'Example: Imported baby diapers available'} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>}
    {type === 'coupon' && <input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Example: ₹100 OFF above ₹1000" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>}
    <div className="flex items-center gap-2 mb-2"><span className="text-xs text-gray-500">Duration</span><select value={hours} onChange={e=>setHours(Number(e.target.value))} className="flex-1 border rounded-xl px-3 py-2 text-sm"><option value={24}>24 hours</option><option value={48}>2 days</option><option value={72}>3 days</option><option value={168}>7 days</option></select></div>
    <button disabled={busy} onClick={submit} className="w-full bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold">{busy?'Saving…':`🚀 Start for ₹${charge}`}</button>
    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100"><div className="font-bold text-xs flex items-center gap-1"><Bell size={13}/> Demand Alert</div><div className="text-[10px] text-gray-500 mt-1">Recent customers ne kya search kiya:</div>{demand.length?demand.map(x=><div key={x.query} className="flex justify-between text-xs mt-1"><span>{x.query}</span><b>{x.count} searches</b></div>):<div className="text-[10px] text-gray-400 mt-1">Abhi enough search data nahi.</div>}</div>
    <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 rounded-xl p-2">🎯 Need It customer request <b>FREE</b> rahega — isme lead fee nahi lagayi.</div>
  </div>;
}
