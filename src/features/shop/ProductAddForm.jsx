import React, { useState } from "react";
import { ScanLine } from "lucide-react";
import VoiceInput from "../../components/VoiceInput";

import { uploadProductImage } from "../../lib/uploadImage";
import { setInventoryMeta } from "../../lib/inventory";
import ProductCategoryFields, { emptyCategoryData, CATEGORY_META } from "../shops/ProductCategoryFields";
import ProductExtraFields from "../shops/ProductExtraFields";
import { BarcodeScanModal } from "../shops/ShopForms";
import OcrScanButton from "../../components/OcrScanButton";
import ExpressAddSheet from "../product/ExpressAddSheet";

const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white";
const UNIT_LABEL = { pack: "Strip / Patta", piece: "Piece", weight: "Kg", volume: "Litre", length: "Meter" };
const HINT = {
  Pharmacy: "Dolo 650 tablet, strength 650 mg, 15 goli ka patta, price 30, MRP 33, stock 100 patta, expiry december 2027, company Micro Labs",
  Clothing: "Cotton shirt, brand Raymond, size M L XL, color red blue, gender men, price 499, stock 12 piece",
  Footwear: "Sports shoes, brand Nike, size 7 8 9, colour black, price 999, stock 8 pair",
  Electronics: "Samsung Galaxy, brand Samsung, model M34, 8 GB RAM, 128 GB storage, 1 year warranty, price 17999, stock 5",
  Paint: "Apex emulsion, brand Asian Paints, shade ivory, finish matt, pack size 4 litre, price 850, stock 10",
};
const WANT = { Pharmacy: ["strength", "manufacturer"], Clothing: ["size", "color"], Footwear: ["size", "color"], Electronics: ["brand", "model", "warranty"], Paint: ["brand", "shade"] };
const blank = (category) => ({ name: "", price: "", stock: "", unit: category === "Pharmacy" ? "pack" : "piece", packSize: "10", expiryDate: "", code: "", categoryData: emptyCategoryData(category) });

