import React, { useState, useRef } from "react";
import { X, Plus } from "lucide-react";
import { formatINR } from "../../data/mockData";
import BroadcastCard from "./BroadcastCard";

const PRICE = 19;
const KINDS = [["new_arrival", "🆕 Naya aaya"], ["special", "🔥 Special"], ["discount", "🏷️ Discount"]];
const HINT = {
  new_arrival: "Jaise: Aaj mere shop par ye naya shoes aaya hai — sirf ₹800!",
  special: "Jaise: Ye dekho mere shop par naya dress aaya, bas ₹999 me!",
  discount: "Jaise: Hamare is dawa par aaj ke liye 15% discount hai.",
};
const input = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white";

// Phone photos 4-8 MB hoti hain; upload se pehle chhota kar do.
async function compress(file, max = 1280, q = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q));
    return blob ? new File([blob], (file.name.replace(/\.[^.]+$/, "") || "photo").replace(/[^\w-]/g, "_") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export default function BroadcastPanel({ shops = [], broadcasts = [], uploadImage, onCreate }) {
  const [open, setOpen] = useState(false);
  const [shopId, setShopId] = useState(shops[0]?.id || "");
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("new_arrival");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef(null);
  const shop = shops.find((s) => s.id === shopId) || shops[0];
  if (!shop) return null;
  const mine = broadcasts.filter((b) => b.shopId === shop.id);
  const today = mine.filter((b) => Date.now() - b.createdAt < 86400000).length;
  const LIMIT = 5;

  const pickProduct = (id) => {
    setProductId(id);
    const p = shop.products.find((x) => x.id === id);
    if (!p) { return; }
    setTitle(p.name); setPrice(String(p.price));
    const imgs = [p.imageUrl, ...(Array.isArray(p.categoryData?.images) ? p.categoryData.images : [])].filter(Boolean);
    setImages([...new Set(imgs)].slice(0, 5));
  };
  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 5 - images.length);
    if (!files.length) return;
    setBusy(true);
    const urls = [];
    for (const f of files) { const u = await uploadImage(shop.id, await compress(f)); if (u) urls.push(u); }
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (urls.length < files.length) alert("Kuch photos upload nahi hui. Dobara try kariye.");
    if (urls.length) setImages((x) => [...x, ...urls]);
  };
  const priceN = Number(price) || 0, oldN = Number(oldPrice) || 0;
  const valid = title.trim() && priceN > 0 && (kind !== "discount" || oldN > priceN);
  const reset = () => { setProductId(""); setTitle(""); setPrice(""); setOldPrice(""); setMessage(""); setImages([]); };

  const submit = async () => {
    if (!valid || busy) return;
    if (today >= LIMIT) { alert(`Ek dukaan se 24 ghante me max ${LIMIT} broadcast ho sakte hain.`); return; }
    if (!window.confirm(`${formatINR(PRICE)} ka broadcast karein?\n(Abhi test mode hai — paisa nahi katega.)`)) return;
    setBusy(true);
    const ok = await onCreate({ shopId: shop.id, productId: productId || null, kind, title: title.trim(), price: priceN, oldPrice: kind === "discount" ? oldN : null, message: message.trim(), images });
    setBusy(false);
    if (ok) { reset(); setDone(true); setTimeout(() => setDone(false), 4000); }
  };

  const preview = { id: "preview", title: title || "Product ka naam", price: priceN || null, oldPrice: kind === "discount" ? oldN : null, kind, message, images, productId, createdAt: Date.now(), expiresAt: Date.now() + 48 * 3600000 };

  return <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden">
    <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
      <div><div className="font-extrabold text-sm">📣 Product Broadcast — {formatINR(PRICE)}</div><div className="text-xs text-gray-500 mt-0.5">Aas-paas ke sabhi users ko ek product ka message + photos</div></div>
      <span className="text-indigo-600 font-bold text-lg">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="p-4 space-y-3">
      {done && <div className="bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl p-3">✅ Broadcast live hai! Sabhi users ko 48 ghante tak dikhega.</div>}
      <div className="text-[11px] text-gray-500 bg-gray-50 rounded-xl p-2.5">Ek message me sirf <b>ek product</b>. Photos (max 5), price aur chhota message daalo. Live: 48 ghante. Abhi test mode — real payment baad me connect hoga.</div>
      {shops.length > 1 && <select value={shop.id} onChange={(e) => { setShopId(e.target.value); reset(); }} className={input}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      <div><div className="text-[11px] font-bold text-gray-600 mb-1">1. Kaunsa product?</div>
        <select value={productId} onChange={(e) => pickProduct(e.target.value)} className={input}><option value="">➕ Naya / alag product (naam khud likho)</option>{shop.products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatINR(p.price)}</option>)}</select>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Product ka naam (e.g. Naya Sports Shoes)" className={input + " mt-2"}/></div>
      <div><div className="text-[11px] font-bold text-gray-600 mb-1">2. Message ka type</div><div className="flex gap-2">{KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${kind === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}</div></div>
      <div className="flex gap-2"><div className="flex-1"><div className="text-[11px] font-bold text-gray-600 mb-1">{kind === "discount" ? "Naya price ₹" : "Price ₹"}</div><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="800" className={input}/></div>{kind === "discount" && <div className="flex-1"><div className="text-[11px] font-bold text-gray-600 mb-1">Purana price ₹</div><input value={oldPrice} onChange={(e) => setOldPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1000" className={input}/></div>}</div>
      {kind === "discount" && oldN > 0 && priceN >= oldN && <div className="text-[11px] text-red-500">Purana price naye price se zyada hona chahiye.</div>}
      <div><div className="text-[11px] font-bold text-gray-600 mb-1">3. Photos (max 5)</div>
        <div className="flex gap-2 flex-wrap">{images.map((u, i) => <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border"><img src={u} alt="" className="w-full h-full object-cover"/><button type="button" onClick={() => setImages((x) => x.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"><X size={12}/></button></div>)}{images.length < 5 && <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 flex flex-col items-center justify-center text-[10px] font-bold">{busy ? "…" : <><Plus size={16}/>Photo</>}</button>}</div>
        <input ref={ref} type="file" accept="image/*" multiple onChange={addPhotos} className="hidden"/></div>
      <div><div className="text-[11px] font-bold text-gray-600 mb-1">4. Message</div><textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 160))} rows={3} placeholder={HINT[kind]} className={input}/><div className="text-[10px] text-gray-400 text-right">{message.length}/160</div></div>
      <div><div className="text-[11px] font-bold text-gray-600 mb-1">Customer ko aisa dikhega:</div><BroadcastCard b={preview} shop={shop} onOpen={() => {}}/></div>
      {today >= LIMIT && <div className="text-xs text-red-500">Aaj ki limit ({LIMIT}) poori ho gayi. Kal dobara try kariye.</div>}
      <button disabled={!valid || busy || today >= LIMIT} onClick={submit} className="w-full bg-indigo-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl">{busy ? "Please wait…" : `📣 Broadcast karo — ${formatINR(PRICE)}`}</button>
      {mine.length > 0 && <div><div className="text-[11px] font-bold text-gray-500 mb-1">Aapke live broadcasts</div>{mine.map((b) => <div key={b.id} className="text-xs bg-gray-50 rounded-lg p-2 mb-1 flex justify-between"><span className="truncate">{b.title}{b.price != null ? ` — ${formatINR(b.price)}` : ""}</span><span className="text-gray-400 ml-2">{Math.max(1, Math.ceil((b.expiresAt - Date.now()) / 3600000))}h baaki</span></div>)}</div>}
    </div>}
  </div>;
}
