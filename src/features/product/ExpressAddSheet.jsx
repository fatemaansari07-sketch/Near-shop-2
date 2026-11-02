import React, { useState, useRef } from "react";
import { X, Camera } from "lucide-react";
import VoiceInput from "../../components/VoiceInput";
import { parseProductForm } from "../../lib/voiceParser";
import { uploadProductImage } from "../../lib/uploadImage";
import { emptyCategoryData } from "../shops/ProductCategoryFields";

const UNITS = [["piece", "Pcs"], ["weight", "Kg"], ["volume", "Litre"], ["length", "Meter"]];
const input = "w-full border border-gray-200 rounded-xl px-3 py-3 text-base outline-none bg-white";

// Bheed ke waqt: photo + naam + price, bas. Baaki detail baad me ("detail baaki" ki yaad dilayi jati hai).
// mode="cart": naya item turant bill me jud jata hai. mode="catalog": jaldi-jaldi kai products list me.
export default function ExpressAddSheet({ shop, mode = "cart", onSave, onAdded, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("piece");
  const [qty, setQty] = useState(mode === "cart" ? "1" : "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState([]);
  const ref = useRef(null);
  const qtyLabel = { piece: "pcs", weight: "kg", volume: "litre", length: "meter" }[unit];

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Sirf photo chuniye.");
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const voice = (text) => {
    const p = parseProductForm(text, shop.category);
    if (p.name) setName(p.name);
    if (p.price != null) setPrice(String(p.price));
    if (p.stock != null && (mode === "cart" || p.stock > 0)) setQty(String(p.stock));
    if (p.unit && p.unit !== "pack") setUnit(p.unit);
  };
  const reset = () => { setName(""); setPrice(""); setQty(mode === "cart" ? "1" : ""); setFile(null); setPreview(null); if (ref.current) ref.current.value = ""; };

  const save = async () => {
    if (!name.trim() || !(Number(price) > 0)) return alert("Naam aur price zaroori hai.");
    const q = Number(qty) || 0;
    if (mode === "cart" && !(q > 0)) return alert("Kitna bech rahe ho? Quantity daaliye.");
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

  return <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
    <div className="flex justify-between items-start mb-3"><div><div className="font-extrabold text-lg">⚡ {mode === "cart" ? "Naya item — jaldi" : "Fast Add"}</div><div className="text-[11px] text-gray-400">Photo, naam aur price. Baaki detail baad me bhar lena.</div></div><button onClick={onClose}><X size={20}/></button></div>

    <div className="flex items-center gap-3 mb-3">
      <button type="button" onClick={() => ref.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 flex flex-col items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">{preview ? <img src={preview} alt="" className="w-full h-full object-cover"/> : <><Camera size={22}/>Photo</>}</button>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden"/>
      <div className="flex-1"><div className="text-[11px] text-gray-500 mb-1">Bol ke bhi bhar sakte ho: "Parle G 10 rupaye"</div><VoiceInput onDone={voice}/></div>
    </div>

    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product ka naam" className={input + " mb-2"} autoFocus/>
    <div className="flex gap-2 mb-2"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Price ₹" inputMode="decimal" className={input}/>
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-gray-200 rounded-xl px-2 text-sm bg-white">{UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
    <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={mode === "cart" ? `Kitna bech rahe? (${qtyLabel})` : `Stock (${qtyLabel}) — pata ho to`} inputMode="decimal" className={input + " mb-3"}/>

    {mode === "cart"
      ? <button disabled={busy} onClick={save} className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{busy ? "Saving…" : "✅ Save & Add to Cart"}</button>
      : <div className="flex gap-2"><button disabled={busy} onClick={save} className="flex-1 bg-violet-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{busy ? "Saving…" : "✅ Save & Naya"}</button><button onClick={onClose} className="px-5 bg-gray-100 rounded-xl font-bold text-gray-600">Done</button></div>}
    {added.length > 0 && <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 rounded-xl p-2.5">✅ Jode gaye: {added.join(", ")} — inki detail baad me My Shop me bharni hai.</div>}
  </div></div>;
}
