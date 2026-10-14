import React, { useRef, useState } from "react";
import { X, Plus } from "lucide-react";

const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none bg-white";

// Phone photos are 4-8 MB; shrink before upload so storage and customer data stay small.
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

// Extra angles + description (+ MRP) stored inside product.category_data -> no DB change needed.
export default function ProductExtraFields({ category, value = {}, onChange, upload }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const images = Array.isArray(value.images) ? value.images : [];
  const set = (k, v) => onChange({ ...value, [k]: v });

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 6 - images.length);
    if (!files.length) return;
    setBusy(true);
    const urls = [];
    for (const f of files) { const u = await upload(await compress(f)); if (u) urls.push(u); }
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (urls.length < files.length) alert("Kuch photos upload nahi hui. Dobara try kariye.");
    if (urls.length) onChange({ ...value, images: [...images, ...urls] });
  };

  return <div className="mt-3 space-y-2 border border-emerald-100 bg-emerald-50/40 rounded-xl p-3">
    <div className="text-[11px] font-bold text-emerald-700">📸 Premium view: extra photos aur details</div>
    <div className="text-[10px] text-gray-500">Upar wali main photo ke alawa alag angle ki photos daalo (max 6). Customer swipe aur zoom kar sakega.</div>
    <div className="flex gap-2 flex-wrap">
      {images.map((u, i) => <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border"><img src={u} alt="" className="w-full h-full object-cover"/><button type="button" onClick={() => set("images", images.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"><X size={12}/></button></div>)}
      {images.length < 6 && <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-600 flex flex-col items-center justify-center text-[10px] font-bold">{busy ? "…" : <><Plus size={16}/>Photo</>}</button>}
    </div>
    <input ref={ref} type="file" accept="image/*" multiple onChange={pick} className="hidden"/>
    <textarea value={value.description || ""} onChange={(e) => set("description", e.target.value.slice(0, 500))} rows={3} placeholder="Product ke baare me likho (optional)" className={input}/>
    {category !== "Pharmacy" && <input value={value.mrp || ""} onChange={(e) => set("mrp", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="MRP / purana price (discount dikhane ke liye, optional)" className={input}/>}
    {["Clothing", "Footwear"].includes(category) && <div className="text-[10px] text-gray-500">Tip: Size me "S, M, L, XL" aur Color me "Red, Blue" likho, customer chip se chunega.</div>}
  </div>;
}
