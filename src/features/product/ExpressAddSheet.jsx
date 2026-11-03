import React, { useMemo, useRef, useState } from "react";
import { X, Camera, Mic, Package, Pill, CheckCircle2 } from "lucide-react";
import VoiceInput from "../../components/VoiceInput";
import { uploadProductImage } from "../../lib/uploadImage";
import { emptyCategoryData } from "../shops/ProductCategoryFields";

const input = "w-full border border-gray-200 rounded-xl px-3 py-3 text-base outline-none bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const numberOnly = (v) => String(v || "").replace(/[^0-9.]/g, "");
const firstNumber = (v) => {
  const m = String(v || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
};

export default function ExpressAddSheet({ shop, mode = "cart", onSave, onAdded, onClose }) {
  const pharmacy = shop?.category === "Pharmacy";
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState(pharmacy ? "pack" : "piece");
  const [packSize, setPackSize] = useState("10");
  const [qty, setQty] = useState(mode === "cart" ? "1" : "");
  const [saleUnit, setSaleUnit] = useState(pharmacy ? "tablet" : "piece");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState([]);
  const [voiceStep, setVoiceStep] = useState("name");
  const ref = useRef(null);
  const size = Math.max(1, Number(packSize) || 10);
  const isPack = unit === "pack";
  const baseQty = isPack ? (saleUnit === "strip" ? Number(qty || 0) * size : Number(qty || 0)) : Number(qty || 0);
  const amount = isPack ? (saleUnit === "strip" ? Number(qty || 0) * Number(price || 0) : (Number(qty || 0) * Number(price || 0) / size)) : Number(qty || 0) * Number(price || 0);
  const voicePrompts = { name: "Pehle product ka naam boliye", price: isPack ? "Ab ek patte ka price boliye" : "Ab price boliye", packSize: "Ab ek patte mein kitni goli hain boliye", qty: mode === "cart" ? (saleUnit === "tablet" ? "Ab kitni goli chahiye boliye" : "Ab kitne patte chahiye boliye") : "Ab stock quantity boliye" };

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Sirf photo chuniye.");
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const handleVoice = (spoken) => {
    const value = String(spoken || "").trim();
    if (!value) return;
    if (voiceStep === "name") { setName(value); setVoiceStep("price"); return; }
    const n = firstNumber(value);
    if (!n) return alert("Number saaf nahi suna. Dobara boliye.");
    if (voiceStep === "price") { setPrice(n); setVoiceStep(isPack ? "packSize" : "qty"); return; }
    if (voiceStep === "packSize") { setPackSize(n); setVoiceStep("qty"); return; }
    if (voiceStep === "qty") { setQty(n); setVoiceStep("name"); }
  };
  const reset = () => {
    setName(""); setPrice(""); setQty(mode === "cart" ? "1" : "");
    setFile(null); setPreview(null); setVoiceStep("name");
    if (ref.current) ref.current.value = "";
  };
  const save = async () => {
    if (!name.trim() || !(Number(price) > 0)) return alert("Naam aur price zaroori hai.");
    if (isPack && !(size > 0)) return alert("Ek patte mein kitni goli hain, woh daaliye.");
    const q = Number(qty) || 0;
    if (mode === "cart" && !(q > 0)) return alert("Kitni quantity bech rahe hain?");
    setBusy(true);
    try {
      const imageUrl = file ? await uploadProductImage(shop.id, file) : null;
      // App.addProduct stores pack stock in base tablets, so pass stock in strips.
      const stockInPacks = isPack ? baseQty / size : q;
      const product = await onSave({
        name: name.trim(), price: Number(price), unit, stock: mode === "cart" ? stockInPacks : (Number(qty) || 0),
        imageUrl, qty: q, packSize: isPack ? size : null, saleUnit: isPack ? saleUnit : "piece",
        categoryData: { ...emptyCategoryData(shop.category), pending: true, quick: true, ...(isPack ? { unitsPerPack: size } : {}) },
      });
      if (!product) return;
      if (mode === "cart") { onAdded?.(product, q, isPack ? saleUnit : "piece"); return; }
      setAdded((a) => [name.trim(), ...a].slice(0, 6));
      reset();
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onClose}>
    <div className="w-full max-w-md mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-5 max-h-[94vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-start mb-5">
        <div><div className="text-xl font-black tracking-tight text-slate-900">⚡ Quick Add Product</div><div className="text-xs text-slate-500 mt-1">Abhi billing karein, baaki details baad mein.</div></div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={18}/></button>
      </div>
      <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-violet-50 border border-violet-100">
        <button type="button" onClick={() => ref.current?.click()} className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-violet-300 text-violet-600 flex flex-col items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">{preview ? <img src={preview} alt="Product preview" className="w-full h-full object-cover"/> : <><Camera size={24}/><span className="mt-1">Photo add</span></>}</button>
        <input ref={ref} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden"/>
        <div className="min-w-0 flex-1"><div className="font-bold text-sm text-slate-800">Product photo</div><div className="text-xs text-slate-500 mt-1">Camera se photo lein ya gallery se chunein.</div><div className="text-[10px] text-violet-700 mt-2">Voice entry: ek waqt mein ek field</div></div>
      </div>
      <div className="rounded-2xl border border-slate-200 p-3 mb-3">
        <div className="flex items-center justify-between mb-2"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Voice assistant</div><span className="text-[10px] font-bold text-violet-700 bg-violet-50 rounded-full px-2 py-1">{voiceStep === "name" ? "1" : voiceStep === "price" ? "2" : voiceStep === "packSize" ? "3" : "4"} / {isPack ? "4" : "3"}</span></div>
        <div className="text-sm font-semibold text-slate-800 mb-2">{voicePrompts[voiceStep]}</div>
        <VoiceInput onDone={handleVoice}/>
        <div className="text-[10px] text-slate-400 mt-2">Naam → Price → {isPack ? "Goli per patta → Quantity" : "Quantity"}</div>
      </div>
      <label className="block text-xs font-bold text-slate-600 mb-1">Product name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jaise: Paracetamol 500mg" className={input + " mb-3"} autoFocus/>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div><label className="block text-xs font-bold text-slate-600 mb-1">{isPack ? "Patte ka price (₹)" : "Price (₹)"}</label><input value={price} onChange={(e) => setPrice(numberOnly(e.target.value))} placeholder="100" inputMode="decimal" className={input}/></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">Product unit</label><select value={unit} onChange={(e) => { setUnit(e.target.value); setSaleUnit(e.target.value === "pack" ? "tablet" : "piece"); }} className={input + " h-[50px]"}>{(pharmacy ? [["pack","Patta / Strip"],["piece","Piece"]] : [["piece","Pcs"],["weight","Kg"],["volume","Litre"],["length","Meter"]]).map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      {isPack && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-2"><Pill size={17}/> Strip / Patta setup</div>
        <label className="block text-xs font-semibold text-amber-900 mb-1">Ek patte mein kitni goli?</label>
        <input value={packSize} onChange={(e) => setPackSize(numberOnly(e.target.value))} inputMode="numeric" placeholder="10" className={input}/>
        <div className="text-[11px] text-amber-800 mt-2">₹{Number(price || 0).toFixed(2)} per patta · ₹{(Number(price || 0) / size).toFixed(2)} per goli</div>
        <div className="flex gap-2 mt-3">{[10,15,20].map((n) => <button type="button" key={n} onClick={() => setPackSize(String(n))} className={"px-3 py-1.5 rounded-lg text-xs font-bold " + (Number(packSize)===n ? "bg-amber-600 text-white" : "bg-white border border-amber-200 text-amber-900")}>{n} goli</button>)}</div>
      </div>}
      <label className="block text-xs font-bold text-slate-600 mb-1">{mode === "cart" ? "Customer kitni quantity le raha hai?" : "Opening stock"}</label>
      {isPack && mode === "cart" && <div className="grid grid-cols-2 gap-2 mb-2">{[["tablet","Goli"],["strip","Patta"]].map(([k,l]) => <button type="button" key={k} onClick={() => setSaleUnit(k)} className={"py-2.5 rounded-xl border text-sm font-bold " + (saleUnit===k ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-slate-200 text-slate-600")}>{l}</button>)}</div>}
      <input value={qty} onChange={(e) => setQty(numberOnly(e.target.value))} placeholder={mode === "cart" ? (isPack ? (saleUnit === "tablet" ? "Kitni goli? e.g. 12" : "Kitne patte?") : "Quantity") : (isPack ? "Stock kitne patte?" : "Stock quantity")} inputMode="decimal" className={input + " mb-2"}/>
      {mode === "cart" && qty && price && <div className="flex justify-between items-center rounded-xl bg-emerald-50 px-3 py-3 mb-3"><span className="text-sm font-semibold text-emerald-800">Estimated bill</span><span className="text-lg font-black text-emerald-700">₹{amount.toFixed(2)}</span></div>}
      {mode === "cart" ? <button disabled={busy} onClick={save} className="w-full bg-gradient-to-r from-violet-700 to-indigo-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-violet-200">{busy ? "Saving product…" : "✓ Save & Add to Cart"}</button> :
        <div className="flex gap-2"><button disabled={busy} onClick={save} className="flex-1 bg-violet-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{busy ? "Saving…" : "✓ Save Product"}</button><button onClick={onClose} className="px-5 bg-slate-100 rounded-xl font-bold text-slate-600">Done</button></div>}
      {added.length > 0 && <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 rounded-xl p-3"><CheckCircle2 size={15} className="inline mr-1"/>Added: {added.join(", ")}. Inki baaki details baad mein complete karein.</div>}
      {mode === "catalog" && <div className="text-[10px] text-slate-400 mt-3 flex items-center gap-1"><Package size={13}/> Product details baad mein My Shop se complete kar sakte hain.</div>}
    </div>
  </div>;
}
