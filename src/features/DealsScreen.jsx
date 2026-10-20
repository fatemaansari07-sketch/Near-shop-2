import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, MapPin, Phone, MessageCircle, Navigation, Flame, Clock, BadgePercent } from '../../shared/icons';
import { CATEGORIES, distanceKm, formatKm, formatINR } from '../../data/mockData';
import { isPromotionActive, promotionRank, productPromotionRank } from '../promotions/promotionService';
import DailyReward from '../rewards/DailyReward';
import PriceAlertPanel from '../alerts/PriceAlertPanel';

const activeProductDeal = p => isPromotionActive(p?.promotion) && ['discount','flash','product_boost'].includes(p.promotion.type) && (p.promotion.newPrice != null || p.promotion.discount > 0 || p.promotion.type === 'product_boost');

const KINDS=[['all','Sab'],['product','🔥 Product Deals'],['coupon','🏷️ Coupons'],['offer','📢 Offers / New Stock'],['spin','🎡 Spin & Win']];
export default function DealsScreen({ shops, user, userCoords, onBack, onOpenShop, onClaimReward }) {
  const [category,setCategory]=useState('All');
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('all');
  const city = useMemo(()=>{
    const nearest=[...shops].filter(s=>!s.isBlocked).map(s=>({...s,d:distanceKm(userCoords?.lat,userCoords?.lng,s.lat,s.lng)})).sort((a,b)=>(a.d??999)-(b.d??999))[0];
    return nearest?.city || 'Surat';
  },[shops,userCoords]);
  const cityShops=useMemo(()=>shops.filter(s=>!s.isBlocked && (!city || s.city===city) && (category==='All'||s.category===category)),[shops,city,category]);
  const deals=useMemo(()=>cityShops.flatMap(shop=>shop.products.filter(activeProductDeal).map(product=>({shop,product}))).sort((a,b)=>productPromotionRank(b.product.promotion)-productPromotionRank(a.product.promotion)||promotionRank(b.shop.promotion)-promotionRank(a.shop.promotion)),[cityShops]);
  const campaigns=cityShops.filter(s=>isPromotionActive(s.promotion) && ['announcement','new_stock','coupon','reward_wheel'].includes(s.promotion.type));
  const q=query.trim().toLowerCase();
  const campaignKind=s=>({coupon:'coupon',reward_wheel:'spin'}[s.promotion.type]||'offer');
  const cq=campaigns.filter(s=>(kind==='all'||kind===campaignKind(s))&&(!q||s.name.toLowerCase().includes(q)||String(s.promotion.message||s.promotion.coupon||'').toLowerCase().includes(q)));
  const coupons=cq.filter(s=>s.promotion.type==='coupon');
  const offers=cq.filter(s=>s.promotion.type!=='coupon');
  const filtered=(kind==='all'||kind==='product'?deals:[]).filter(({shop,product})=>!q || product.name.toLowerCase().includes(q) || shop.name.toLowerCase().includes(q));
  /* nearby shop list intentionally removed: this screen is now a complete city-wide deal directory. */
  const nearby=useMemo(()=>{
    return cityShops.map(shop=>({shop,d:distanceKm(userCoords?.lat,userCoords?.lng,shop.lat,shop.lng),match:!q||shop.name.toLowerCase().includes(q)||shop.products.some(p=>p.name.toLowerCase().includes(q))})).filter(x=>x.match).sort((a,b)=>(a.d??999)-(b.d??999)).slice(0,8);
  },[cityShops,q,userCoords]);
  const hoursLeft=p=>p?.expiresAt?`${Math.max(1,Math.ceil((new Date(p.expiresAt).getTime()-Date.now())/3600000))}h baaki`:'Active today';
  const distLabel=s=>{const d=distanceKm(userCoords?.lat,userCoords?.lng,s.lat,s.lng);return d!=null?` · ${formatKm(d)}`:'';};
  const openMaps=s=>window.open(`https://maps.google.com/?q=${s.lat},${s.lng}`,'_blank');
  return <div className="pb-24 min-h-screen bg-gray-50">
    <div className="bg-gradient-to-br from-orange-400 to-pink-500 px-5 pt-6 pb-6 rounded-b-3xl text-white"><button onClick={onBack} className="mb-3"><ArrowLeft size={20}/></button><div className="text-2xl font-extrabold flex items-center gap-2"><Flame size={22}/> Deals</div><div className="text-white/80 text-sm mt-1">City ke saare active deals — category aur search se filter karein.</div><div className="mt-3 bg-white rounded-xl flex items-center px-3 py-2"><Search size={16} className="text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Deal ya product search karein..." className="flex-1 outline-none px-2 text-sm text-gray-700"/></div></div>
    <div className="px-5 mt-4"><div className="flex gap-2 overflow-x-auto pb-1">{['All',...CATEGORIES].map(c=><button key={c} onClick={()=>setCategory(c)} className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${category===c?'bg-orange-500 text-white':'bg-white text-gray-500 border border-gray-200'}`}>{c}</button>)}</div></div>

    <div className="px-5 mt-3"><div className="flex gap-2 overflow-x-auto pb-1">{KINDS.map(([k,l])=><button key={k} onClick={()=>setKind(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${kind===k?'bg-violet-600 text-white':'bg-white text-gray-500 border border-gray-200'}`}>{l}</button>)}</div></div>
    {coupons.length>0 && <div className="px-5 mt-4"><div className="font-extrabold text-sm mb-2">🏷️ Coupons ({coupons.length})</div>{coupons.map(s=><div key={`coupon-${s.id}`} onClick={()=>onOpenShop(s)} className="rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50 p-4 mb-2 cursor-pointer active:scale-[.99]"><div className="flex justify-between items-start"><div className="min-w-0"><div className="font-bold text-sm truncate">{s.name}</div><div className="text-[10px] text-gray-500">{s.category} · {s.area}{distLabel(s)}</div></div><span className="text-[9px] bg-pink-600 text-white px-2 py-0.5 rounded-full font-bold">COUPON</span></div><div className="mt-2 text-base font-extrabold text-pink-700">{s.promotion.coupon||s.promotion.message}</div><div className="mt-2 flex items-center justify-between text-[10px] text-gray-500"><span className="flex items-center gap-1"><Clock size={10}/>{hoursLeft(s.promotion)}</span><span className="font-bold text-pink-700">Dukaan kholo ›</span></div></div>)}</div>}
    {offers.length>0 && <div className="px-5 mt-4"><div className="font-extrabold text-sm mb-2">📢 Shop Offers ({offers.length})</div>{offers.map(s=><div key={`offer-${s.id}`} onClick={()=>onOpenShop(s)} className="bg-white rounded-2xl p-4 border border-violet-100 mb-2 cursor-pointer"><div className="flex justify-between"><div className="min-w-0"><div className="font-bold text-sm truncate">{s.name}</div><div className="text-[10px] text-violet-600 font-bold">{s.promotion.badge||'PROMOTION'} · SPONSORED</div></div><span className="text-xs font-bold text-violet-700">{s.promotion.type==='reward_wheel'?'🎡 Spin & Win':'Dekho ›'}</span></div><div className="text-xs text-gray-600 mt-2">{s.promotion.message || s.promotion.coupon || 'Special offer available today.'}</div><div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Clock size={10}/>{hoursLeft(s.promotion)}</div></div>)}</div>}
    <div className="px-5 mt-5"><div className="flex items-center justify-between mb-2"><div className="font-extrabold text-sm">🔥 Deals in {city}</div><span className="text-[10px] text-gray-400">{filtered.length} active</span></div>{filtered.length?filtered.map(({shop,product})=>{const promo=product.promotion;const oldPrice=Number(product.price);const newPrice=promo.newPrice!=null?Number(promo.newPrice):oldPrice;return <div key={`${shop.id}-${product.id}`} onClick={()=>onOpenShop(shop,product)} className="bg-white rounded-2xl p-4 border border-orange-100 mb-3 cursor-pointer"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="font-bold text-sm truncate">{product.name}</div><div className="text-xs text-gray-400 mt-0.5">{shop.name} · {shop.area}</div><span className="inline-block mt-1 text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{promo.badge||'DEAL'} · SPONSORED</span></div><div className="text-right">{newPrice<oldPrice&&<div className="text-[10px] text-gray-400 line-through">{formatINR(oldPrice)}</div>}<div className="font-extrabold text-emerald-600">{formatINR(newPrice)}</div>{promo.discount>0&&<div className="text-[10px] text-orange-600 font-bold">{promo.discount}% OFF</div>}</div></div><div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1"><Clock size={10}/>{promo.expiresAt?`${Math.max(0,Math.ceil((new Date(promo.expiresAt).getTime()-Date.now())/3600000))}h remaining`:'Active today'}<span className="ml-auto font-bold text-orange-600">Product dekho ›</span></div></div>}) : <div className="bg-white rounded-xl p-4 text-xs text-gray-400">Is category me abhi active deal nahi hai.</div>}</div>
    <div className="px-5 mt-4 space-y-3"><DailyReward user={user} onClaim={onClaimReward || (async()=>{})}/><PriceAlertPanel user={user} shops={shops}/><div className="bg-violet-50 rounded-2xl p-4 text-xs text-violet-700"><b>🎯 Need It FREE</b> — item nahi mil raha to Need It se selected category ke nearby shops se availability mangwao.</div></div>
  </div>;
}
