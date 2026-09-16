import React, { useState, useMemo } from "react";
import VoiceInput from "../../components/VoiceInput";
import { parseSaleVoice } from "../../lib/voiceParser";
import { formatINR } from "../../data/mockData";
import { saleToBaseUnits, saleLineTotal, displayPackStock } from "../../lib/inventory";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function SellFlow({ shop, onBack, onCompleteSale }) {
  const [cart,setCart]=useState([]), [showScan,setShowScan]=useState(false), [showPicker,setShowPicker]=useState(false), [pickerQuery,setPickerQuery]=useState(""), [receipt,setReceipt]=useState(null), [finishing,setFinishing]=useState(false), [voiceText,setVoiceText]=useState(""), [reviewing,setReviewing]=useState(false);
  const inStock=shop.products.filter(p=>(p.stock??0)>0);
  const addLine=(product, qty, subUnit)=>{
    const baseQty=saleToBaseUnits(product,qty,subUnit);
    setCart(prev=>{
      const current=prev.find(c=>c.productId===product.id);
      const nextBase=(current?.baseQty||0)+baseQty;
      if(nextBase>Number(product.stock)+1e-9){alert(`${product.name} ka stock kam hai.`);return prev;}
      const lineTotal=product.unit==='pack' ? +((nextBase*Number(product.price))/Math.max(1,Number(product.packSize||10))).toFixed(2) : +(nextBase*Number(product.price)).toFixed(2);
      let displayQty;
      if(product.unit==='pack'){const size=Math.max(1,Number(product.packSize||10));const strips=Math.floor(nextBase/size),loose=Math.round(nextBase%size);displayQty=loose?`${strips} strips + ${loose} tablets`:`${strips} strips`;}
      else if(product.unit==='weight') displayQty=`${nextBase*1000} g`;
      else if(product.unit==='volume') displayQty=`${nextBase*1000} ml`;
      else if(product.unit==='length') displayQty=`${nextBase*100} cm`;
      else displayQty=`${nextBase} pcs`;
      return current?prev.map(c=>c.productId===product.id?{...c,baseQty:nextBase,qty:nextBase,displayQty,lineTotal}:c):[...prev,{productId:product.id,name:product.name,unit:product.unit,price:Number(product.price),baseQty:nextBase,qty:nextBase,displayQty,lineTotal,packSize:product.packSize||10}];
    });
  };
  const handleVoice=(heard,full)=>{setVoiceText(full||heard);const matches=parseSaleVoice(heard,shop.products);if(!matches.length){return;}matches.forEach(m=>addLine(m.product,m.qty,m.subUnit));};
  const qtyUnitLabel=(u)=>u==='pack'?'strips':u==='weight'?'kg':u==='volume'?'L':u==='length'?'m':'pcs';
  const updateLineQty=(productId,value)=>{
    const entered=value===""?0:Number(value);
    if(isNaN(entered)||entered<0)return;
    const product=shop.products.find(x=>x.id===productId);
    const q=product?.unit==='pack'?entered*Math.max(1,Number(product.packSize||10)):entered;
    if(product&&q>Number(product.stock)+1e-9){alert(`${product.name} ka stock kam hai.`);return;}
    setCart(prev=>prev.map(c=>{
      if(c.productId!==productId)return c;
      const lineTotal=c.unit==='pack'?+((q*Number(c.price))/Math.max(1,Number(c.packSize||10))).toFixed(2):+(q*c.price).toFixed(2);
      return {...c,baseQty:q,qty:entered,lineTotal,displayQty:c.unit==='pack'?`${entered} strips`: `${q} ${qtyUnitLabel(c.unit)}`};
    }));
  };
  const handleScan=(item)=>{setShowScan(false);const p=shop.products.find(x=>x.barcode===item.code);if(p)addLine(p,1,'piece');else alert('Ye barcode is shop ke product se match nahi hua.');};
  const total=cart.reduce((s,c)=>s+c.lineTotal,0);
  const finish=async()=>{
    if(!cart.length)return;
    setFinishing(true);
    try {
      const ok = await onCompleteSale(shop.id,cart);
      if (ok === false) return;
      setReceipt({id:genId('bill'),shopName:shop.name,items:cart,total,timestamp:Date.now()});
    } catch (e) {
      alert(e?.message || 'Sale save nahi ho payi.');
    } finally { setFinishing(false); }
  };
  if(receipt)return <div className="min-h-screen bg-gray-50 pb-10"><div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white text-center"><Check size={32} className="mx-auto"/><div className="text-xl font-extrabold">Sale Complete</div><div className="text-white/80 text-xs">Stock update ho gaya</div></div><div className="px-5 mt-4"><div className="bg-white rounded-2xl p-5 border"><div className="font-bold">{receipt.shopName}</div><div className="text-xs text-gray-400 mb-3">{new Date(receipt.timestamp).toLocaleString()}</div>{receipt.items.map(it=><div key={it.productId} className="flex justify-between py-2 text-sm"><span>{it.name} × {it.displayQty}</span><b>{formatINR(it.lineTotal)}</b></div>)}<div className="flex justify-between pt-3 border-t font-extrabold text-violet-600"><span>Total</span><span>{formatINR(receipt.total)}</span></div></div><div className="flex gap-2 mt-4"><button onClick={()=>window.print()} className="flex-1 bg-gray-100 py-3 rounded-xl"><Printer size={15}/> Print</button><button onClick={onBack} className="flex-1 bg-violet-600 text-white py-3 rounded-xl">Done</button></div></div></div>;
  return <div className="min-h-screen bg-gray-50 pb-32"><div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white"><button onClick={onBack} className="mb-3"><ArrowLeft size={20}/></button><div className="text-2xl font-extrabold flex items-center gap-2"><ShoppingCart size={22}/> Smart Billing</div><div className="text-white/80 text-sm">{shop.name}</div></div>
  <div className="px-5 mt-4 space-y-2"><div className="bg-white rounded-2xl p-3 border"><div className="text-xs text-gray-500 mb-2">Mic on karke ek-ek product ka naam boliye — list aap hi banti jaayegi</div><div className="flex items-center justify-between"><VoiceInput continuous onText={handleVoice}/><button onClick={()=>setShowScan(true)} className="flex items-center gap-1 bg-violet-50 text-violet-700 px-3 py-2 rounded-xl text-xs font-bold"><ScanLine size={15}/> Scan</button></div>{voiceText&&<div className="text-[11px] bg-gray-50 rounded-xl p-2 mt-2">Heard: {voiceText}</div>}</div><button onClick={()=>setShowPicker(true)} className="w-full bg-white border-2 border-dashed border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl"><Package size={17}/> Product list se chuno</button></div>
  <div className="px-5 mt-4 space-y-2">{cart.length===0?<div className="text-center text-gray-400 text-sm mt-8">Cart khali hai. Voice, scan ya list use kariye.</div>:cart.map(c=><div key={c.productId} className="bg-white rounded-2xl p-3 border flex justify-between items-center"><div className="min-w-0"><div className="font-semibold text-sm truncate">{c.name}</div><div className="flex items-center gap-2 mt-1"><input type="number" min="0" step="any" value={c.qty} onChange={e=>updateLineQty(c.productId,e.target.value)} className="w-16 border rounded-lg px-2 py-1 text-xs"/><span className="text-xs text-gray-400">{qtyUnitLabel(c.unit)} · {formatINR(c.price)}{c.unit==='pack'?'/strip':c.unit==='piece'?'/pc':''}</span></div></div><div className="flex items-center gap-3"><b className="text-violet-600">{formatINR(c.lineTotal)}</b><button onClick={()=>setCart(x=>x.filter(i=>i.productId!==c.productId))} className="text-red-400"><Trash2 size={16}/></button></div></div>)}</div>
  {cart.length>0&&<div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4"><div className="flex justify-between mb-2"><span>Total</span><b className="text-lg text-violet-600">{formatINR(total)}</b></div><button disabled={finishing} onClick={()=>setReviewing(true)} className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{finishing?'Saving…':'✓ Review Sale'}</button></div>}
  {reviewing&&<div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-3"><div><div className="font-bold">Bill Review</div><div className="text-[11px] text-gray-400">Galti ho to yahin se voice se poora bill dobara set kar sakte hain.</div></div><button onClick={()=>setReviewing(false)}><X size={18}/></button></div><div className="flex gap-2 mb-3"><VoiceInput onText={(text)=>{setVoiceText(text);const matches=parseSaleVoice(text,shop.products);if(!matches.length){alert('Correction samajh nahi aayi.');return;}setCart([]);matches.forEach(m=>addLine(m.product,m.qty,m.subUnit));}}/><button onClick={()=>setShowScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Scan</button></div>{cart.map(c=><div key={c.productId} className="flex justify-between items-center py-2 border-b text-sm"><span className="min-w-0 pr-3"><b>{c.name}</b><div className="flex items-center gap-2 mt-1"><input type="number" min="0" step="any" value={c.qty} onChange={e=>updateLineQty(c.productId,e.target.value)} className="w-16 border rounded-lg px-2 py-1 text-xs"/><small className="text-gray-400">{qtyUnitLabel(c.unit)}</small></div></span><div className="flex items-center gap-2"><button onClick={()=>setCart(x=>x.filter(i=>i.productId!==c.productId))} className="text-red-400 text-xs">Remove</button><b>{formatINR(c.lineTotal)}</b></div></div>)}<div className="flex justify-between font-extrabold text-violet-600 py-3"><span>Total</span><span>{formatINR(total)}</span></div><div className="text-[11px] text-gray-400 mb-3">Galti ho to item remove karke dobara voice/scan se add kar sakte hain.</div><button disabled={finishing} onClick={async()=>{setReviewing(false);await finish()}} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">{finishing?'Saving…':'Confirm Sale & Update Stock'}</button></div></div>}
  {showScan&&<BarcodeScanModal subtitle="Sale wala product scan kariye" onClose={()=>setShowScan(false)} onDetected={handleScan}/>} {showPicker&&<div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[75vh] flex flex-col"><div className="flex justify-between mb-3"><b>Product chuniye</b><button onClick={()=>setShowPicker(false)}><X size={18}/></button></div><input value={pickerQuery} onChange={e=>setPickerQuery(e.target.value)} placeholder="Search product..." className="border rounded-xl px-3 py-2 mb-3"/><div className="overflow-y-auto space-y-2">{inStock.filter(p=>p.name.toLowerCase().includes(pickerQuery.toLowerCase())).map(p=><button key={p.id} onClick={()=>{addLine(p,1,p.unit==='pack'?'strip':'piece');setShowPicker(false)}} className="w-full text-left bg-gray-50 rounded-xl p-3 flex justify-between"><span><b>{p.name}</b><small className="block text-gray-400">Stock {p.unit==='pack'?displayPackStock(p.stock,p.packSize||10):p.stock}</small></span><b>{formatINR(p.price)}{p.unit==='pack'?'/strip':''}</b></button>)}</div></div></div>}
  </div>;
}

/* ============================================================================
   FILE: screens/AdminPanel.jsx
============================================================================ */

