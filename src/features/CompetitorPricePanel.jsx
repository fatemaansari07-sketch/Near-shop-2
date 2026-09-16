import React, { useMemo, useState } from 'react';
import { TrendingUp, Store } from '../../shared/icons';
export default function CompetitorPricePanel({ shops }) {
  const mine = shops[0];
  const [productId,setProductId]=useState(mine?.products?.[0]?.id||'');
  const product=mine?.products?.find(p=>p.id===productId)||mine?.products?.[0];
  const rows=useMemo(()=>{if(!product)return [];return shops.flatMap(s=>s.products.filter(p=>p.name.toLowerCase()===product.name.toLowerCase()).map(p=>({shop:s,product:p}))).sort((a,b)=>Number(a.product.price)-Number(b.product.price));},[shops,product]);
  if(!mine?.products?.length)return null;
  return <div className="bg-white rounded-2xl p-4 border"><div className="flex items-center gap-2 font-extrabold text-sm"><TrendingUp size={15}/> Competitor Price Insight</div><div className="text-[10px] text-gray-400 mt-1">₹10 feature ka prototype — nearby listed prices compare karo.</div><select value={product?.id||''} onChange={e=>setProductId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mt-3">{mine.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{rows.length?<div className="mt-3 space-y-1">{rows.map((r,i)=><div key={r.shop.id+r.product.id} className={`flex justify-between items-center p-2 rounded-lg ${i===0?'bg-emerald-50':''}`}><span className="text-xs flex items-center gap-1"><Store size={11}/>{r.shop.name}</span><b className="text-xs">₹{r.product.price}</b></div>)}</div>:<div className="text-xs text-gray-400 mt-3">Same product ka aur listing nahi mila.</div>}</div>;
}
