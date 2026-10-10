import React, { useState, useMemo } from "react";
import VoiceInput from "../../components/VoiceInput";
import { parseSaleVoice } from "../../lib/voiceParser";
import { formatINR, genId } from "../../data/mockData";
import { BarcodeScanModal } from "../shops/ShopForms";
import { saleToBaseUnits, saleLineTotal, displayPackStock } from "../../lib/inventory";
import { Search, ScanLine, Check, X, Trash2, Printer, ShoppingCart, ArrowLeft, Plus, Minus } from "lucide-react";

/* ---------- unit helpers: every category sells in a big and a small unit ---------- */
const UNIT_OPTS = {
  pack: [["strip", "Patta / Strip"], ["tablet", "Goli"]],
  weight: [["kg", "Kg"], ["g", "Gram"]],
  volume: [["l", "Litre"], ["ml", "ML"]],
  length: [["m", "Meter"], ["cm", "CM"]],
};
const optsFor = (p) => UNIT_OPTS[p.unit] || [["piece", "Pcs"]];
const safeUnit = (p, u) => { const o = optsFor(p); return o.some((x) => x[0] === u) ? u : o[0][0]; };
const UNIT_SHORT = { strip: "strip", tablet: "goli", kg: "kg", g: "g", l: "L", ml: "ml", m: "m", cm: "cm", piece: "pcs" };
const QUICK = { strip: [1, 2, 3, 5], tablet: [1, 2, 5, 10], kg: [0.25, 0.5, 1, 2], g: [100, 250, 500], l: [0.5, 1, 2, 5], ml: [100, 250, 500], m: [1, 2, 5, 10], cm: [10, 50, 100], piece: [1, 2, 5, 10] };
const stepOf = (u) => (["g", "ml", "cm"].includes(u) ? 50 : 1);
const rateLabel = (p) => ({ pack: "/strip", weight: "/kg", volume: "/L", length: "/m" }[p.unit] || "/pc");
const stockLabel = (p) => (p.unit === "pack" ? displayPackStock(p.stock, p.packSize || 10) : `${p.stock} ${({ weight: "kg", volume: "L", length: "m" }[p.unit] || "pcs")}`);
const fromBase = (p, base, u) => {
  const size = Math.max(1, Number(p.packSize) || 10);
  let v = base;
  if (p.unit === "pack" && u === "strip") v = base / size;
  else if (p.unit === "weight" && u === "g") v = base * 1000;
  else if (p.unit === "volume" && u === "ml") v = base * 1000;
  else if (p.unit === "length" && u === "cm") v = base * 100;
  return +v.toFixed(3);
};
const comboLabel = (p, base) => {
  if (p.unit === "pack") {
    const size = Math.max(1, Number(p.packSize) || 10);
    const strips = Math.floor(base / size + 1e-9), loose = Math.round(base - strips * size);
    return [strips ? `${strips} strip` : "", loose ? `${loose} goli` : ""].filter(Boolean).join(" + ") || "0";
  }
  const u = optsFor(p)[0][0];
  const small = optsFor(p)[1]?.[0];
  if (small && base < 1) return `${fromBase(p, base, small)} ${UNIT_SHORT[small]}`;
  return `${fromBase(p, base, u)} ${UNIT_SHORT[u]}`;
};
const r2 = (n) => +Number(n).toFixed(2);

