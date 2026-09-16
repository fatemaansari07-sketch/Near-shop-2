import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import VoiceInput from "../../components/VoiceInput";
import { parseProductVoice } from "../../lib/voiceParser";
import { getInventoryMeta, setInventoryMeta, displayPackStock } from "../../lib/inventory";
import { formatINR, genId } from "../../data/mockData";
import PromotionPanel from "../promotions/PromotionPanel";
import CompetitorPricePanel from "../insights/CompetitorPricePanel";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function MyShopDashboard({ shops, onBack, onUpdateProduct, onAddProduct, onOpenSell, onOpenReport, onAddAnotherShop, onDeleteShop, onPromote }) {
  const [addShopId, setAddShopId] = useState(shops[0]?.id);
  const [addSettings, setAddSettings] = useState({ unit: "piece", wantExpiry: false });
  const blankDraft = (unit) => ({ name: "", price: "", stock: "", packSize: "10", expiryDate: "", code: "", unit: unit || "piece" });
  const [draft, setDraft] = useState(() => blankDraft(addSettings.unit));
  const [step, setStep] = useState("name");
  const [pending, setPending] = useState([]);
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showScan, setShowScan] = useState(false);
  const [editingScan, setEditingScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const editFileRef = useRef(null);

  const unitLabel = (u) => (u === "weight" ? "/kg" : u === "volume" ? "/litre" : u === "length" ? "/metre" : u === "pack" ? "/strip" : "/piece");
  const stockLabel = (p) => p.unit === "pack" ? displayPackStock(p.stock, p.packSize || 10) : p.unit === "weight" ? `${p.stock} kg` : p.unit === "volume" ? `${p.stock} L` : p.unit === "length" ? `${p.stock} m` : `${p.stock} pcs`;

  const steps = ["name", "price", "stock", ...(addSettings.wantExpiry ? ["expiry"] : [])];
  const stepIdx = steps.indexOf(step);
  const stepValid = step === "name" ? !!draft.name.trim()
    : step === "price" ? (draft.price !== "" && !isNaN(Number(draft.price)) && Number(draft.price) > 0)
    : step === "stock" ? (draft.stock !== "" && !isNaN(Number(draft.stock)))
    : true;

  const firstNumber = (text) => { const m = String(text || "").match(/\d+(?:\.\d+)?/); return m ? m[0] : ""; };

  const goBack = () => { if (stepIdx > 0) setStep(steps[stepIdx - 1]); };
  const advanceOrCommit = () => {
    if (!stepValid) return;
    if (stepIdx < steps.length - 1) { setStep(steps[stepIdx + 1]); return; }
    setPending((prev) => [...prev, {
      name: draft.name.trim(),
      price: Number(draft.price),
      stock: Number(draft.stock),
      unit: draft.unit,
      packSize: draft.unit === "pack" ? Number(draft.packSize || 10) : null,
      expiryDate: draft.expiryDate || "",
      code: draft.code || "",
      shopId: addShopId,
    }]);
    setDraft(blankDraft(addSettings.unit));
    setStep("name");
  };

  const handleScan = (item) => {
    setShowScan(false);
    setDraft((d) => ({ ...d, code: item.code || d.code, name: item.name || d.name }));
    if (item.suggestedPrice) { setDraft((d) => ({ ...d, price: String(item.suggestedPrice) })); setStep("stock"); }
    else if (item.name) setStep("price");
  };

  const uploadImage = async (shopId, file) => {
    if (!file) return null;
    const path = `${shopId}/${genId("img")}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return null;
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const pendingIssue = (p) => {
    if (!p.name || !String(p.name).trim()) return "naam";
    if (p.price === null || p.price === undefined || p.price === "" || isNaN(Number(p.price)) || Number(p.price) <= 0) return "price";
    if (p.stock === null || p.stock === undefined || p.stock === "" || isNaN(Number(p.stock))) return "stock";
    return null;
  };
  const updatePending = (i, changes) => setPending((prev) => prev.map((item, j) => j === i ? { ...item, ...changes } : item));
  const commitPending = async () => {
    if (!pending.length) return;
    const badIdx = pending.findIndex((p) => pendingIssue(p));
    if (badIdx !== -1) return alert(`Product ${badIdx + 1} ("${pending[badIdx].name || "naam khaali"}") ka ${pendingIssue(pending[badIdx])} bhariye — voice se yeh detail nahi mil paayi.`);
    setBusy(true);
    try {
      for (const item of pending) {
        const imageUrl = item.imageUrl || null;
        const product = await onAddProduct(item.shopId, item.name, Number(item.price), item.unit || "piece", Number(item.stock), imageUrl, item.expiryDate || null, item.code || null, item.packSize);
        if (product?.id && item.packSize) setInventoryMeta(product.id, { packSize: Number(item.packSize) });
      }
      setPending([]);
    } finally { setBusy(false); }
  };

  const pickImage = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Sirf image file choose karein.");
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const saveEdit = async () => {
    if (!editing?.name || editing.price === "" || editing.stock === "") return alert("Naam, price aur stock required hain.");
    setBusy(true);
    try {
      let imageUrl = editing.imageUrl || null;
      if (imageFile) {
        const uploaded = await uploadImage(editing.shopId, imageFile);
        if (!uploaded) throw new Error("Photo upload nahi ho paya. Dobara try karein.");
        imageUrl = uploaded;
      }
      const packSize = editing.unit === "pack" ? Math.max(1, Number(editing.packSize || 10)) : null;
      const enteredStock = Number(editing.stock);
      const stockToSave = editing.unit === "pack" ? enteredStock * packSize : enteredStock;
      const saved = await onUpdateProduct(editing.shopId, editing.id, { ...editing, price: Number(editing.price), stock: stockToSave, displayStock: enteredStock, imageUrl, expiryDate: editing.expiryDate || null, barcode: editing.barcode || null, unit: editing.unit || "piece", packSize });
      if (editing.unit === "pack") setInventoryMeta(editing.id, { packSize, stockMode: "base_units" });
      if (editFileRef.current) editFileRef.current.value = "";
      setEditing(null); setImageFile(null); setImagePreview(null);
    } finally { setBusy(false); }
  };

  return <div className="pb-24 min-h-screen bg-gray-50">
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
      <button onClick={onBack} className="mb-3"><ArrowLeft size={20}/></button>
      <div className="flex items-center justify-between"><div><div className="text-2xl font-extrabold">My Shop{shops.length > 1 ? "s" : ""}</div><div className="text-white/80 text-sm mt-1">Smart product management & billing</div></div><button onClick={onAddAnotherShop} className="bg-white/20 text-xs font-semibold px-3 py-2 rounded-lg"><Plus size={14}/> Naya Shop</button></div>
    </div>

    <div className="px-5 mt-4 space-y-4">
      {shops.map((s) => <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2"><div><div className="font-bold text-sm">{s.name}</div><div className="text-xs text-gray-400">{s.area} · {s.products.length} products</div></div><div className="flex gap-2"><button onClick={()=>onOpenReport(s.id)} className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-2 rounded-lg"><BarChart3 size={13}/> Report</button><button onClick={()=>onOpenSell(s.id)} className="bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg"><ShoppingCart size={13}/> Sale</button></div></div>
        <div className="divide-y divide-gray-50">{s.products.map((p)=><div key={p.id} className="py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0">{p.imageUrl?<img src={p.imageUrl} className="w-9 h-9 rounded-lg object-cover"/>:<div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14}/></div>}<div className="min-w-0"><div className="text-sm font-semibold truncate">{p.name}</div><div className={`text-[11px] ${p.stock<=3?'text-red-500':'text-gray-500'}`}>Stock: {stockLabel(p)}</div></div></div><div className="flex items-center gap-2"><span className="font-bold text-sm">{formatINR(Number(p.price))}{unitLabel(p.unit)}</span><button onClick={()=>{setEditing({...p,shopId:s.id,packSize:p.packSize||getInventoryMeta(p.id).packSize||10,stock:p.unit==='pack'?((Number(p.stock)||0)/Number(p.packSize||getInventoryMeta(p.id).packSize||10)):p.stock});setImagePreview(p.imageUrl||null);setImageFile(null);if(editFileRef.current)editFileRef.current.value="";}} className="text-violet-600 text-xs font-bold px-2 py-1 bg-violet-50 rounded-lg">Edit</button></div></div>)}</div>
        <button onClick={()=>{if(confirm(`"${s.name}" delete karni hai?`)) onDeleteShop(s.id)}} className="w-full mt-2 bg-red-50 text-red-500 text-xs font-semibold py-2 rounded-lg"><Trash2 size={13}/> Delete Shop</button>
      </div>)}

      <PromotionPanel shops={shops} onPromote={onPromote} />
      <CompetitorPricePanel shops={shops} />

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="font-bold text-sm mb-1">Smart Product Add</div><div className="text-xs text-gray-400 mb-3">Ek-ek karke boliye — pehle naam, phir price, phir stock. Jab tak ek box pura na ho, agla nahi khulega.</div>

        <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50 rounded-xl p-2">
          <select value={addSettings.unit} onChange={e=>{const u=e.target.value; setAddSettings(s=>({...s,unit:u})); if(step==='name'&&!draft.name) setDraft(d=>({...d,unit:u}));}} className="border border-gray-200 rounded-lg px-2 py-2 text-xs bg-white">
            <option value="piece">Sabhi ke liye: Piece</option>
            <option value="pack">Sabhi ke liye: Strip/Packet</option>
            <option value="weight">Sabhi ke liye: ₹/kg</option>
            <option value="volume">Sabhi ke liye: ₹/litre</option>
            <option value="length">Sabhi ke liye: ₹/metre</option>
          </select>
          <label className="flex items-center justify-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2 py-2">
            <input type="checkbox" checked={addSettings.wantExpiry} onChange={e=>setAddSettings(s=>({...s,wantExpiry:e.target.checked}))}/>
            Expiry date lena hai?
          </label>
        </div>

        <select value={addShopId} onChange={e=>setAddShopId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mb-3">{shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>

        <div className="border border-violet-100 bg-violet-50/50 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-violet-600">
              {step==='name' && `Step ${stepIdx+1}/${steps.length}: Product ka naam boliye ya likhiye`}
              {step==='price' && `Step ${stepIdx+1}/${steps.length}: Price boliye ya likhiye`}
              {step==='stock' && `Step ${stepIdx+1}/${steps.length}: Stock boliye ya likhiye`}
              {step==='expiry' && `Step ${stepIdx+1}/${steps.length}: Expiry date (optional) boliye ya calendar se chuniye`}
            </div>
            <div className="text-[10px] text-gray-400">{draft.name || "Naya product"}</div>
          </div>

          {step==='name' && <>
            <div className="flex gap-2 mb-2">
              <VoiceInput onText={(heard)=>{const name=heard.trim(); if(name) setDraft(d=>({...d,name:name.charAt(0).toUpperCase()+name.slice(1)}));}}/>
              <select value={draft.unit} onChange={e=>setDraft(d=>({...d,unit:e.target.value}))} className="border border-gray-200 rounded-lg px-2 text-xs">
                <option value="piece">Piece</option>
                <option value="pack">Strip/Packet</option>
                <option value="weight">₹/kg</option>
                <option value="volume">₹/litre</option>
                <option value="length">₹/metre</option>
              </select>
            </div>
            <input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} placeholder="Product naam" className="w-full border rounded-xl px-3 py-2 text-sm"/>
          </>}

          {step==='price' && <>
            <div className="flex gap-2 mb-2"><VoiceInput onText={(heard)=>{const n=firstNumber(heard); if(n) setDraft(d=>({...d,price:n}));}}/></div>
            <input value={draft.price} onChange={e=>setDraft(d=>({...d,price:e.target.value.replace(/[^0-9.]/g,"")}))} placeholder={`Price ${unitLabel(draft.unit)}`} className="w-full border rounded-xl px-3 py-2 text-sm"/>
          </>}

          {step==='stock' && <>
            <div className="flex gap-2 mb-2"><VoiceInput onText={(heard)=>{const n=firstNumber(heard); if(n) setDraft(d=>({...d,stock:n}));}}/></div>
            <input value={draft.stock} onChange={e=>setDraft(d=>({...d,stock:e.target.value.replace(/[^0-9.]/g,"")}))} placeholder={draft.unit==="pack"?"Stock (strips)":"Starting stock"} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>
            {draft.unit==="pack" && <input value={draft.packSize} onChange={e=>setDraft(d=>({...d,packSize:e.target.value.replace(/\D/g,"")}))} placeholder="1 strip me kitni tablets" className="w-full border rounded-xl px-3 py-2 text-sm"/>}
          </>}

          {step==='expiry' && <>
            <div className="flex gap-2 mb-2"><VoiceInput onText={(heard)=>{const d=parseExpiry(heard); if(d) setDraft(x=>({...x,expiryDate:d}));}}/></div>
            <input type="date" value={draft.expiryDate} onChange={e=>setDraft(d=>({...d,expiryDate:e.target.value}))} className="w-full border rounded-xl px-3 py-2 text-sm"/>
          </>}

          <div className="flex gap-2 mt-3">
            {stepIdx>0 && <button onClick={goBack} className="flex-1 bg-gray-100 py-2.5 rounded-xl text-sm font-semibold">← Peeche</button>}
            <button disabled={!stepValid} onClick={advanceOrCommit} className="flex-1 bg-gray-900 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-bold">{stepIdx===steps.length-1 ? "✓ Review me daalo" : "Aage →"}</button>
          </div>
        </div>

        <input value={draft.code} onChange={e=>setDraft(d=>({...d,code:e.target.value}))} placeholder="Barcode (optional)" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>
        <button onClick={()=>setShowScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Ya barcode scan kariye</button>

        {pending.length>0 && <div className="mt-4 border-t pt-3"><div className="flex justify-between items-center mb-2"><div className="font-bold text-sm">Review ({pending.length}) — har box check/bhariye</div><button onClick={()=>setPending([])} className="text-xs text-red-500">Clear</button></div>
          {pending.map((p,i)=>{
            const issue = pendingIssue(p);
            const bad = (field) => issue===field ? 'border-red-300 bg-red-50' : 'border-gray-200';
            return <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
              <div className="flex justify-between items-center mb-2"><div className="text-[11px] font-bold text-gray-400">Product {i+1}</div><button onClick={()=>setPending(x=>x.filter((_,j)=>j!==i))} className="text-red-400"><Trash2 size={14}/></button></div>
              <input value={p.name||""} onChange={e=>updatePending(i,{name:e.target.value})} placeholder="Product naam" className={`w-full border rounded-lg px-3 py-2 text-sm mb-2 ${bad('naam')}`}/>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select value={p.unit||"piece"} onChange={e=>updatePending(i,{unit:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="piece">Piece</option>
                  <option value="pack">Strip / Packet</option>
                  <option value="weight">₹ / kg</option>
                  <option value="volume">₹ / litre</option>
                  <option value="length">₹ / metre</option>
                </select>
                <input value={p.price??""} onChange={e=>updatePending(i,{price:e.target.value.replace(/[^0-9.]/g,"")})} placeholder="Price" className={`border rounded-lg px-3 py-2 text-sm ${bad('price')}`}/>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input value={p.stock??""} onChange={e=>updatePending(i,{stock:e.target.value.replace(/[^0-9.]/g,"")})} placeholder={p.unit==="pack"?"Stock (strips)":"Starting stock"} className={`border rounded-lg px-3 py-2 text-sm ${bad('stock')}`}/>
                {p.unit==="pack"
                  ? <input value={p.packSize??10} onChange={e=>updatePending(i,{packSize:e.target.value.replace(/\D/g,"")})} placeholder="1 strip me tablets" className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
                  : <input type="date" value={p.expiryDate||""} onChange={e=>updatePending(i,{expiryDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>}
              </div>
              <input value={p.code||""} onChange={e=>updatePending(i,{code:e.target.value})} placeholder="Barcode (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
              {issue && <div className="text-[10px] text-red-500 mt-1">Yeh field voice se nahi mili — khud bhar dijiye.</div>}
            </div>;
          })}
          <button disabled={busy} onClick={commitPending} className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">{busy?'Adding…':`✓ Add ${pending.length} Product(s)`}</button>
        </div>}
      </div>
    </div>

    {showScan && <BarcodeScanModal subtitle="Product barcode scan kariye" onClose={()=>setShowScan(false)} onDetected={handleScan}/>}
    {editingScan && <BarcodeScanModal subtitle="Correction ke liye barcode scan kariye" onClose={()=>setEditingScan(false)} onDetected={(item)=>{setEditingScan(false);setEditing(e=>({...e,barcode:item.code||e.barcode||"",name:item.name||e.name,price:item.suggestedPrice||e.price}));}}/>}
    {editing && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-3"><div className="font-bold">Edit Product</div><button onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="flex gap-2 mb-3"><VoiceInput onText={(text)=>{const parsed=parseProductVoice(text);if(parsed)setEditing(e=>({...e,name:parsed.name||e.name,price:parsed.price??e.price,stock:parsed.stock??e.stock,unit:parsed.unit||e.unit,expiryDate:parsed.expiryDate||e.expiryDate,packSize:parsed.packSize||e.packSize}));}}/><button onClick={()=>setEditingScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Scan</button></div><input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Product name"/><div className="grid grid-cols-2 gap-2 mb-2"><input value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value.replace(/[^0-9.]/g,"")})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Price"/><input value={editing.stock} onChange={e=>setEditing({...editing,stock:e.target.value.replace(/[^0-9.]/g,"")})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Stock"/></div><select value={editing.unit||'piece'} onChange={e=>setEditing({...editing,unit:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"><option value="piece">Piece</option><option value="pack">Strip / Packet</option><option value="weight">Weight</option><option value="volume">Volume</option><option value="length">Length</option></select>{editing.unit==='pack'&&<input value={editing.packSize||10} onChange={e=>setEditing({...editing,packSize:e.target.value.replace(/\D/g,"")})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Tablets per strip"/>}<input type="date" value={editing.expiryDate||""} onChange={e=>setEditing({...editing,expiryDate:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/><input value={editing.barcode||""} onChange={e=>setEditing({...editing,barcode:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Barcode"/><label className="flex items-center gap-3 border border-dashed rounded-xl p-3 mb-3"><div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">{imagePreview?<img src={imagePreview} className="w-full h-full object-cover"/>:<Camera size={20}/>}</div><span className="text-xs text-gray-500 flex-1">Photo add/change</span><input ref={editFileRef} type="file" accept="image/*" capture="environment" onChange={pickImage} className="hidden"/><button type="button" onClick={()=>editFileRef.current?.click()} className="text-xs font-bold text-violet-600">Choose</button></label><div className="flex gap-2"><button onClick={()=>setEditing(null)} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button><button disabled={busy} onClick={saveEdit} className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-bold">Save</button></div></div></div>}
  </div>;
}

/* ============================================================================
   FILE: screens/ShopReportScreen.jsx
   Shop owner's own "Intelligence" — today/week/month totals, per-product
   sell-through %, and a slow-mover alert that one-taps into a Flash Deal
   (same paid feature already in DealsTab — this just makes it easy to find).
============================================================================ */
