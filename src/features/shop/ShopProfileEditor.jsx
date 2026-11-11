import React, { useState, useRef } from "react";
import { Camera } from "lucide-react";

// Public shop profile fields (logo, cover, about, WhatsApp, opening hours). Saved on the shop row; owner-only via RLS.
export default function ShopProfileEditor({ shop, uploadImage, onSave }) {
  const [f, setF] = useState({ about: shop.about || "", whatsapp: shop.whatsapp || "", opening_hours: shop.opening_hours || "", logo_url: shop.logo_url || "", cover_url: shop.cover_url || "" });
  const [busy, setBusy] = useState(false);
  const logoRef = useRef(null), coverRef = useRef(null);
  const pick = async (key, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Sirf image file choose karein.");
    setBusy(true);
    const url = await uploadImage(shop.id, file);
    setBusy(false);
    if (!url) return alert("Photo upload nahi ho payi.");
    setF((x) => ({ ...x, [key]: url }));
  };
  const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white";
  return <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
    <div className="font-extrabold text-sm">Shop Profile</div>
    <div className="relative h-28 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">{f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover"/> : <Camera size={22} className="text-gray-400"/>}
      <button onClick={() => coverRef.current?.click()} className="absolute bottom-2 right-2 text-[11px] font-bold bg-white/90 px-3 py-1.5 rounded-lg">Cover photo</button></div>
    <div className="flex items-center gap-3"><div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">{f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover"/> : <Camera size={18} className="text-gray-400"/>}</div><button onClick={() => logoRef.current?.click()} className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-2 rounded-lg">Logo / profile photo</button></div>
    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick("logo_url", e.target.files?.[0])}/>
    <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick("cover_url", e.target.files?.[0])}/>
    <textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder="Shop ke bare me (optional)" rows={2} className={input}/>
    <input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value.replace(/[^\d+]/g, "") })} placeholder="WhatsApp number (optional)" className={input}/>
    <input value={f.opening_hours} onChange={(e) => setF({ ...f, opening_hours: e.target.value })} placeholder="Opening hours, jaise 9:00 AM – 9:00 PM" className={input}/>
    <button disabled={busy} onClick={() => onSave(shop.id, { about: f.about || null, whatsapp: f.whatsapp || null, opening_hours: f.opening_hours || null, logo_url: f.logo_url || null, cover_url: f.cover_url || null })} className="w-full bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">{busy ? "Uploading…" : "Profile save karo"}</button>
    <div className="text-[10px] text-gray-400">Logo/cover upload existing "product-images" storage bucket use karta hai.</div>
  </div>;
}
