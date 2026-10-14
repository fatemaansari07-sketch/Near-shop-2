import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Share2, X, ChevronLeft, ChevronRight, Phone, MessageCircle, Navigation, Package, Minus, Plus } from "lucide-react";
import { formatINR, formatKm, distanceKm, UNIT_META, daysToExpiry } from "../../data/mockData";
import { displayPackStock } from "../../lib/inventory";

/* ---------- category specific layout ---------- */
const CAT = {
  Pharmacy: { emoji: "💊", name: "Medicine", rows: [["Medicine type", "dosageForm"], ["Strength", "strength"], ["Composition", "composition"], ["Pack", "packType"], ["Manufacturer", "manufacturer"], ["Batch No.", "batchNo"]] },
  Electronics: { emoji: "📱", name: "Electronics", rows: [["Brand", "brand"], ["Model", "model"], ["Variant", "variant"], ["RAM", "ram"], ["Storage", "storage"], ["Warranty", "warranty"]] },
  Clothing: { emoji: "👕", name: "Clothing", rows: [["Brand", "brand"], ["Type", "garmentType"], ["Gender", "gender"], ["Piece type", "pieceType"]] },
  Footwear: { emoji: "👟", name: "Footwear", rows: [["Brand", "brand"], ["Type", "footwearType"], ["Gender", "gender"], ["Sold as", "pairType"]] },
  Paint: { emoji: "🎨", name: "Paint", rows: [["Brand", "brand"], ["Type", "paintType"], ["Shade", "shade"], ["Shade code", "shadeCode"], ["Finish", "finish"], ["Pack size", "packSizeLabel"]] },
};
const splitList = (v) => String(v || "").split(/[,/|]+/).map((x) => x.trim()).filter(Boolean);
const rateLabel = (p) => ({ pack: "/strip", weight: "/kg", volume: "/L", length: "/m" }[p.unit] || "/pc");

function highlights(cat, d, p) {
  const days = p.expiryDate ? daysToExpiry(p.expiryDate) : null;
  const expiry = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";
  const list = {
    Pharmacy: [["💊", "Strength", d.strength || d.dosageForm], ["📦", "Pack size", d.unitsPerPack ? `${d.unitsPerPack} ${d.dosageForm === "Capsule" ? "capsules" : "tablets"}/${(d.packType || "strip").toLowerCase()}` : d.packType], ["📅", "Expiry", expiry]],
    Electronics: [["🏷️", "Brand", [d.brand, d.model].filter(Boolean).join(" ")], ["💾", "Memory", [d.ram, d.storage].filter(Boolean).join(" / ")], ["🛡️", "Warranty", d.warranty]],
    Clothing: [["📏", "Size", d.size], ["🎨", "Colour", d.color], ["👤", "Fit", [d.gender, d.garmentType].filter(Boolean).join(" · ")]],
    Footwear: [["📏", "Size", d.size], ["🎨", "Colour", d.color], ["👤", "Type", [d.gender, d.footwearType].filter(Boolean).join(" · ")]],
    Paint: [["🎨", "Shade", d.shade], ["🧴", "Pack", d.packSizeLabel], ["✨", "Finish", d.finish]],
  }[cat] || [];
  return { tiles: list.filter((x) => x[2]).slice(0, 3), days };
}

