import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { PROMOTION_OPTIONS as ALL_PROMOTION_OPTIONS, PROMOTION_INFO, SHOP_LEVEL_NOTE } from './promotionService';
import { usePlatformFeatures } from '../../lib/platform';
import { DEFAULT_PLATFORM_PRICING, mergePricingSettings } from './pricingConfig';
import { BadgePercent, Bell, Megaphone, Store, Zap } from '../../shared/icons';

export default function PromotionPanel({ shops, onPromote }) {
  const { isOn } = usePlatformFeatures();
  // Admin-disabled promotion types are hidden here; the database also rejects them (see migration).
  const options = ALL_PROMOTION_OPTIONS.filter((x) => isOn(x.key));
  if (options.length === 0) return <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm text-gray-500">Promotions abhi admin ne band kiye hain.</div>;
  return <PromotionPanelInner shops={shops} onPromote={onPromote} PROMOTION_OPTIONS={options} />;
}

function PromotionPanelInner({ shops, onPromote, PROMOTION_OPTIONS }) {
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [type, setType] = useState(PROMOTION_OPTIONS[0].key);
  useEffect(() => { if (!PROMOTION_OPTIONS.some((x) => x.key === type)) setType(PROMOTION_OPTIONS[0].key); }, [PROMOTION_OPTIONS.map((x) => x.key).join(',')]); // eslint-disable-line
  const [productId, setProductId] = useState('');
  const [discount, setDiscount] = useState('');
  const [message, setMessage] = useState('');
  const [coupon, setCoupon] = useState('');
  const [hours, setHours] = useState(24);
  const [radiusKm, setRadiusKm] = useState(3);
  const [busy, setBusy] = useState(false);
  const [demand, setDemand] = useState([]);
  const [membership, setMembership] = useState(Boolean(shops[0]?.membership?.active));
  const [pricing, setPricing] = useState(DEFAULT_PLATFORM_PRICING);
  const [targetScope, setTargetScope] = useState("city");
  const [audience, setAudience] = useState("shopkeepers");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => { if (!shopId && shops[0]) setShopId(shops[0].id); }, [shops, shopId]);
  useEffect(() => { let live=true; supabase.from("platform_settings").select("settings").eq("id","pricing").maybeSingle().then(({data})=>{if(live&&data?.settings)setPricing(mergePricingSettings(data.settings));}); return()=>{live=false;}; }, []);
  const shop = shops.find(s => s.id === shopId) || shops[0];
  const products = shop?.products || [];
  const option = PROMOTION_OPTIONS.find(x => x.key === type) || PROMOTION_OPTIONS[0];
  const wholesale = ["wholesale","both"].includes(shop?.shopType);
  const baseCityPrice = Number(pricing.promotions[type] ?? option.price);
  const geoFactor = Number(pricing.geography[targetScope] || 10) / 10;
  const charge = (wholesale ? Number(pricing.wholesale[audience] ?? (audience === "everyone" ? 99 : 10)) : baseCityPrice * geoFactor) * Math.max(1, Math.ceil(Number(hours || 24) / 24));
  useEffect(() => { if (!productId && products[0]) setProductId(products[0].id); }, [products, productId]);
  useEffect(() => { setMembership(Boolean(shop?.membership?.active)); }, [shop?.id, shop?.membership?.active]);

  useEffect(() => {
    let alive = true;
    supabase.from('wholesale_search_insights').select('query,searches,category').order('searches', { ascending: false }).limit(5).then(({ data }) => {
      if (!alive) return;
      setDemand((data || []).map(r => ({ query: r.query, count: Number(r.searches) || 0, category: r.category })));
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
    if (type === 'reward_wheel' && !message.trim()) return alert('Reward campaign me prize/offer likhiye.');
    setBusy(true);
    try {
      await onPromote({ shopId: shop.id, productId, type, amount: charge, hours, radiusKm, targetScope, audience: wholesale ? audience : 'everyone', startsAt, endsAt, discount: Number(discount) || 0, message: message.trim(), coupon: coupon.trim() });
      setMessage(''); setCoupon(''); setDiscount('');
    } finally { setBusy(false); }
  };

  return <div className="bg-white rounded-2xl p-4 border border-violet-100">
    <div className="flex items-center gap-2 font-extrabold text-sm"><Zap size={16} className="text-violet-600"/> Promote — customer attention lo</div>
    <div className="text-[11px] text-gray-400 mt-1 mb-3">Final price selected ad option aur City/State/Country reach ke hisaab se calculate hoga. Paid placement ko Sponsored/Promoted label milega.</div>
    <select value={shop?.id || ''} onChange={e=>setShopId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-2 bg-white">
      {shops.map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}
    </select>
    <div className="text-[11px] font-bold text-gray-600 mb-1">Offer chuniye (tap karke padhiye ye kya karta hai):</div>
    <div className="max-h-72 overflow-y-auto space-y-1.5 mb-2 pr-0.5">
      {PROMOTION_OPTIONS.map(x=>{const info=PROMOTION_INFO[x.key];const on=type===x.key;return <button type="button" key={x.key} onClick={()=>setType(x.key)} className={`w-full text-left rounded-xl border p-3 ${on?'border-violet-500 bg-violet-50':'border-gray-200 bg-white'}`}>
        <div className="flex justify-between items-center"><span className="font-bold text-sm">{x.label}</span><span className="text-xs font-extrabold text-violet-700">₹{pricing.promotions[x.key] ?? x.price}/city/day</span></div>
        <div className="text-[11px] text-gray-500 mt-0.5">{info?.short}</div>
        {on && info && <div className="mt-2 space-y-1 text-[11px] text-gray-700"><div><b>Ye kya hai:</b> {info.what}</div><div><b>Customer ko kahan dikhega:</b> {info.where}</div><div><b>Fayda:</b> {info.benefit}</div><div><b>Kaise lagayein:</b> {info.how}</div>{option.scope==='shop' && x.key!=='demand_alert' && <div className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2">{SHOP_LEVEL_NOTE}</div>}</div>}
      </button>;})}
    </div>
    <div className="grid grid-cols-2 gap-2 mb-2">
      <label className="text-[11px] text-gray-600">Campaign reach
        <select value={targetScope} onChange={e=>setTargetScope(e.target.value)} className="w-full border rounded-xl px-3 py-2 mt-1 bg-white text-sm">
          <option value="city">City</option><option value="state">State</option><option value="country">Country</option>
        </select>
      </label>
      {wholesale && <label className="text-[11px] text-gray-600">Ad audience
        <select value={audience} onChange={e=>setAudience(e.target.value)} className="w-full border rounded-xl px-3 py-2 mt-1 bg-white text-sm">
          <option value="shopkeepers">Shopkeepers only</option><option value="everyone">Everyone</option>
        </select>
      </label>}
    </div>
    {(type === 'discount' || type === 'flash') && <div className="grid grid-cols-2 gap-2 mb-2">
      <label className="text-[11px] text-gray-600">Offer starts (optional)<input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="w-full border rounded-lg p-2 mt-1 text-xs"/></label>
      <label className="text-[11px] text-gray-600">Offer ends<input type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)} className="w-full border rounded-lg p-2 mt-1 text-xs"/></label>
    </div>}
    {option.scope === 'product' && <select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-2 bg-white">{products.map(p=><option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}</select>}
    {(type === 'discount' || type === 'flash') && <><div className="flex gap-1.5 mb-2 flex-wrap">{[5,10,15,20,25,30].map(n=><button type="button" key={n} onClick={()=>setDiscount(String(n))} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${String(discount)===String(n)?'bg-orange-500 text-white':'bg-orange-50 text-orange-700'}`}>{n}%</button>)}</div><input value={discount} onChange={e=>setDiscount(e.target.value.replace(/\D/g,''))} placeholder="Discount %" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>{preview && <div className="bg-emerald-50 rounded-xl p-2 text-xs mb-2">₹{products.find(p=>p.id===productId)?.price} → <b>₹{preview}</b></div>}</>}
    {type === 'nearby_first' && <div className="flex items-center gap-2 mb-2"><span className="text-xs text-gray-500">Priority radius</span><select value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))} className="flex-1 border rounded-xl px-3 py-2 text-sm"><option value={1}>1 km</option><option value={3}>3 km</option><option value={5}>5 km</option><option value={10}>10 km</option></select></div>}
    {(type === 'announcement' || type === 'new_stock' || type === 'reward_wheel') && <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={type==='new_stock'?'Example: New baby diapers stock aa gaya':type==='reward_wheel'?'Example: Spin karke 10% OFF ya ₹50 coupon':'Example: Imported baby diapers available'} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>}
    {type === 'coupon' && <input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Example: ₹100 OFF above ₹1000" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>}
    <div className="flex items-center gap-2 mb-2"><span className="text-xs text-gray-500">Duration</span><select value={hours} onChange={e=>setHours(Number(e.target.value))} className="flex-1 border rounded-xl px-3 py-2 text-sm"><option value={24}>24 hours</option><option value={48}>2 days</option><option value={72}>3 days</option><option value={168}>7 days</option></select></div>
    <button disabled={busy} onClick={submit} className="w-full bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold">{busy?'Saving…':`🚀 Start for ₹${charge}`}</button>
    <div className="mt-3 bg-violet-50 border border-violet-100 rounded-xl p-3"><div className="font-bold text-xs">👑 NearShop Pro Shop — ₹{pricing.membership.pro_monthly}/month</div><div className="text-[10px] text-violet-600 mt-1">10 Shop Boosts · 10 Product Boosts · 5 Flash Deals · New Stock badges · Coupons · Demand notifications.</div><button onClick={async()=>{const active=!membership;setMembership(active);const target=shop;if(target){await supabase.from('shops').update({membership:{active,startedAt:active?new Date().toISOString():null,price:Number(pricing.membership.pro_monthly)}}).eq('id',target.id);}}} className="mt-2 w-full bg-violet-600 text-white rounded-lg py-2 text-xs font-bold">{membership?'✓ Membership Active':'Activate ₹{pricing.membership.pro_monthly}/month (mock)'}</button></div>
    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100"><div className="font-bold text-xs flex items-center gap-1"><Bell size={13}/> Demand Alert</div><div className="text-[10px] text-gray-500 mt-1">Recent customers ne kya search kiya:</div>{demand.length?demand.map(x=><div key={x.query} className="flex justify-between text-xs mt-1"><span>{x.query}</span><b>{x.count} searches</b></div>):<div className="text-[10px] text-gray-400 mt-1">Abhi enough search data nahi.</div>}</div>
    <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 rounded-xl p-2">🎯 Need It customer request <b>FREE</b> rahega — isme lead fee nahi lagayi.</div>
  </div>;
}