// EK hi Add Product form: voice se poora bhar sakte ho, ya haath se, ya Fast Add (bheed ke liye).
export default function ProductAddForm({ shops = [], onAddProduct }) {
  const [shopId, setShopId] = useState(shops[0]?.id);
  const shop = shops.find((s) => s.id === shopId) || shops[0];
  const category = shop?.category || "Pharmacy";
  const [draft, setDraft] = useState(() => blank(category));
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const [showScan, setShowScan] = useState(false);
  const [express, setExpress] = useState(false);
  const [wantExpiry, setWantExpiry] = useState(false);
  const [voiceStep, setVoiceStep] = useState("name");
  if (!shop) return null;
  const meta = CATEGORY_META[category];

  const changeShop = (id) => { setShopId(id); const c = shops.find((s) => s.id === id)?.category || "Pharmacy"; setDraft(blank(c)); setVoiceStep("name"); };
  const setCat = (categoryData) => setDraft((d) => ({
    ...d, categoryData,
    unit: category === "Pharmacy" ? (["Tablet", "Capsule"].includes(categoryData.dosageForm || "Tablet") ? "pack" : "piece") : d.unit,
    packSize: categoryData.unitsPerPack || d.packSize,
  }));

  const voiceSteps = [
    { id: "name", label: "Product name" },
    { id: "price", label: "Selling price" },
    { id: "stock", label: "Stock quantity" },
    ...(category === "Pharmacy" ? [{ id: "expiry", label: "Expiry date" }] : []),
  ];
  const voiceStepIndex = voiceSteps.findIndex((s) => s.id === voiceStep);
  const applyVoiceStep = (spoken) => {
    const text = String(spoken || "").trim();
    if (!text) return;
    if (voiceStep === "name") {
      setDraft((d) => ({ ...d, name: text }));
      setVoiceStep("price");
      return;
    }
    const match = text.match(/\d+(?:[.,]\d+)?/);
    if (voiceStep === "price") {
      if (!match) return alert("Price samajh nahi aaya. Sirf amount boliye, jaise 100.");
      setDraft((d) => ({ ...d, price: match[0].replace(",", ".") }));
      setVoiceStep("stock");
      return;
    }
    if (voiceStep === "stock") {
      if (!match) return alert("Stock samajh nahi aaya. Quantity dobara boliye.");
      setDraft((d) => ({ ...d, stock: match[0].replace(",", ".") }));
      setVoiceStep(category === "Pharmacy" ? "expiry" : "done");
      return;
    }
    if (voiceStep === "expiry") {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
      if (parsed) {
        setDraft((d) => ({ ...d, expiryDate: parsed }));
        setVoiceStep("done");
      } else {
        alert("Expiry ko calendar se select karna zyada safe hai. Voice se naam, price aur stock bhar sakte hain.");
      }
    }
  };
  const advanceVoiceStep = () => {
    const i = voiceSteps.findIndex((s) => s.id === voiceStep);
    if (i >= 0) setVoiceStep(i === voiceSteps.length - 1 ? "done" : voiceSteps[i + 1].id);
  };

  const valid = draft.name.trim() && Number(draft.price) > 0 && draft.stock !== "" && !isNaN(Number(draft.stock)) && Number(draft.stock) >= 0;

  const save = async () => {
    if (!valid || busy) return;
    if (shop.products.some((p) => p.name.trim().toLowerCase() === draft.name.trim().toLowerCase()) && !window.confirm(`"${draft.name.trim()}" pehle se hai. Fir bhi naya jodna hai?`)) return;
    setBusy(true);
    try {
      const imageUrl = draft.categoryData?.images?.[0] || null;
      const packSize = draft.unit === "pack" ? Math.max(1, Number(draft.packSize || 10)) : null;
      const product = await onAddProduct(shop.id, draft.name.trim(), Number(draft.price), draft.unit, Number(draft.stock), imageUrl, draft.expiryDate || null, draft.code || null, packSize, draft.categoryData || {}, "manual");
      if (product?.id) {
        if (packSize) setInventoryMeta(product.id, { packSize });
        setRecent((r) => [draft.name.trim(), ...r].slice(0, 5));
        setDraft(blank(category)); setWantExpiry(false); setVoiceStep("name");
      }
    } finally { setBusy(false); }
  };

  // Photo OCR: only PRE-FILLS inputs (user reviews + saves). Pharmacy extras go into categoryData.
  const applyOcr = (p) => {
    if (p.expiryDate) setWantExpiry(true);
    setDraft((d) => ({
      ...d,
      name: p.name || d.name,
      price: p.mrp || d.price,
      expiryDate: p.expiryDate || d.expiryDate,
      categoryData: category === "Pharmacy"
        ? { ...(d.categoryData || {}), ...(p.batchNo ? { batchNo: p.batchNo } : {}), ...(p.mrp ? { mrp: p.mrp } : {}), ...(p.manufacturer ? { manufacturer: p.manufacturer } : {}), ...(p.strength ? { strength: p.strength } : {}) }
        : d.categoryData,
    }));
  };
  const scanned = (item) => { setShowScan(false); setDraft((d) => ({ ...d, code: item.code || d.code, name: d.name || item.name || "", price: d.price || (item.suggestedPrice ? String(item.suggestedPrice) : "") })); };

  return <div className="bg-white rounded-2xl p-4 border border-gray-100">
    <OcrScanButton className="mb-3" onResult={applyOcr} />
    <div className="flex items-start justify-between gap-2 mb-1">
      <div><div className="font-bold text-sm">➕ Product Add Karo</div><div className="text-[11px] text-gray-400">Bol ke ya haath se — ek hi form. {meta?.label}</div></div>
      <button onClick={() => setExpress(true)} className="flex-shrink-0 bg-amber-100 text-amber-700 text-xs font-extrabold px-3 py-2 rounded-xl">⚡ Fast Add</button>
    </div>
    {shops.length > 1 && <select value={shopId} onChange={(e) => changeShop(e.target.value)} className={input + " mt-2"}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}</select>}

    <div className="mt-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div><div className="text-xs font-extrabold text-violet-900">🎙️ Step-by-step voice entry</div><div className="mt-0.5 text-[10px] text-slate-500">Ek baar mein sirf ek field boliye</div></div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-violet-700">{voiceStep === "done" ? "Complete" : `${Math.max(1, voiceStepIndex + 1)} / ${voiceSteps.length}`}</span>
      </div>
      <div className="mb-3 flex gap-1.5">{voiceSteps.map((s, i) => <div key={s.id} className={`h-1.5 flex-1 rounded-full ${voiceStep === "done" || i < voiceStepIndex ? "bg-violet-600" : i === voiceStepIndex ? "bg-violet-400" : "bg-violet-200"}`}/>)}</div>
      {voiceStep === "done" ? <div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-emerald-700">✓ Basic voice details complete</div><button type="button" onClick={() => setVoiceStep("name")} className="text-[11px] font-bold text-violet-700">Start again</button></div> : <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="text-sm font-bold text-slate-800">Ab {voiceSteps[voiceStepIndex]?.label.toLowerCase()} boliye</div><div className="text-[10px] text-slate-500">{voiceStep === "name" ? "Jaise: Paracetamol 500 mg" : voiceStep === "price" ? "Jaise: 100 rupaye" : voiceStep === "stock" ? "Jaise: 20 strip" : "Expiry calendar se select karein"}</div></div>
        {voiceStep === "expiry" ? <button type="button" onClick={() => setVoiceStep("done")} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm">Skip</button> : <VoiceInput onDone={applyVoiceStep}/>}
      </div>}
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={advanceVoiceStep} disabled={voiceStep === "done"} className="text-[10px] font-bold text-violet-700 disabled:opacity-40">Manual field bhara → Agla step</button><button type="button" onClick={() => setVoiceStep("name")} className="text-[10px] font-semibold text-slate-500">Reset voice steps</button></div>
    </div>

    <div className="mt-3 space-y-2">
      <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Product ka naam *" className={input}/>
      <div className="grid grid-cols-2 gap-2">
        <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder={draft.unit === "pack" ? "Price / strip ₹ *" : "Selling price ₹ *"} inputMode="decimal" className={input}/>
        <input value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder={draft.unit === "pack" ? "Stock (strip) *" : "Stock *"} inputMode="decimal" className={input}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} className={input}>{Object.entries(UNIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {draft.unit === "pack" && category !== "Pharmacy" && <input value={draft.packSize} onChange={(e) => setDraft((d) => ({ ...d, packSize: e.target.value.replace(/\D/g, "") }))} placeholder="Ek pack me kitne" className={input}/>}
      </div>
      {(category === "Pharmacy" || wantExpiry) ? <div><div className="text-[11px] text-gray-500 mb-1">Expiry {category === "Pharmacy" ? "(dawai me zaroor)" : ""}</div><input type="date" value={draft.expiryDate} onChange={(e) => setDraft((d) => ({ ...d, expiryDate: e.target.value }))} className={input}/></div> : <button onClick={() => setWantExpiry(true)} className="text-[11px] text-violet-600 font-bold">+ Expiry date add karo</button>}
    </div>

    <div className="mt-3"><ProductCategoryFields category={category} value={draft.categoryData} onChange={setCat}/></div>
    <ProductExtraFields category={category} value={draft.categoryData || {}} upload={(f) => uploadProductImage(shop.id, f)} onChange={(categoryData) => setDraft((d) => ({ ...d, categoryData }))}/>
    {["wholesale","both"].includes(shop.shopType) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mt-2">
      <div className="text-xs font-bold text-amber-800 mb-2">Wholesale rate (optional)</div>
      <div className="grid grid-cols-2 gap-2">
        <input value={draft.categoryData?.wholesaleMinQty || ""} onChange={e=>setDraft(d=>({...d,categoryData:{...d.categoryData,wholesaleMinQty:e.target.value.replace(/[^0-9.]/g,"")}}))} placeholder="Minimum bulk qty" inputMode="decimal" className={input}/>
        <input value={draft.categoryData?.wholesalePrice || ""} onChange={e=>setDraft(d=>({...d,categoryData:{...d.categoryData,wholesalePrice:e.target.value.replace(/[^0-9.]/g,"")}}))} placeholder="Wholesale price ₹" inputMode="decimal" className={input}/>
      </div>
      <div className="text-[10px] text-amber-700 mt-1">Ye rate sirf same category ke logged-in shopkeepers ko dikhega; normal customer ko retail price hi dikhega.</div>
    </div>}

    <div className="flex gap-2 mt-3"><input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} placeholder="Barcode (optional)" className={input}/><button onClick={() => setShowScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 rounded-xl flex-shrink-0"><ScanLine size={14}/> Scan</button></div>

    <button disabled={!valid || busy} onClick={save} className="w-full mt-4 bg-emerald-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl">{busy ? "Saving…" : "✅ Product Save Karo"}</button>
    {!valid && <div className="text-[10px] text-gray-400 text-center mt-1">Naam, price aur stock zaroori hain.</div>}
    {recent.length > 0 && <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 rounded-xl p-2.5">✅ Abhi jode: {recent.join(", ")}</div>}

    {showScan && <BarcodeScanModal subtitle="Product ka barcode scan kariye" onClose={() => setShowScan(false)} onDetected={scanned}/>}
    {express && <ExpressAddSheet shop={shop} mode="catalog" onClose={() => setExpress(false)} onSave={(d) => onAddProduct(shop.id, d.name, d.price, d.unit, d.stock, d.imageUrl, null, null, null, d.categoryData, "express")}/>}
  </div>;
}
