import React, { useState, useRef, useEffect } from "react";
import { X, Camera, ImagePlus, CheckCircle2, Mic, PackagePlus } from "lucide-react";
import VoiceInput from "../../components/VoiceInput";
import { uploadProductImage } from "../../lib/uploadImage";
import { emptyCategoryData } from "../shops/ProductCategoryFields";

const UNITS = [["piece", "Piece"], ["weight", "Kg"], ["volume", "Litre"], ["length", "Meter"]];
const field = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 placeholder:text-slate-400";

export default function ExpressAddSheet({ shop, mode = "cart", onSave, onAdded, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("piece");
  const [qty, setQty] = useState(mode === "cart" ? "1" : "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState([]);
  const [voiceStep, setVoiceStep] = useState("name");
  const ref = useRef(null);
  const qtyLabel = { piece: "pcs", weight: "kg", volume: "litre", length: "meter" }[unit];

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Sirf photo chuniye.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const acceptVoice = (spoken) => {
    const text = String(spoken || "").trim();
    if (!text) return;
    if (voiceStep === "name") { setName(text); setVoiceStep("price"); }
    else if (voiceStep === "price") {
      const n = text.match(/\d+(?:[.,]\d{1,2})?/);
      if (n) { setPrice(n[0].replace(",", ".")); setVoiceStep(mode === "cart" ? "qty" : "done"); }
      else alert("Price samajh nahi aaya. Sirf amount boliye, jaise 100.");
    } else if (voiceStep === "qty") {
      const n = text.match(/\d+(?:[.,]\d+)?/);
      if (n) { setQty(n[0].replace(",", ".")); setVoiceStep("done"); }
      else alert("Quantity samajh nahi aayi. Dobara boliye.");
    }
  };
  const reset = () => {
    setName(""); setPrice(""); setQty(mode === "cart" ? "1" : "");
    setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
    setVoiceStep("name"); if (ref.current) ref.current.value = "";
  };
  const save = async () => {
    if (!name.trim() || !(Number(price) > 0)) return alert("Product ka naam aur sahi price zaroori hai.");
    const q = Number(qty) || 0;
    if (mode === "cart" && !(q > 0)) return alert("Kitni quantity bech rahe hain, woh daaliye.");
    setBusy(true);
    try {
      const imageUrl = file ? await uploadProductImage(shop.id, file) : null;
      const product = await onSave({
        name: name.trim(), price: Number(price), unit, stock: q, imageUrl, qty: q,
        categoryData: { ...emptyCategoryData(shop.category), pending: true, quick: true },
      });
      if (!product) return;
      if (mode === "cart") { onAdded?.(product, q); return; }
      setAdded((a) => [name.trim(), ...a].slice(0, 6));
      reset();
    } finally { setBusy(false); }
  };

  const steps = mode === "cart"
    ? [{ id: "name", label: "Product naam" }, { id: "price", label: "Price" }, { id: "qty", label: "Quantity" }]
    : [{ id: "name", label: "Product naam" }, { id: "price", label: "Price" }];
  const voiceLabel = steps.find(x => x.id === voiceStep)?.label || "Voice entry complete";

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
    <section className="w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/70 bg-white shadow-2xl sm:rounded-[28px] max-h-[94dvh]" role="dialog" aria-modal="true" aria-label="Quick add product">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><PackagePlus size={21}/></div>
          <div><div className="text-base font-extrabold tracking-tight text-slate-900">{mode === "cart" ? "Quick add to bill" : "Quick product add"}</div><div className="text-[11px] text-slate-500">{shop?.name || "Your shop"} · Fast entry</div></div>
        </div>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-full bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40" aria-label="Close"><X size={18}/></button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-3.5">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-violet-900">Quick voice entry</span><span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-violet-700">{voiceLabel}</span></div>
          <div className="mb-3 flex gap-1.5">{steps.map((s, i) => <div key={s.id} className={`h-1.5 flex-1 rounded-full ${steps.findIndex(x => x.id === voiceStep) >= i || voiceStep === "done" ? "bg-violet-600" : "bg-violet-200"}`}/>)}</div>
          {voiceStep === "done" ? <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17}/> Voice details captured. Save kar sakte hain.</div> : <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-sm font-bold text-slate-800">Ab {voiceLabel.toLowerCase()} boliye</div><div className="text-[11px] text-slate-500">Har baar sirf ek detail boliye. App agla field khud kholega.</div></div><div className="shrink-0"><VoiceInput onDone={acceptVoice}/></div></div>}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => ref.current?.click()} className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700 transition hover:bg-violet-100">
            {preview ? <img src={preview} alt="Product preview" className="h-full w-full object-cover"/> : <span className="flex flex-col items-center gap-1"><Camera size={25}/><span className="text-[10px] font-bold">Add photo</span></span>}
            {preview && <span className="absolute bottom-1 right-1 rounded-full bg-white p-1 text-violet-700 shadow"><ImagePlus size={13}/></span>}
          </button>
          <input ref={ref} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden"/>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="text-sm font-bold text-slate-800">Product photo</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">Camera se photo lein ya gallery se choose karein. Photo optional hai; billing nahi rukegi.</div>
            {file && <button type="button" onClick={() => { URL.revokeObjectURL(preview); setFile(null); setPreview(null); }} className="mt-1 self-start text-[11px] font-bold text-rose-600">Remove photo</button>}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Product name <span className="text-rose-500">*</span></span><input value={name} onChange={e => setName(e.target.value)} placeholder="Jaise Paracetamol 500 mg" className={field} autoFocus/></label>
          <div className="grid grid-cols-[1fr_112px] gap-2.5">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Selling price <span className="text-rose-500">*</span></span><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">₹</span><input value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" className={field + " pl-8"}/></div></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Unit</span><select value={unit} onChange={e => setUnit(e.target.value)} className={field + " h-[49px] px-2"}>{UNITS.map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{mode === "cart" ? `Sale quantity (${qtyLabel})` : `Opening stock (${qtyLabel}, optional)`}{mode === "cart" && <span className="text-rose-500"> *</span>}</span><input value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={mode === "cart" ? "1" : "Stock baad mein bhi bhar sakte hain"} inputMode="decimal" className={field}/></label>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900"><strong>Baaki details baad mein.</strong> Ye product incomplete mark hoga. Barcode, expiry, brand aur category details My Shop mein reminder se complete kar sakte hain.</div>
        <button type="button" disabled={busy || !name.trim() || !(Number(price) > 0) || (mode === "cart" && !(Number(qty) > 0))} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Saving product…" : <><CheckCircle2 size={18}/> {mode === "cart" ? "Save & Add to Cart" : "Save product"}</>}</button>
        {added.length > 0 && <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">✓ Added: {added.join(", ")}. Inki remaining details baad mein complete kar lena.</div>}
        {mode === "catalog" && <button type="button" onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500">Done for now</button>}
      </div>
    </section>
  </div>;
}