export function SellFlow({ shop, onBack, onCompleteSale }) {
  const [cart, setCart] = useState([]); // [{productId, baseQty, subUnit}]
  const [showScan, setShowScan] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [sheet, setSheet] = useState(null); // {product, unit, qty}
  const [drafts, setDrafts] = useState({});
  const [discountOn, setDiscountOn] = useState(false);
  const [discountPct, setDiscountPct] = useState(10);

  const inStock = shop.products.filter((p) => (p.stock ?? 0) > 0);
  const findP = (id) => shop.products.find((x) => x.id === id);

  /* ---------- cart ---------- */
  const addMany = (items, replace = false) => {
    const next = replace ? [] : [...cart];
    const warns = [];
    items.forEach(({ product, qty, subUnit }) => {
      const u = safeUnit(product, subUnit || optsFor(product)[0][0]);
      const base = saleToBaseUnits(product, qty, u);
      if (!(base > 0)) return;
      const i = next.findIndex((c) => c.productId === product.id);
      const total = +((i >= 0 ? next[i].baseQty : 0) + base).toFixed(6);
      if (total > Number(product.stock) + 1e-9) { warns.push(`${product.name} ka stock kam hai.`); return; }
      if (i >= 0) next[i] = { ...next[i], baseQty: total, subUnit: u };
      else next.push({ productId: product.id, baseQty: total, subUnit: u });
    });
    setCart(next);
    if (warns.length) alert(warns.join("\n"));
  };

  const editLine = (productId, { value, unit }) => {
    const c = cart.find((x) => x.productId === productId), p = findP(productId);
    if (!c || !p) return;
    const u = unit ? safeUnit(p, unit) : c.subUnit;
    const entered = value === undefined ? fromBase(p, c.baseQty, c.subUnit) : value === "" ? 0 : Number(value);
    if (isNaN(entered) || entered < 0) return;
    const base = saleToBaseUnits(p, entered, u);
    if (base > Number(p.stock) + 1e-9) { alert(`${p.name} ka stock kam hai.`); return; }
    setCart(cart.map((x) => (x.productId === productId ? { ...x, baseQty: base, subUnit: u } : x)));
  };
  const removeLine = (id) => setCart((x) => x.filter((i) => i.productId !== id));

  /* ---------- derived bill ---------- */
  const pct = discountOn ? Math.min(100, Math.max(0, Number(discountPct) || 0)) : 0;
  const lines = useMemo(() => cart.map((c) => {
    const p = shop.products.find((x) => x.id === c.productId);
    if (!p) return null;
    const list = saleLineTotal(p, c.baseQty);
    return { c, p, list, final: r2(list * (100 - pct) / 100), combo: comboLabel(p, c.baseQty) };
  }).filter(Boolean), [cart, shop.products, pct]);
  const subtotal = r2(lines.reduce((s, l) => s + l.list, 0));
  const total = r2(lines.reduce((s, l) => s + l.final, 0));
  const discountAmt = r2(subtotal - total);

  /* ---------- voice / scan ---------- */
  const handleVoice = (full) => {
    setVoiceText(full || "");
    const matches = parseSaleVoice(full, shop.products);
    if (!matches.length) { alert("Voice me product samajh nahi aaya. Product ka naam aur quantity dobara boliye."); return; }
    addMany(matches.map((m) => ({ product: m.product, qty: m.qty, subUnit: m.subUnit })));
  };
  const handleScan = (item) => {
    setShowScan(false);
    const p = shop.products.find((x) => x.barcode === item.code);
    if (!p) { alert("Ye barcode is shop ke product se match nahi hua."); return; }
    openSheet(p);
  };

  /* ---------- quantity sheet ---------- */
  const openSheet = (p) => setSheet({ product: p, unit: optsFor(p)[0][0], qty: "1" });
  const sheetBase = sheet ? saleToBaseUnits(sheet.product, Number(sheet.qty) || 0, sheet.unit) : 0;
  const sheetPrice = sheet ? saleLineTotal(sheet.product, sheetBase) : 0;
  const sheetInCart = sheet ? (cart.find((c) => c.productId === sheet.product.id)?.baseQty || 0) : 0;
  const sheetTooMuch = sheet ? sheetBase + sheetInCart > Number(sheet.product.stock) + 1e-9 : false;
  const setSheetQty = (v) => setSheet((s) => ({ ...s, qty: String(Math.max(0, +(Number(v) || 0).toFixed(3))) }));

  /* ---------- finish ---------- */
  const finish = async () => {
    if (!lines.length) return;
    setFinishing(true);
    try {
      const items = lines.filter((l) => l.c.baseQty > 0).map((l) => ({
        productId: l.p.id, name: l.p.name, unit: l.p.unit, price: Number(l.p.price), packSize: l.p.packSize,
        baseQty: l.c.baseQty, qty: l.c.baseQty, displayQty: l.combo, lineTotal: l.final, listTotal: l.list,
      }));
      if (!items.length) return;
      const ok = await onCompleteSale(shop.id, items);
      if (ok === false) return;
      setReceipt({ id: genId("bill"), shopName: shop.name, items, subtotal, discountPct: pct, discountAmt, total, timestamp: Date.now() });
    } catch (e) {
      alert(e?.message || "Sale save nahi ho payi.");
    } finally { setFinishing(false); }
  };

  if (receipt) return <div className="min-h-screen bg-gray-50 pb-10"><div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white text-center"><Check size={32} className="mx-auto"/><div className="text-xl font-extrabold">Sale Complete</div><div className="text-white/80 text-xs">Stock update ho gaya</div></div><div className="px-5 mt-4"><div className="bg-white rounded-2xl p-5 border"><div className="font-bold">{receipt.shopName}</div><div className="text-xs text-gray-400 mb-3">{new Date(receipt.timestamp).toLocaleString()}</div>{receipt.items.map((it) => <div key={it.productId} className="flex justify-between py-2 text-sm"><span>{it.name} × {it.displayQty}</span><b>{formatINR(it.listTotal)}</b></div>)}{receipt.discountPct > 0 && <><div className="flex justify-between pt-3 border-t text-sm"><span className="text-gray-500">Subtotal</span><span>{formatINR(receipt.subtotal)}</span></div><div className="flex justify-between py-1 text-sm text-emerald-600"><span>Discount ({receipt.discountPct}%)</span><span>−{formatINR(receipt.discountAmt)}</span></div></>}<div className="flex justify-between pt-3 border-t font-extrabold text-violet-600"><span>Total</span><span>{formatINR(receipt.total)}</span></div></div><div className="flex gap-2 mt-4"><button onClick={() => window.print()} className="flex-1 bg-gray-100 py-3 rounded-xl"><Printer size={15}/> Print</button><button onClick={onBack} className="flex-1 bg-violet-600 text-white py-3 rounded-xl">Done</button></div></div></div>;

  const filtered = inStock.filter((p) => p.name.toLowerCase().includes(pickerQuery.toLowerCase()));

  return <div className="min-h-screen bg-gray-50 pb-44">
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white"><button onClick={onBack} className="mb-3"><ArrowLeft size={20}/></button><div className="text-2xl font-extrabold flex items-center gap-2"><ShoppingCart size={22}/> Smart Billing</div><div className="text-white/80 text-sm">{shop.name}</div></div>

    <div className="px-5 mt-4 space-y-2">
      <div className="bg-white rounded-2xl p-3 border"><div className="text-xs text-gray-500 mb-2">Mic on karke poora bill ek saath boliye, jaise "5 goli paracetamol aur ek patta dolo". Sab bolne ke baad 🛑 Done / Stop dabaiye.</div><div className="flex items-center justify-between"><VoiceInput continuous deferUntilDone onDone={handleVoice}/><button onClick={() => setShowScan(true)} className="flex items-center gap-1 bg-violet-50 text-violet-700 px-3 py-2 rounded-xl text-xs font-bold"><ScanLine size={15}/> Scan</button></div>{voiceText && <div className="text-[11px] bg-gray-50 rounded-xl p-2 mt-2">Heard: {voiceText}</div>}</div>

      <div className="bg-white rounded-2xl border p-3"><div className="flex items-center justify-between mb-2"><div className="font-bold text-sm">📦 Products — tap karke quantity chuniye</div><span className="text-[10px] text-gray-400">{inStock.length} in stock</span></div><div className="flex items-center border rounded-xl px-3 py-2 mb-2"><Search size={14} className="text-gray-400"/><input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Product search..." className="flex-1 outline-none px-2 text-sm"/></div><div className="max-h-64 overflow-y-auto space-y-1">{filtered.map((p) => <button key={p.id} onClick={() => openSheet(p)} className="w-full text-left bg-gray-50 active:bg-violet-50 rounded-xl p-3 flex justify-between items-center"><span className="min-w-0"><b className="text-sm truncate block">{p.name}</b><small className="block text-gray-400 mt-0.5">Stock {stockLabel(p)}</small></span><b className="text-violet-600 text-sm">{formatINR(p.price)}{rateLabel(p)}</b></button>)}{filtered.length === 0 && <div className="text-center text-xs text-gray-400 py-4">Product nahi mila.</div>}</div></div>
    </div>

    <div className="px-5 mt-4 space-y-2">
      {lines.length === 0 ? <div className="text-center text-gray-400 text-sm mt-8">Cart khali hai. Voice, scan ya list use kariye.</div> : <>
        {lines.map(({ c, p, list, combo }) => {
          const shown = drafts[p.id] ?? String(fromBase(p, c.baseQty, c.subUnit));
          return <div key={p.id} className="bg-white rounded-2xl p-3 border"><div className="flex justify-between items-start"><div className="min-w-0"><div className="font-semibold text-sm truncate">{p.name}</div><div className="text-[11px] text-gray-400">{formatINR(p.price)}{rateLabel(p)}{p.unit === "pack" ? ` · ${p.packSize || 10} goli/strip` : ""}</div></div><div className="flex items-center gap-3"><b className="text-violet-600">{formatINR(list)}</b><button onClick={() => removeLine(p.id)} className="text-red-400"><Trash2 size={16}/></button></div></div>
            <div className="flex items-center gap-2 mt-2"><input type="number" min="0" step="any" value={shown} onChange={(e) => { setDrafts((d) => ({ ...d, [p.id]: e.target.value })); editLine(p.id, { value: e.target.value }); }} onBlur={() => setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; })} className="w-20 border rounded-lg px-2 py-1.5 text-sm"/><div className="flex gap-1">{optsFor(p).map(([u, label]) => <button key={u} onClick={() => { setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; }); editLine(p.id, { unit: u }); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${c.subUnit === u ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{label}</button>)}</div></div>
            {p.unit === "pack" && <div className="text-[11px] text-gray-400 mt-1">= {combo}</div>}
          </div>;
        })}

        <div className="bg-white rounded-2xl p-3 border">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><b>{formatINR(subtotal)}</b></div>
          <div className="flex items-center justify-between mt-3"><span className="text-sm font-semibold">🏷️ Discount dena hai?</span><button onClick={() => setDiscountOn((v) => !v)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${discountOn ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{discountOn ? "Haan" : "Nahi"}</button></div>
          {discountOn && <div className="mt-3">
            <input type="range" min="1" max="100" step="1" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="w-full accent-emerald-600"/>
            <div className="flex justify-between text-[10px] text-gray-400"><span>1%</span><span>50%</span><span>100%</span></div>
            <div className="flex items-center gap-2 mt-2"><input type="number" min="1" max="100" value={discountPct} onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="w-16 border rounded-lg px-2 py-1.5 text-sm"/><span className="text-sm">%</span><div className="flex gap-1 flex-wrap">{[5, 10, 15, 20, 50].map((v) => <button key={v} onClick={() => setDiscountPct(v)} className={`px-2 py-1 rounded-lg text-xs font-bold ${Number(discountPct) === v ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{v}%</button>)}</div></div>
            <div className="flex justify-between text-sm text-emerald-600 mt-2"><span>Discount ({pct}%)</span><b>−{formatINR(discountAmt)}</b></div>
          </div>}
          <div className="flex justify-between font-extrabold text-violet-600 pt-3 mt-3 border-t"><span>Final Total</span><span>{formatINR(total)}</span></div>
        </div>
      </>}
    </div>

    {lines.length > 0 && <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4"><div className="flex justify-between mb-2"><span>Total{pct > 0 ? ` (−${pct}%)` : ""}</span><b className="text-lg text-violet-600">{formatINR(total)}</b></div><button disabled={finishing || !lines.some((l) => l.c.baseQty > 0)} onClick={() => setReviewing(true)} className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{finishing ? "Saving…" : "✓ Review Sale"}</button></div>}

    {sheet && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5">
      <div className="flex justify-between items-start mb-3"><div><div className="font-bold text-lg">{sheet.product.name}</div><div className="text-xs text-gray-400">{formatINR(sheet.product.price)}{rateLabel(sheet.product)} · Stock {stockLabel(sheet.product)}</div></div><button onClick={() => setSheet(null)}><X size={20}/></button></div>
      <div className="text-xs text-gray-500 mb-1">Kis unit me bechna hai?</div>
      <div className="flex gap-2 mb-3">{optsFor(sheet.product).map(([u, label]) => <button key={u} onClick={() => setSheet((s) => ({ ...s, unit: u, qty: "1" }))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${sheet.unit === u ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>)}</div>
      <div className="flex items-center gap-2 mb-2"><button onClick={() => setSheetQty((Number(sheet.qty) || 0) - stepOf(sheet.unit))} className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center"><Minus size={18}/></button><input type="number" min="0" step="any" value={sheet.qty} onChange={(e) => setSheet((s) => ({ ...s, qty: e.target.value }))} className="flex-1 text-center text-2xl font-extrabold border rounded-xl py-2"/><button onClick={() => setSheetQty((Number(sheet.qty) || 0) + stepOf(sheet.unit))} className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center"><Plus size={18}/></button></div>
      <div className="flex gap-1 mb-3 flex-wrap">{(QUICK[sheet.unit] || [1, 2, 5]).map((v) => <button key={v} onClick={() => setSheetQty(v)} className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold">{v} {UNIT_SHORT[sheet.unit]}</button>)}</div>
      {sheet.product.unit === "pack" && sheetBase > 0 && <div className="text-xs text-gray-400 mb-1">= {comboLabel(sheet.product, sheetBase)}</div>}
      {sheetTooMuch && <div className="text-xs text-red-500 mb-1">Itna stock nahi hai.</div>}
      <button disabled={!(sheetBase > 0) || sheetTooMuch} onClick={() => { addMany([{ product: sheet.product, qty: Number(sheet.qty), subUnit: sheet.unit }]); setSheet(null); }} className="w-full bg-emerald-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl">Cart me add karo · {formatINR(sheetPrice)}</button>
    </div></div>}

    {reviewing && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-3"><div><div className="font-bold">Bill Review</div><div className="text-[11px] text-gray-400">Galti ho to yahin se voice se poora bill dobara set kar sakte hain.</div></div><button onClick={() => setReviewing(false)}><X size={18}/></button></div><div className="flex gap-2 mb-3"><VoiceInput onDone={(text) => { setVoiceText(text); const matches = parseSaleVoice(text, shop.products); if (!matches.length) { alert("Correction samajh nahi aayi."); return; } addMany(matches.map((m) => ({ product: m.product, qty: m.qty, subUnit: m.subUnit })), true); }}/><button onClick={() => { setReviewing(false); setShowScan(true); }} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Scan</button></div>
      {lines.map(({ c, p, list, combo }) => <div key={p.id} className="flex justify-between items-center py-2 border-b text-sm"><span className="min-w-0 pr-3"><b>{p.name}</b><div className="text-xs text-gray-400">{p.unit === "pack" ? combo : `${fromBase(p, c.baseQty, c.subUnit)} ${UNIT_SHORT[c.subUnit]}`}</div></span><div className="flex items-center gap-2"><button onClick={() => removeLine(p.id)} className="text-red-400 text-xs">Remove</button><b>{formatINR(list)}</b></div></div>)}
      {pct > 0 && <><div className="flex justify-between text-sm pt-3"><span className="text-gray-500">Subtotal</span><span>{formatINR(subtotal)}</span></div><div className="flex justify-between text-sm text-emerald-600 pt-1"><span>Discount ({pct}%)</span><span>−{formatINR(discountAmt)}</span></div></>}
      <div className="flex justify-between font-extrabold text-violet-600 py-3"><span>Total</span><span>{formatINR(total)}</span></div><button disabled={finishing || lines.length === 0} onClick={async () => { setReviewing(false); await finish(); }} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">{finishing ? "Saving…" : "Confirm Sale & Update Stock"}</button></div></div>}

    {showScan && <BarcodeScanModal subtitle="Sale wala product scan kariye" onClose={() => setShowScan(false)} onDetected={handleScan}/>}
  </div>;
}
