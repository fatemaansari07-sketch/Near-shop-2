import React, { useMemo, useState } from 'react';
import { CATEGORIES, formatINR, timeAgo } from '../../data/mockData';
import { distanceKm } from '../../data/mockData';
import { isPromotionActive } from '../promotions/promotionService';
import PromotionPanel from '../promotions/PromotionPanel';
import { Gavel, Bell, Flame, ChevronRight, Send, Check } from '../../shared/icons';

const LABELS = { Pharmacy:'Medical', Paint:'Paint / Color', Clothing:'Clothing', Footwear:'Footwear', Electronics:'Mobile / Electronics' };
const needLabel = k => LABELS[k] || k;
const minsLeft = e => Math.max(0, Math.ceil((new Date(e).getTime()-Date.now())/60000));

export default function OwnerMarketplacePanel({
  shops=[], needRequests=[], bids=[], onPromote, onNeedRespond, onBidOffer, onOpenAd,
}) {
  const [tab,setTab] = useState('deals');
  const [needFilter,setNeedFilter] = useState(shops[0]?.category || 'All');
  const [bidFilter,setBidFilter] = useState(shops[0]?.category || 'All');
  const [offerInputs,setOfferInputs] = useState({});
  const ownedCategories = useMemo(()=>[...new Set(shops.map(s=>s.category).filter(Boolean))],[shops]);
  const filters = ['All', ...ownedCategories.filter(c=>c!=='All'), ...CATEGORIES.filter(c=>!ownedCategories.includes(c))];
  const ownerCanCategory = category => shops.some(s=>s.category===category);
  const myShopFor = category => shops.find(s=>s.category===category) || shops[0];
  const activeNeeds = needRequests.filter(r=>r.status==='open' && (needFilter==='All'||r.category===needFilter) && (!r.expires_at || new Date(r.expires_at).getTime()>Date.now()) && (r.customer_id));
  const activeBids = bids.filter(b=>b.status==='open' && (bidFilter==='All'||b.category===bidFilter) && !shops.some(s=>s.owner_id===b.customerId));

  const openTab = key => { setTab(key); onOpenAd?.(); };
  const submitOffer = async (bid, shop) => {
    const raw=offerInputs[bid.id];
    if(!raw) return;
    await onBidOffer?.(bid.id, shop.id, Number(raw));
    setOfferInputs(x=>({...x,[bid.id]:''}));
  };

  return <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="p-4 bg-gradient-to-br from-violet-50 to-indigo-50 border-b border-violet-100">
      <div className="font-extrabold text-base">🏪 Shop Owner Center</div>
      <div className="text-[11px] text-gray-500 mt-1">Deals, Need It aur Bid — sab owner tools yahin.</div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={()=>openTab('deals')} className={`rounded-xl p-2.5 text-[10px] font-bold ${tab==='deals'?'bg-orange-500 text-white':'bg-white text-gray-600 border'}`}><Flame size={15} className="mx-auto mb-1"/>Deals</button>
        <button onClick={()=>openTab('need')} className={`rounded-xl p-2.5 text-[10px] font-bold ${tab==='need'?'bg-violet-600 text-white':'bg-white text-gray-600 border'}`}><Bell size={15} className="mx-auto mb-1"/>Need It</button>
        <button onClick={()=>openTab('bid')} className={`rounded-xl p-2.5 text-[10px] font-bold ${tab==='bid'?'bg-indigo-600 text-white':'bg-white text-gray-600 border'}`}><Gavel size={15} className="mx-auto mb-1"/>Bid Requests</button>
      </div>
    </div>

    {tab==='deals' && <div className="p-4 space-y-3">
      <div className="text-xs text-gray-500">Customer ke Deals page par jo deals dikhenge, unhe yahin product select karke lagao. Har product ki alag active deal ho sakti hai.</div>
      <PromotionPanel shops={shops} onPromote={onPromote}/>
    </div>}

    {tab==='need' && <div className="p-4">
      <div className="flex items-center justify-between mb-2"><div><div className="font-extrabold text-sm">📸 Need It Requests</div><div className="text-[10px] text-gray-400">Default tumhari category. All sirf dekhne ke liye.</div></div><span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-bold">FREE</span></div>
      <div className="flex gap-2 overflow-x-auto pb-2">{filters.map(c=><button key={c} onClick={()=>setNeedFilter(c)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${needFilter===c?'bg-violet-600 text-white':'bg-gray-50 border text-gray-600'}`}>{c==='All'?'All Categories':needLabel(c)}</button>)}</div>
      {activeNeeds.length===0 ? <div className="bg-gray-50 rounded-xl p-5 text-center text-xs text-gray-500">📭 Is filter me abhi koi active request nahi.</div> : activeNeeds.map(r=>{
        const shop=ownerCanCategory(r.category)?myShopFor(r.category):null;
        return <div key={r.id} className="border rounded-2xl p-3 mb-2">
          <div className="flex justify-between"><span className="text-[9px] bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-bold">{needLabel(r.category)}</span><span className="text-[9px] text-orange-600 font-bold">{minsLeft(r.expires_at)} min</span></div>
          {r.image_url&&<img src={r.image_url} className="w-full h-36 object-cover rounded-xl mt-2"/>}
          <div className="font-bold text-sm mt-2">{r.title}</div><div className="text-xs text-gray-500 mt-1">{r.details||'No extra details'}</div>
          {shop ? <button disabled={respondingNeed[r.id]||respondedNeed[r.id]} onClick={async()=>{setRespondingNeed(x=>({...x,[r.id]:true}));try{const ok=await onNeedRespond?.(r.id,shop.id);if(ok!==false)setRespondedNeed(x=>({...x,[r.id]:true}))}finally{setRespondingNeed(x=>({...x,[r.id]:false}))}}} className={`w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition ${respondedNeed[r.id]?'bg-emerald-100 text-emerald-700 border border-emerald-300':'bg-emerald-600 text-white'} disabled:opacity-80`}><Check size={13} className="inline"/> {respondedNeed[r.id]?'✓ YES bhej diya — Customer ko bataya':respondingNeed[r.id]?'Sending…':'YES — Mere paas hai'}</button> : <div className="text-[10px] text-gray-400 mt-2">Tumhari koi {needLabel(r.category)} shop nahi hai — request sirf view kar sakte ho.</div>}
        </div>;
      })}
    </div>}

    {tab==='bid' && <div className="p-4">
      <div className="font-extrabold text-sm">⚖️ Customer Bid Requests</div><div className="text-[10px] text-gray-400 mt-1 mb-2">Default apni category. Dusri category ke requests dekh sakte ho, lekin offer nahi bhej sakte.</div>
      <div className="flex gap-2 overflow-x-auto pb-2">{filters.map(c=><button key={c} onClick={()=>setBidFilter(c)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${bidFilter===c?'bg-indigo-600 text-white':'bg-gray-50 border text-gray-600'}`}>{c==='All'?'All Categories':needLabel(c)}</button>)}</div>
      {activeBids.length===0 ? <div className="bg-gray-50 rounded-xl p-5 text-center text-xs text-gray-500">📭 Is filter me abhi koi open bid nahi.</div> : activeBids.map(b=>{
        const canOffer=ownerCanCategory(b.category);
        const shop=canOffer?myShopFor(b.category):null;
        return <div key={b.id} className="border rounded-2xl p-3 mb-2">
          <div className="flex justify-between gap-2"><div><span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold">{needLabel(b.category)}</span><div className="font-bold text-sm mt-2">{b.item}</div><div className="text-[10px] text-gray-400">Budget {formatINR(b.budget)} · {b.area} · {timeAgo(b.createdAt)}</div></div><Gavel size={18} className="text-indigo-500"/></div>
          {canOffer ? <div className="mt-3 flex gap-2"><input value={offerInputs[b.id]||''} onChange={e=>setOfferInputs(x=>({...x,[b.id]:e.target.value.replace(/\D/g,'')}))} placeholder="Aapka offer ₹" className="flex-1 border rounded-xl px-3 py-2 text-xs"/><button onClick={()=>submitOffer(b,shop)} className="bg-indigo-600 text-white rounded-xl px-3 text-xs font-bold"><Send size={12} className="inline"/> Offer</button></div> : <div className="text-[10px] text-gray-400 mt-2">Sirf viewing — is category me tumhari shop nahi hai.</div>}
        </div>;
      })}
      <div className="text-[10px] text-gray-400 mt-3 bg-amber-50 rounded-xl p-3">🔒 Dusre shops ke offers yahan nahi dikhte. Offers sirf customer ko dikhte hain.</div>
    </div>}
  </div>;
}
