import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import VoiceInput from "../../components/VoiceInput";
import { parseProductVoice, parseExpiry } from "../../lib/voiceParser";
import ProductCategoryFields, { emptyCategoryData } from "../shops/ProductCategoryFields";
import ProductExtraFields from "../shops/ProductExtraFields";
import { KhataSummaryCard } from "../khata/KhataScreen";
import { BidAlertCard } from "./OwnerMarketplacePanel";
import BroadcastPanel from "../broadcast/BroadcastPanel";
import ProductAddForm from "./ProductAddForm";
import PendingDetailsCard from "./PendingDetailsCard";
import { getInventoryMeta, setInventoryMeta, displayPackStock } from "../../lib/inventory";
import { formatINR, genId } from "../../data/mockData";
import PromotionPanel from "../promotions/PromotionPanel";
import CompetitorPricePanel from "../insights/CompetitorPricePanel";
import CsvImportPanel from "../shops/CsvImportPanel";
import { BarcodeScanModal } from "../shops/ShopForms";
import OwnerMarketplacePanel from "./OwnerMarketplacePanel";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function MyShopDashboard({ shops, onBack, onUpdateProduct, onDeleteProduct, onRestoreProduct, onSetProductVisibility, onAddProduct, onImportProducts, onOpenSell, onOpenReport, onAddAnotherShop, onDeleteShop, onPromote, onUpdateShopSettings, needRequests=[], bids=[], broadcasts=[], onBroadcast, onNeedRespond, onBidOffer, onOpenAd, onOpenKhata }) {
  const [addShopId, setAddShopId] = useState(shops[0]?.id);
  const [addSettings, setAddSettings] = useState({ unit: "piece", wantExpiry: false });
  const makeDraft = (shop) => {
    const category = shop?.category || "Pharmacy";
    const data = emptyCategoryData(category);
    const unit = category === "Pharmacy" && ["Tablet","Capsule"].includes(data.dosageForm) ? "pack" : "piece";
    return { name: "", price: "", stock: "", packSize: data.unitsPerPack || "10", expiryDate: "", code: "", unit, category, categoryData: data };
  };
  const blankDraft = (unit) => ({ name: "", price: "", stock: "", packSize: "10", expiryDate: "", code: "", unit: unit || "piece", category: shops[0]?.category || "Pharmacy", categoryData: emptyCategoryData(shops[0]?.category || "Pharmacy") });
  const [draft, setDraft] = useState(() => blankDraft(addSettings.unit));
  const [step, setStep] = useState("name");
  const [pending, setPending] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showScan, setShowScan] = useState(false);
  const [editingScan, setEditingScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const editFileRef = useRef(null);
  const activeAddShop = shops.find(s => s.id === addShopId) || shops[0];
  const addCategory = activeAddShop?.category || "Pharmacy";
  useEffect(() => {
    if (!activeAddShop) return;
    setDraft(d => ({ ...d, category: addCategory, categoryData: d.category === addCategory ? d.categoryData : emptyCategoryData(addCategory), unit: d.category === addCategory ? d.unit : (addCategory === "Pharmacy" ? "pack" : "piece"), packSize: d.category === addCategory ? d.packSize : (emptyCategoryData(addCategory).unitsPerPack || "10") }));
    setAddSettings(x => ({ ...x, unit: addCategory === "Pharmacy" ? "pack" : "piece", wantExpiry: addCategory === "Pharmacy" }));
  }, [addShopId, addCategory]);

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
      category: addCategory,
      categoryData: draft.categoryData || {},
      importedSource: "manual",
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
        const product = await onAddProduct(item.shopId, item.name, Number(item.price), item.unit || "piece", Number(item.stock), imageUrl, item.expiryDate || null, item.code || null, item.packSize, item.categoryData || {}, item.importedSource || "manual");
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
      const saved = await onUpdateProduct(editing.shopId, editing.id, { ...editing, price: Number(editing.price), stock: stockToSave, displayStock: enteredStock, imageUrl, expiryDate: editing.expiryDate || null, barcode: editing.barcode || null, unit: editing.unit || "piece", packSize, categoryData: { ...(editing.categoryData || {}), pending: false } });
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
      <BidAlertCard shops={shops} bids={bids} onGo={() => document.getElementById("owner-market")?.scrollIntoView({ behavior: "smooth" })} />
      <PendingDetailsCard shops={shops} onEdit={(p, s) => setEditing({...p,shopId:s.id,category:s.category,categoryData:p.categoryData||{},packSize:p.packSize||getInventoryMeta(p.id).packSize||10,stock:p.unit==='pack'?((Number(p.stock)||0)/Number(p.packSize||getInventoryMeta(p.id).packSize||10)):p.stock})} />
      <KhataSummaryCard shops={shops} onOpen={onOpenKhata} />
      <BroadcastPanel shops={shops} broadcasts={broadcasts} uploadImage={uploadImage} onCreate={onBroadcast} />
      {shops.map((s) => <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2"><div><div className="font-bold text-sm">{s.name}</div><div className="text-xs text-gray-400">{s.area} · {s.products.filter(p=>!p.archived_at).length} products</div></div><div className="flex gap-2"><button onClick={()=>onOpenReport(s.id)} className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-2 rounded-lg"><BarChart3 size={13}/> Report</button><button onClick={()=>onOpenSell(s.id)} className="bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg"><ShoppingCart size={13}/> Sale</button></div></div>
        <div className="flex items-center justify-between mt-3 mb-1"><span className="text-[11px] text-gray-500">{showArchived ? "Archived products" : "Active products"}</span><button onClick={()=>setShowArchived(v=>!v)} className="text-[11px] font-bold text-violet-600">{showArchived ? "Active products dekhein" : "Deleted / Archived products"}</button></div><div className="divide-y divide-gray-50">{s.products.filter(p=>showArchived ? !!p.archived_at : !p.archived_at).map((p)=><div key={p.id} className="py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0">{p.imageUrl?<img src={p.imageUrl} className="w-9 h-9 rounded-lg object-cover"/>:<div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14}/></div>}<div className="min-w-0"><div className="text-sm font-semibold truncate">{p.name}</div><div className={`text-[11px] ${p.stock<=3?'text-red-500':'text-gray-500'}`}>Stock: {stockLabel(p)}</div></div></div><div className="flex items-center gap-2"><span className="font-bold text-sm">{formatINR(Number(p.price))}{unitLabel(p.unit)}</span>{!showArchived && <button onClick={()=>onSetProductVisibility?.(s.id,p.id,(p.visibilityMode||"public")==="public"?"search_only":"public")} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{(p.visibilityMode||"public")==="public"?"Hide from suggestions":"Search only"}</button>}<button onClick={()=>{setEditing({...p,shopId:s.id,category:s.category,categoryData:p.categoryData||{},packSize:p.packSize||getInventoryMeta(p.id).packSize||10,stock:p.unit==='pack'?((Number(p.stock)||0)/Number(p.packSize||getInventoryMeta(p.id).packSize||10)):p.stock});setImagePreview(p.imageUrl||null);setImageFile(null);if(editFileRef.current)editFileRef.current.value="";}} className="text-violet-600 text-xs font-bold px-2 py-1 bg-violet-50 rounded-lg">Edit</button>{showArchived ? <button onClick={()=>onRestoreProduct?.(s.id,p.id)} className="text-emerald-700 text-xs font-bold px-2 py-1 bg-emerald-50 rounded-lg">Restore</button> : <button onClick={()=>{if(confirm(`"${p.name}" ko archive karein? Purani billing aur stock history safe rahegi.`)) onDeleteProduct?.(s.id,p.id,p.name);}} className="text-red-600 text-xs font-bold px-2 py-1 bg-red-50 rounded-lg" title="Archive product"><Trash2 size={13}/></button>}</div></div>)}</div>
        <div className="mt-3 bg-emerald-50 rounded-xl p-3"><div className="flex items-center justify-between"><div><div className="font-bold text-xs text-emerald-800">🏠 Home Delivery</div><div className="text-[10px] text-emerald-600">Aap khud delivery provide karte hain to badge ON karein.</div></div><button onClick={()=>onUpdateShopSettings?.(s.id,{home_delivery_available:!s.homeDeliveryAvailable})} className={`w-12 h-7 rounded-full ${s.homeDeliveryAvailable?'bg-emerald-500':'bg-gray-300'} relative`}><span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${s.homeDeliveryAvailable?'left-6':'left-1'}`}/></button></div>{s.homeDeliveryAvailable&&<div className="grid grid-cols-2 gap-2 mt-2"><input value={s.deliveryRadiusKm||''} onChange={e=>onUpdateShopSettings?.(s.id,{delivery_radius_km:e.target.value})} placeholder="Radius km" className="border rounded-lg px-2 py-2 text-xs bg-white"/><input value={s.deliveryAreas||''} onChange={e=>onUpdateShopSettings?.(s.id,{delivery_areas:e.target.value})} placeholder="Areas e.g. Vesu, Bhatar" className="border rounded-lg px-2 py-2 text-xs bg-white"/></div>}</div>
        <div className="mt-3 border rounded-xl p-3 bg-slate-50">
          <div className="font-bold text-xs text-gray-800 mb-1">🔒 Product visibility / Privacy</div>
          <div className="text-[10px] text-gray-500 mb-2">Faisla aapka hai. Search Only me product exact naam se search karne par dikhega; Disable All me sirf shop profile dikhegi. Note: current app data model me ye display controls hain, complete backend confidentiality nahi.</div>
          <div className="grid grid-cols-3 gap-1">
            {[["public","Public"],["search_only","Search Only"],["disabled","Disable All"]].map(([v,label])=><button key={v} onClick={()=>{if(v==="disabled" && !confirm("Disable All karne par customer ko aapki shop profile dikhegi, lekin koi product search/recommendation me nahi dikhega. Product-based discovery kam hogi. Kya aap sure hain?")) return; onUpdateShopSettings?.(s.id,{product_visibility_mode:v});}} className={`rounded-lg px-2 py-2 text-[10px] font-bold ${((s.productVisibilityMode||"public")===v)?"bg-violet-600 text-white":"bg-white border text-gray-600"}`}>{label}</button>)}
          </div>
          <button onClick={()=>onUpdateShopSettings?.(s.id,{hide_product_prices:!s.hideProductPrices})} className="mt-2 flex items-center justify-between w-full text-xs"><span>Price hide karein (Contact for price)</span><span className={`px-3 py-1 rounded-full font-bold ${s.hideProductPrices?"bg-emerald-600 text-white":"bg-gray-200 text-gray-600"}`}>{s.hideProductPrices?"ON":"OFF"}</span></button>
        </div>
        <button onClick={()=>{if(confirm(`"${s.name}" delete karni hai?`)) onDeleteShop(s.id)}} className="w-full mt-2 bg-red-50 text-red-500 text-xs font-semibold py-2 rounded-lg"><Trash2 size={13}/> Delete Shop</button>
      </div>)}

      <div id="owner-market"><OwnerMarketplacePanel shops={shops} needRequests={needRequests} bids={bids} onPromote={onPromote} onNeedRespond={onNeedRespond} onBidOffer={onBidOffer} onOpenAd={onOpenAd} /></div>
      <CompetitorPricePanel shops={shops} />
      <CsvImportPanel shops={shops} onImportProducts={onImportProducts} />

      <ProductAddForm shops={shops} onAddProduct={onAddProduct} />
    </div>

    {showScan && <BarcodeScanModal subtitle="Product barcode scan kariye" onClose={()=>setShowScan(false)} onDetected={handleScan}/>}
    {editingScan && <BarcodeScanModal subtitle="Correction ke liye barcode scan kariye" onClose={()=>setEditingScan(false)} onDetected={(item)=>{setEditingScan(false);setEditing(e=>({...e,barcode:item.code||e.barcode||"",name:item.name||e.name,price:item.suggestedPrice||e.price}));}}/>}
    {editing && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-3"><div><div className="font-bold">Edit Product</div><div className="text-[10px] text-gray-400">{editing.category} · existing price history preserved</div></div><button onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="flex gap-2 mb-3"><VoiceInput onText={(text)=>{const parsed=parseProductVoice(text);if(parsed)setEditing(e=>({...e,name:parsed.name||e.name,price:parsed.price??e.price,stock:parsed.stock??e.stock}));}}/><button onClick={()=>setEditingScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Scan</button></div><input value={editing.name||''} onChange={e=>setEditing({...editing,name:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Product name"/>{editing.categoryData?.pending && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-3">📝 Ye product jaldi me add hua tha. Stock, expiry, photos aur baaki detail bharke Save kijiye.</div>}<ProductCategoryFields category={editing.category} value={editing.categoryData||{}} onChange={categoryData=>setEditing({...editing,categoryData})}/><ProductExtraFields category={editing.category} value={editing.categoryData||{}} upload={(f)=>uploadImage(editing.shopId,f)} onChange={categoryData=>setEditing({...editing,categoryData})}/><div className="grid grid-cols-2 gap-2 my-2"><input value={editing.price??''} onChange={e=>setEditing({...editing,price:e.target.value.replace(/[^0-9.]/g,'')})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Selling Price"/><input value={editing.stock??''} onChange={e=>setEditing({...editing,stock:e.target.value.replace(/[^0-9.]/g,'')})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Stock"/></div><select value={editing.unit||'piece'} onChange={e=>setEditing({...editing,unit:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"><option value="piece">Piece / Bottle</option><option value="pack">Strip / Pack</option><option value="weight">Weight</option><option value="volume">Volume</option><option value="length">Length</option></select>{editing.unit==='pack'&&<input value={editing.packSize||10} onChange={e=>setEditing({...editing,packSize:e.target.value.replace(/\D/g,'')})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Units per strip/pack"/>}<input type="date" value={editing.expiryDate||''} onChange={e=>setEditing({...editing,expiryDate:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/><input value={editing.barcode||''} onChange={e=>setEditing({...editing,barcode:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Barcode"/><div className="border border-dashed rounded-xl p-3 mb-3"><div className="flex items-center gap-3"><div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">{imagePreview?<img src={imagePreview} className="w-full h-full object-cover"/>:<Camera size={20}/>}</div><div className="flex-1"><div className="text-xs font-semibold">Product photo</div><div className="text-[10px] text-gray-400">New photo select karoge tabhi old photo replace hogi.</div></div><input ref={editFileRef} type="file" accept="image/*" capture="environment" onChange={pickImage} className="hidden"/><button type="button" onClick={()=>editFileRef.current?.click()} className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-2 rounded-lg">Choose</button></div></div><div className="flex gap-2"><button onClick={()=>{setEditing(null);setImageFile(null);setImagePreview(null)}} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button><button disabled={busy} onClick={saveEdit} className="flex-1 bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold">{busy?'Saving…':'Save'}</button></div></div></div>}
  </div>;
}

/* ============================================================================
   FILE: screens/ShopReportScreen.jsx
   Shop owner's own "Intelligence" — today/week/month totals, per-product
   sell-through %, and a slow-mover alert that one-taps into a Flash Deal
   (same paid feature already in DealsTab — this just makes it easy to find).
============================================================================ */