/* ---------- fullscreen zoom viewer (pinch, pan, double-tap, swipe) ---------- */
function ZoomViewer({ images, start = 0, onClose }) {
  const [idx, setIdx] = useState(start);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const box = useRef(null);
  const pts = useRef(new Map());
  const g = useRef({ d0: 0, s0: 1, x0: 0, y0: 0, px: 0, py: 0, moved: 0, lastTap: 0 });
  const reset = () => setT({ s: 1, x: 0, y: 0 });
  const go = (n) => { setIdx((i) => (i + n + images.length) % images.length); reset(); };
  const clamp = (s, x, y) => {
    const w = box.current?.clientWidth || 300, h = box.current?.clientHeight || 400;
    const mx = ((s - 1) * w) / 2, my = ((s - 1) * h) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  const dist = () => { const [a, b] = [...pts.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = g.current;
    if (pts.current.size === 2) { G.d0 = dist(); G.s0 = t.s; }
    else { G.px = e.clientX; G.py = e.clientY; G.x0 = t.x; G.y0 = t.y; G.moved = 0; }
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = g.current;
    if (pts.current.size === 2) {
      const s = Math.max(1, Math.min(4, (G.s0 * dist()) / (G.d0 || 1)));
      G.moved = 99;
      setT((p) => clamp(s, p.x, p.y));
    } else {
      G.moved = Math.max(G.moved, Math.hypot(e.clientX - G.px, e.clientY - G.py));
      if (t.s > 1) setT((p) => clamp(p.s, G.x0 + e.clientX - G.px, G.y0 + e.clientY - G.py));
    }
  };
  const up = (e) => {
    const G = g.current, had = pts.current.size;
    pts.current.delete(e.pointerId);
    if (had === 1) {
      const dx = e.clientX - G.px;
      if (t.s <= 1 && Math.abs(dx) > 60 && images.length > 1) { go(dx < 0 ? 1 : -1); return; }
      if (G.moved < 8) {
        const now = Date.now();
        if (now - G.lastTap < 300) { setT(t.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }); G.lastTap = 0; } else G.lastTap = now;
      }
    }
    if (pts.current.size === 0 && t.s < 1.02) reset();
  };
  return <div className="fixed inset-0 z-[60] bg-black flex flex-col">
    <div className="flex items-center justify-between px-4 pt-4 pb-2 text-white"><span className="text-xs bg-white/15 rounded-full px-3 py-1">{idx + 1} / {images.length}</span><button onClick={onClose} className="p-2"><X size={22}/></button></div>
    <div ref={box} className="flex-1 overflow-hidden flex items-center justify-center" style={{ touchAction: "none" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <img src={images[idx]} alt="" draggable={false} className="max-w-full max-h-full object-contain select-none" style={{ transform: `translate(${t.x}px,${t.y}px) scale(${t.s})`, transition: pts.current.size ? "none" : "transform .15s" }}/>
    </div>
    <div className="text-center text-white/70 text-[11px] py-2">🔍 Pinch ya double-tap karke zoom kariye{images.length > 1 ? " · swipe se agli photo" : ""}</div>
    {images.length > 1 && <div className="flex items-center justify-center gap-2 pb-5 px-3">
      <button onClick={() => go(-1)} className="text-white p-1"><ChevronLeft size={20}/></button>
      {images.map((u, i) => <button key={u + i} onClick={() => { setIdx(i); reset(); }} className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${i === idx ? "border-emerald-400" : "border-transparent opacity-60"}`}><img src={u} alt="" className="w-full h-full object-cover"/></button>)}
      <button onClick={() => go(1)} className="text-white p-1"><ChevronRight size={20}/></button>
    </div>}
  </div>;
}

/* ---------- main screen ---------- */
export default function ProductDetail({ product: p, shop, userCoords, onClose }) {
  const d = p.categoryData || {};
  const cat = shop?.category;
  const cfg = CAT[cat] || { emoji: "🛍️", name: cat || "Product", rows: [["Brand", "brand"]] };
  const images = [...new Set([p.imageUrl, ...(Array.isArray(d.images) ? d.images : [])].filter(Boolean))];
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const scroller = useRef(null);
  const sizes = splitList(d.size), colors = splitList(d.color);
  useEffect(() => { setSize(sizes[0] || ""); setColor(colors[0] || ""); /* eslint-disable-next-line */ }, [p.id]);

  const onScroll = (e) => { const w = e.currentTarget.clientWidth || 1; setSlide(Math.round(e.currentTarget.scrollLeft / w)); };
  const jump = (i) => { const el = scroller.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); };

  const mrp = Number(d.mrp) || Number(p.promotion?.originalPrice) || 0;
  const off = mrp > p.price ? Math.round(((mrp - p.price) / mrp) * 100) : 0;
  const size_ = Math.max(1, Number(p.packSize) || 10);
  const saleUnits = p.unit === "pack" ? Math.floor((p.stock || 0) / size_) + ((p.stock || 0) % size_ ? 1 : 0) : Number(p.stock) || 0;
  const stockText = p.unit === "pack" ? displayPackStock(p.stock, size_) : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight)?.stockUnit || "pcs"}`;
  const out = !(p.stock > 0), low = !out && saleUnits <= 5;
  const step = ["weight", "volume", "length"].includes(p.unit) ? 0.5 : 1;
  const { tiles, days } = highlights(cat, d, p);
  const expired = days !== null && days < 0;
  const specRows = cfg.rows.map(([l, k]) => [l, d[k]]).filter((r) => r[1]);
  if (p.expiryDate) specRows.push(["Expiry", new Date(p.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })]);
  if (p.barcode) specRows.push(["Barcode", p.barcode]);
  const km = distanceKm(userCoords?.lat, userCoords?.lng, shop?.lat, shop?.lng);

  const msg = () => `Hi, NearShop pe aapka "${p.name}" dekha.${size ? ` Size: ${size}.` : ""}${color ? ` Colour: ${color}.` : ""} Mujhe ${qty} ${p.unit === "pack" ? "strip" : (UNIT_META[p.unit]?.stockUnit || "pc")} chahiye (${formatINR(p.price)}${rateLabel(p)}). Available hai?`;
  const share = async () => {
    const text = `${p.name} — ${formatINR(p.price)} @ ${shop?.name} (NearShop)`;
    try { if (navigator.share) await navigator.share({ title: p.name, text, url: window.location.origin }); else { await navigator.clipboard.writeText(text); alert("Details copy ho gayi."); } } catch {}
  };
  const Chips = ({ list, value, onPick }) => <div className="flex gap-2 flex-wrap">{list.map((x) => <button key={x} onClick={() => onPick(x)} className={`px-3.5 py-1.5 rounded-xl border text-sm font-semibold ${value === x ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>{x}</button>)}</div>;

  return <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
    <div className="max-w-md mx-auto pb-28 relative">
      {/* gallery */}
      <div className="relative bg-gray-100">
        <div ref={scroller} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {(images.length ? images : [null]).map((u, i) => <div key={i} className="min-w-full snap-center h-80 flex items-center justify-center">
            {u ? <img src={u} alt={p.name} onClick={() => setZoom(i)} className="w-full h-full object-contain"/> : <div className="text-center text-gray-300"><div className="text-7xl">{cfg.emoji}</div><div className="text-xs mt-2">Photo abhi add nahi hui</div></div>}
          </div>)}
        </div>
        <div className="absolute top-3 left-3 right-3 flex justify-between"><button onClick={onClose} className="w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center"><ArrowLeft size={18}/></button><button onClick={share} className="w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center"><Share2 size={16}/></button></div>
        {images.length > 0 && <div className="absolute bottom-3 right-3 text-[11px] bg-black/60 text-white rounded-full px-2.5 py-1">{slide + 1}/{images.length}</div>}
        {images.length > 0 && <div className="absolute bottom-3 left-3 text-[10px] bg-black/50 text-white rounded-full px-2.5 py-1">🔍 Tap to zoom</div>}
      </div>
      {images.length > 1 && <div className="flex gap-2 px-4 py-3 overflow-x-auto">{images.map((u, i) => <button key={u + i} onClick={() => jump(i)} className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 ${i === slide ? "border-emerald-600" : "border-gray-100"}`}><img src={u} alt="" className="w-full h-full object-cover"/></button>)}</div>}

      {/* premium card */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-md">{cfg.emoji} {cfg.name}</span>
          {p.promotion?.badge && <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md">{p.promotion.badge}</span>}
          {expired && <span className="text-[11px] font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-md">Expired</span>}
          {!expired && days !== null && days <= 60 && <span className="text-[11px] font-bold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-md">Expiry {days} din me</span>}
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 leading-snug">{p.name}</h1>
        <div className="flex items-end gap-2 mt-2 flex-wrap"><span className="text-3xl font-extrabold">{formatINR(p.price)}</span><span className="text-sm text-gray-400 mb-1">{rateLabel(p)}</span>{off > 0 && <><span className="text-sm text-gray-400 line-through mb-1">{formatINR(mrp)}</span><span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md mb-1">{off}% OFF</span></>}</div>
        <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${out ? "bg-red-50 text-red-600" : low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>● {out ? "Out of stock" : low ? `Sirf ${stockText} bacha hai` : `In stock · ${stockText}`}</div>
      </div>

      {/* category highlights */}
      {tiles.length > 0 && <div className="grid grid-cols-3 gap-2 px-4 mt-4">{tiles.map(([ic, l, v]) => <div key={l} className="bg-gray-50 rounded-2xl p-3 text-center"><div className="text-xl">{ic}</div><div className="text-[10px] text-gray-400 mt-1">{l}</div><div className="text-xs font-bold text-gray-800 mt-0.5 break-words">{v}</div></div>)}</div>}

      {/* size / colour pickers */}
      {(sizes.length > 0 || colors.length > 0) && <div className="px-4 mt-5 space-y-4">
        {sizes.length > 0 && <div><div className="font-bold text-sm mb-2">Size</div><Chips list={sizes} value={size} onPick={setSize}/></div>}
        {colors.length > 0 && <div><div className="font-bold text-sm mb-2">{cat === "Paint" ? "Shade" : "Colour"}</div><Chips list={colors} value={color} onPick={setColor}/></div>}
      </div>}

      {/* quantity */}
      {!out && <div className="px-4 mt-5 flex items-center justify-between"><div className="font-bold text-sm">Quantity <span className="text-gray-400 font-normal">({p.unit === "pack" ? "strip" : (UNIT_META[p.unit]?.stockUnit || "pcs")})</span></div><div className="flex items-center gap-3"><button onClick={() => setQty((q) => Math.max(step, +(q - step).toFixed(2)))} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><Minus size={16}/></button><b className="w-10 text-center text-lg">{qty}</b><button onClick={() => setQty((q) => Math.min(saleUnits || 1, +(q + step).toFixed(2)))} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><Plus size={16}/></button></div></div>}
      {!out && <div className="px-4 mt-1 text-right text-xs text-gray-400">Total ≈ <b className="text-gray-800">{formatINR(p.price * qty)}</b></div>}

      {/* shop info */}
      <div className="mx-4 mt-5 border rounded-2xl p-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-lg">🏪</div>
        <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{shop?.name} {shop?.isClaimed && <span className="text-emerald-600">✓</span>}</div><div className="text-[11px] text-gray-400">{[km != null ? formatKm(km) : null, shop?.area, shop?.rating ? `⭐ ${shop.rating}` : null].filter(Boolean).join(" · ")}</div>{shop?.homeDeliveryAvailable && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">🏠 Home delivery available</div>}</div>
        <button onClick={onClose} className="border border-emerald-600 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl">View Shop</button>
      </div>

      {/* description + specs */}
      {(d.description || specRows.length > 0) && <div className="px-4 mt-6">
        <div className="font-extrabold text-base mb-2">Product Details</div>
        {d.description && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-3">{d.description}</p>}
        {specRows.length > 0 && <div className="divide-y divide-gray-100">{specRows.map(([l, v]) => <div key={l} className="flex py-2.5 text-sm"><span className="w-32 text-gray-400">{l}</span><span className="flex-1 font-medium text-gray-800 break-words">{v}</span></div>)}</div>}
        {cat === "Pharmacy" && <div className="mt-3 text-[11px] text-gray-400 bg-gray-50 rounded-xl p-3">⚕️ Dawai doctor ya pharmacist ki salah se hi lein. Expiry aur batch dukaan se confirm kar lein.</div>}
      </div>}
    </div>

    {/* fixed action bar */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
      <div className="max-w-md mx-auto flex gap-2 p-3">
        <a href={`https://wa.me/91${shop?.phone}?text=${encodeURIComponent(msg())}`} target="_blank" rel="noreferrer" className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm"><MessageCircle size={17}/> {out ? "WhatsApp pe poochho" : "WhatsApp pe order"}</a>
        <a href={`tel:${shop?.phone}`} className="px-4 border rounded-xl flex items-center justify-center text-gray-700"><Phone size={18}/></a>
        {shop?.lat != null && <a href={`https://maps.google.com/?q=${shop.lat},${shop.lng}`} target="_blank" rel="noreferrer" className="px-4 border rounded-xl flex items-center justify-center text-gray-700"><Navigation size={18}/></a>}
      </div>
    </div>
    {zoom !== null && <ZoomViewer images={images} start={zoom} onClose={() => setZoom(null)}/>}
  </div>;
}
