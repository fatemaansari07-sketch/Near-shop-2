import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import VoiceInput from "../../components/VoiceInput";
import { parseProductVoice, parseExpiry } from "../../lib/voiceParser";
import ProductCategoryFields, { emptyCategoryData } from "../shops/ProductCategoryFields";
import ProductExtraFields from "../shops/ProductExtraFields";
import { KhataSummaryCard } from "../khata/KhataScreen";
import { BidAlertCard } from "./OwnerMarketplacePanel";
import BroadcastPanel from "../broadcast/BroadcastPanel";
import ShopSwitcher from "./ShopSwitcher";
import ShopMenuSheet from "./ShopMenuSheet";
import PendingDetailsScreen from "./PendingDetailsScreen";
import ShopProfileEditor from "./ShopProfileEditor";
import StaffManager from "../owner/StaffManager";
import DemandAlertPanel from "../insights/DemandAlertPanel";
import { usePlatformFeatures } from "../../lib/platform";
import ProductAddForm from "./ProductAddForm";
import PendingDetailsCard from "./PendingDetailsCard";
import { getInventoryMeta, setInventoryMeta, displayPackStock } from "../../lib/inventory";
import { formatINR, genId } from "../../data/mockData";
import PromotionPanel from "../promotions/PromotionPanel";
import CompetitorPricePanel from "../insights/CompetitorPricePanel";
import WholesaleMarketPanel from "../insights/WholesaleMarketPanel";
import DealInterestInbox from "./DealInterestInbox";
import CsvImportPanel from "../shops/CsvImportPanel";
import { BarcodeScanModal } from "../shops/ShopForms";
import OwnerMarketplacePanel from "./OwnerMarketplacePanel";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

const MENU = [
  { key: "add", group: "quick", icon: "➕", label: "Product Add Karo", perm: "inventory" },
  { key: "import", group: "quick", icon: "🖥️", label: "PC / Existing Software Import", perm: "inventory" },
  { key: "manage", group: "manage", icon: "📦", label: "Manage Products", perm: "inventory" },
  { key: "delivery", group: "manage", icon: "🏠", label: "Home Delivery", owner: true },
  { key: "privacy", group: "manage", icon: "🔒", label: "Product Visibility / Privacy", owner: true },
  { key: "promote", group: "manage", icon: "⚡", label: "Promote — Customer Attention", owner: true, feature: "promo" },
  { key: "pro", group: "manage", icon: "🏅", label: "NearShop Pro Shop", owner: true, note: "Promote panel me" },
  { key: "demand", group: "manage", icon: "🎯", label: "Demand Alert", owner: true, feature: "demand_alert" },
  { key: "competitor", group: "manage", icon: "📊", label: "Competitor Price Insight", owner: true, feature: "competitor_price_insight" },
  { key: "khata", group: "manage", icon: "📒", label: "Udhar Khata Settings", owner: true, note: "Khata screen" },
  { key: "settings", group: "manage", icon: "⚙️", label: "Shop Settings", owner: true },
];
const PROMO_KEYS = ["shop_boost","product_boost","discount","flash","nearby_first","top_shop","announcement","new_stock","coupon","reward_wheel"];

export function MyShopDashboard({ shops, onBack, onUpdateProduct, onDeleteProduct, onRestoreProduct, onSetProductVisibility, onAddProduct, onImportProducts, onOpenSell, onOpenReport, onAddAnotherShop, onDeleteShop, onPromote, onUpdateShopSettings, needRequests=[], bids=[], broadcasts=[], onBroadcast, onNeedRespond, onBidOffer, onOpenAd, onOpenKhata, onOpenOwnerDashboard, planRank = 0 }) {
  const { isOn } = usePlatformFeatures();
  const [activeId, setActiveId] = useState(() => { try { return localStorage.getItem("ns_active_shop") || shops[0]?.id; } catch { return shops[0]?.id; } });
  const shop = shops.find((x) => x.id === activeId) || shops[0];
  const s = shop;                       // product list / settings blocks below are scoped to the ACTIVE shop only
  const isOwner = !shop?.staffPerms;    // staff rows carry staffPerms; real security is RLS/RPC on the server
  const can = (perm) => isOwner || shop.staffPerms.includes(perm);
  const [panel, setPanel] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [editingScan, setEditingScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const editFileRef = useRef(null);
  if (!shop) return <div className="p-6 text-sm text-gray-500">Koi shop nahi mili.</div>;

  const switchShop = (id) => {
    if (id === shop.id) return;
    if (editing && !window.confirm("Product edit adhura hai. Shop badalne par changes chale jayenge. Badalna hai?")) return;
    setEditing(null); setImageFile(null); setImagePreview(null); setShowArchived(false); setPanel(null);
    setActiveId(id);
    try { localStorage.setItem("ns_active_shop", id); } catch {}
  };

  const unitLabel = (u) => (u === "weight" ? "/kg" : u === "volume" ? "/litre" : u === "length" ? "/metre" : u === "pack" ? "/strip" : "/piece");
  const stockLabel = (p) => p.unit === "pack" ? displayPackStock(p.stock, p.packSize || 10) : p.unit === "weight" ? `${p.stock} kg` : p.unit === "volume" ? `${p.stock} L` : p.unit === "length" ? `${p.stock} m` : `${p.stock} pcs`;

  const uploadImage = async (shopId, file) => {
    if (!file) return null;
    const path = `${shopId}/${genId("img")}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return null;
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };
  const startEdit = (p) => { setEditing({ ...p, shopId: shop.id, category: shop.category, categoryData: p.categoryData || {}, packSize: p.packSize || getInventoryMeta(p.id).packSize || 10, stock: p.unit === 'pack' ? ((Number(p.stock) || 0) / Number(p.packSize || getInventoryMeta(p.id).packSize || 10)) : p.stock }); setImagePreview(p.imageUrl || null); setImageFile(null); if (editFileRef.current) editFileRef.current.value = ""; };
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
      await onUpdateProduct(editing.shopId, editing.id, { ...editing, price: Number(editing.price), stock: stockToSave, displayStock: enteredStock, imageUrl, expiryDate: editing.expiryDate || null, barcode: editing.barcode || null, unit: editing.unit || "piece", packSize, categoryData: { ...(editing.categoryData || {}), pending: false } });
      if (editing.unit === "pack") setInventoryMeta(editing.id, { packSize, stockMode: "base_units" });
      if (editFileRef.current) editFileRef.current.value = "";
      setEditing(null); setImageFile(null); setImagePreview(null);
    } catch (e) { alert(e?.message || "Save nahi hua."); } finally { setBusy(false); }
  };

  const promoOn = PROMO_KEYS.some((k) => isOn(k));
  const menuItems = MENU.filter((i) => (!i.owner || isOwner) && (!i.perm || can(i.perm)) && (i.feature === "promo" ? promoOn : !i.feature || isOn(i.feature)));
  const pickMenu = (key) => {
    setMenuOpen(false);
    if (key === "khata") return onOpenKhata?.();
    if (key === "manage") { setPanel(null); setTimeout(() => document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth" }), 50); return; }
    setPanel(key);
  };
  const subTitle = { add: "Product Add Karo", import: "PC / Existing Software Import", delivery: "Home Delivery", privacy: "Product Visibility / Privacy", promote: "Promote — Customer Attention", pro: "NearShop Pro Shop", demand: "Demand Alert", competitor: "Competitor Price Insight", settings: "Shop Settings", market: "Customer Requests & Offers" };

  const modals = <>
    {editingScan && <BarcodeScanModal subtitle="Correction ke liye barcode scan kariye" onClose={()=>setEditingScan(false)} onDetected={(item)=>{setEditingScan(false);setEditing(e=>({...e,barcode:item.code||e.barcode||"",name:item.name||e.name,price:item.suggestedPrice||e.price}));}}/>}
        {editingScan && <BarcodeScanModal subtitle="Correction ke liye barcode scan kariye" onClose={()=>setEditingScan(false)} onDetected={(item)=>{setEditingScan(false);setEditing(e=>({...e,barcode:item.code||e.barcode||"",name:item.name||e.name,price:item.suggestedPrice||e.price}));}}/>}
    {editing && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-3"><div><div className="font-bold">Edit Product</div><div className="text-[10px] text-gray-400">{editing.category} · existing price history preserved</div></div><button onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="flex gap-2 mb-3"><VoiceInput onText={(text)=>{const parsed=parseProductVoice(text);if(parsed)setEditing(e=>({...e,name:parsed.name||e.name,price:parsed.price??e.price,stock:parsed.stock??e.stock}));}}/><button onClick={()=>setEditingScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl"><ScanLine size={14}/> Scan</button></div><input value={editing.name||''} onChange={e=>setEditing({...editing,name:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Product name"/>{editing.categoryData?.pending && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-3">📝 Ye product jaldi me add hua tha. Stock, expiry, photos aur baaki detail bharke Save kijiye.</div>}<ProductCategoryFields category={editing.category} value={editing.categoryData||{}} onChange={categoryData=>setEditing({...editing,categoryData})}/><ProductExtraFields category={editing.category} value={editing.categoryData||{}} upload={(f)=>uploadImage(editing.shopId,f)} onChange={categoryData=>setEditing({...editing,categoryData})}/>{["wholesale","both"].includes(shops.find(s=>s.id===editing.shopId)?.shopType) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-2"><div className="text-xs font-bold text-amber-800 mb-2">Wholesale rate (optional)</div><div className="grid grid-cols-2 gap-2"><input value={editing.categoryData?.wholesaleMinQty||""} onChange={e=>setEditing({...editing,categoryData:{...editing.categoryData,wholesaleMinQty:e.target.value.replace(/[^0-9.]/g,"")}})} className="border rounded-lg px-2 py-2 text-xs" placeholder="Minimum bulk qty"/><input value={editing.categoryData?.wholesalePrice||""} onChange={e=>setEditing({...editing,categoryData:{...editing.categoryData,wholesalePrice:e.target.value.replace(/[^0-9.]/g,"")}})} className="border rounded-lg px-2 py-2 text-xs" placeholder="Wholesale price ₹"/></div></div>}<div className="grid grid-cols-2 gap-2 my-2"><input value={editing.price??''} onChange={e=>setEditing({...editing,price:e.target.value.replace(/[^0-9.]/g,'')})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Selling Price"/><input value={editing.stock??''} onChange={e=>setEditing({...editing,stock:e.target.value.replace(/[^0-9.]/g,'')})} className="border rounded-xl px-3 py-2 text-sm" placeholder="Stock"/></div><select value={editing.unit||'piece'} onChange={e=>setEditing({...editing,unit:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"><option value="piece">Piece / Bottle</option><option value="pack">Strip / Pack</option><option value="weight">Weight</option><option value="volume">Volume</option><option value="length">Length</option></select>{editing.unit==='pack'&&<input value={editing.packSize||10} onChange={e=>setEditing({...editing,packSize:e.target.value.replace(/\D/g,'')})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Units per strip/pack"/>}<input type="date" value={editing.expiryDate||''} onChange={e=>setEditing({...editing,expiryDate:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/><input value={editing.barcode||''} onChange={e=>setEditing({...editing,barcode:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm mb-2" placeholder="Barcode"/><div className="border border-dashed rounded-xl p-3 mb-3"><div className="flex items-center gap-3"><div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">{imagePreview?<img src={imagePreview} className="w-full h-full object-cover"/>:<Camera size={20}/>}</div><div className="flex-1"><div className="text-xs font-semibold">Product photo</div><div className="text-[10px] text-gray-400">New photo select karoge tabhi old photo replace hogi.</div></div><input ref={editFileRef} type="file" accept="image/*" capture="environment" onChange={pickImage} className="hidden"/><button type="button" onClick={()=>editFileRef.current?.click()} className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-2 rounded-lg">Choose</button></div></div><div className="flex gap-2"><button onClick={()=>{setEditing(null);setImageFile(null);setImagePreview(null)}} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button><button disabled={busy} onClick={saveEdit} className="flex-1 bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold">{busy?'Saving…':'Save'}</button></div></div></div>}
  </>;

  if (panel === "pending") return <><PendingDetailsScreen shop={shop} onBack={() => setPanel(null)} onEdit={(p) => startEdit(p)} />{modals}</>;

  if (panel) return <div className="pb-24 min-h-screen bg-gray-50">
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-5 rounded-b-3xl text-white"><button onClick={() => setPanel(null)} className="mb-2 p-1"><ArrowLeft size={20}/></button><div className="text-xl font-extrabold">{subTitle[panel]}</div><div className="text-white/80 text-xs">{shop.name}</div></div>
    <div className="px-5 mt-4 space-y-4">
      {panel === "add" && <ProductAddForm shops={[shop]} onAddProduct={onAddProduct} />}
      {panel === "import" && <CsvImportPanel shops={[shop]} onImportProducts={onImportProducts} />}
      {panel === "delivery" && <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="mt-3 bg-emerald-50 rounded-xl p-3"><div className="flex items-center justify-between"><div><div className="font-bold text-xs text-emerald-800">🏠 Home Delivery</div><div className="text-[10px] text-emerald-600">Aap khud delivery provide karte hain to badge ON karein.</div></div><button onClick={()=>onUpdateShopSettings?.(s.id,{home_delivery_available:!s.homeDeliveryAvailable})} className={`w-12 h-7 rounded-full ${s.homeDeliveryAvailable?'bg-emerald-500':'bg-gray-300'} relative`}><span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${s.homeDeliveryAvailable?'left-6':'left-1'}`}/></button></div>{s.homeDeliveryAvailable&&<div className="grid grid-cols-2 gap-2 mt-2"><input value={s.deliveryRadiusKm||''} onChange={e=>onUpdateShopSettings?.(s.id,{delivery_radius_km:e.target.value})} placeholder="Radius km" className="border rounded-lg px-2 py-2 text-xs bg-white"/><input value={s.deliveryAreas||''} onChange={e=>onUpdateShopSettings?.(s.id,{delivery_areas:e.target.value})} placeholder="Areas e.g. Vesu, Bhatar" className="border rounded-lg px-2 py-2 text-xs bg-white"/></div>}</div></div>}
      {panel === "privacy" && <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="mt-3 border rounded-xl p-3 bg-slate-50">
          <div className="font-bold text-xs text-gray-800 mb-1">🔒 Product visibility / Privacy</div>
          <div className="text-[10px] text-gray-500 mb-2">Faisla aapka hai. Search Only me product exact naam se search karne par dikhega; Disable All me sirf shop profile dikhegi. Note: current app data model me ye display controls hain, complete backend confidentiality nahi.</div>
          <div className="grid grid-cols-3 gap-1">
            {[["public","Public"],["search_only","Search Only"],["disabled","Disable All"]].map(([v,label])=><button key={v} onClick={()=>{if(v==="disabled" && !confirm("Disable All karne par customer ko aapki shop profile dikhegi, lekin koi product search/recommendation me nahi dikhega. Product-based discovery kam hogi. Kya aap sure hain?")) return; onUpdateShopSettings?.(s.id,{product_visibility_mode:v});}} className={`rounded-lg px-2 py-2 text-[10px] font-bold ${((s.productVisibilityMode||"public")===v)?"bg-violet-600 text-white":"bg-white border text-gray-600"}`}>{label}</button>)}
          </div>
          <button onClick={()=>onUpdateShopSettings?.(s.id,{hide_product_prices:!s.hideProductPrices})} className="mt-2 flex items-center justify-between w-full text-xs"><span>Price hide karein (Contact for price)</span><span className={`px-3 py-1 rounded-full font-bold ${s.hideProductPrices?"bg-emerald-600 text-white":"bg-gray-200 text-gray-600"}`}>{s.hideProductPrices?"ON":"OFF"}</span></button>
        </div></div>}
      {(panel === "promote" || panel === "pro" || panel === "market") && <OwnerMarketplacePanel shops={[shop]} needRequests={needRequests} bids={bids} onPromote={onPromote} onNeedRespond={onNeedRespond} onBidOffer={onBidOffer} onOpenAd={onOpenAd} />}
      {panel === "demand" && <DemandAlertPanel />}
      {panel === "competitor" && <CompetitorPricePanel shops={[shop]} />}
      {panel === "settings" && <>
        <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="mt-2 rounded-xl bg-violet-50 p-3">
          <div className="text-[11px] font-bold text-violet-800 mb-2">Shop business type</div>
          <div className="grid grid-cols-3 gap-1">{[["retail","Retail"],["wholesale","Wholesale"],["both","Both"]].map(([v,label])=><button key={v} onClick={()=>onUpdateShopSettings?.(s.id,{shop_type:v})} className={`rounded-lg px-2 py-2 text-[10px] font-bold ${(s.shopType||"retail")===v?"bg-violet-600 text-white":"bg-white text-gray-600 border"}`}>{label}</button>)}</div>
        </div></div>
        <ShopProfileEditor key={shop.id} shop={shop} uploadImage={uploadImage} onSave={async (id, ch) => { await onUpdateShopSettings?.(id, ch); }} />
        {isOwner && <StaffManager shop={shop} rank={planRank} />}
        {isOwner && <button onClick={()=>{if(confirm(`"${s.name}" delete karni hai?`)) { onDeleteShop(s.id); setPanel(null); }}} className="w-full bg-red-50 text-red-500 text-xs font-semibold py-3 rounded-lg"><Trash2 size={13}/> Delete Shop</button>}
      </>}
    </div>
    {modals}
  </div>;

  const activeCount = shop.products.filter((p) => !p.archived_at).length;
  return <div className="pb-24 min-h-screen bg-gray-50">
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-5 pb-4 rounded-b-3xl text-white">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="p-1"><ArrowLeft size={20}/></button>
        <div className="flex items-center gap-2">
          {((shops.length > 1 || planRank > 0) && isOwner || shop.staffRole === "manager") && <button onClick={onOpenOwnerDashboard} className="bg-white/20 text-[11px] font-semibold px-3 py-2 rounded-lg">📈 All Shops</button>}
          {isOwner && <button onClick={onAddAnotherShop} className="bg-white/20 text-[11px] font-semibold px-3 py-2 rounded-lg"><Plus size={12}/> Naya Shop</button>}
          <button onClick={() => setMenuOpen(true)} className="bg-white/20 w-10 h-10 rounded-lg text-xl font-bold" aria-label="Shop menu">⋮</button>
        </div>
      </div>
      <ShopSwitcher shops={shops} activeId={shop.id} onSelect={switchShop} />
      <div className="flex items-center gap-3 mt-3">
        {shop.logo_url ? <img src={shop.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/40"/> : <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center"><Store size={24}/></div>}
        <div className="min-w-0"><div className="text-2xl font-extrabold leading-tight truncate">{shop.name}</div><div className="text-white/80 text-xs truncate"><MapPin size={11} className="inline"/> {shop.address || shop.area}</div>
          <div className="flex gap-1.5 mt-1 flex-wrap"><span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{shop.category}</span><span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full capitalize">{shop.shopType}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${shop.isBlocked ? "bg-red-500" : "bg-emerald-400/90"}`}>{shop.isBlocked ? "Blocked" : "Live"}</span>{!isOwner && <span className="text-[10px] bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold">Staff</span>}</div></div>
      </div>
    </div>

    <div className="px-5 mt-4 space-y-3">
      <div className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="font-bold text-sm truncate">{shop.name}</div><div className="text-xs text-gray-400 truncate">{shop.area} · {activeCount} products</div></div>
        <div className="flex gap-2 flex-shrink-0">{can("reports") && <button onClick={()=>onOpenReport(shop.id)} className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-2.5 rounded-lg min-h-[44px]"><BarChart3 size={13}/> Report</button>}{can("sell") && <button onClick={()=>onOpenSell(shop.id)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg min-h-[44px]"><ShoppingCart size={13}/> Sell</button>}</div>
      </div>
      {isOwner && <BidAlertCard shops={[shop]} bids={bids} onGo={() => setPanel("market")} />}
      {can("inventory") && <PendingDetailsCard shops={[shop]} onOpenAll={() => setPanel("pending")} onEdit={(p) => startEdit(p)} />}
      {can("khata") && <KhataSummaryCard shops={[shop]} onOpen={onOpenKhata} />}
      {isOwner && isOn("broadcast") && <BroadcastPanel shops={[shop]} broadcasts={broadcasts.filter((b) => b.shop_id === shop.id || b.shopId === shop.id)} uploadImage={uploadImage} onCreate={onBroadcast} />}
      {isOwner && <DealInterestInbox shops={[shop]} />}
      {isOwner && ["wholesale","both"].includes(shop.shopType) && <WholesaleMarketPanel key={`wholesale-intel-${shop.id}`} shop={shop} onUpdateShopSettings={onUpdateShopSettings} />}
      {can("inventory") && <div id="product-list" className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mt-3 mb-1"><span className="text-[11px] text-gray-500">{showArchived ? "Archived products" : "Active products"}</span><button onClick={()=>setShowArchived(v=>!v)} className="text-[11px] font-bold text-violet-600">{showArchived ? "Active products dekhein" : "Deleted / Archived products"}</button></div><div className="divide-y divide-gray-50">{s.products.filter(p=>showArchived ? !!p.archived_at : !p.archived_at).map((p)=><div key={p.id} className="py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0">{p.imageUrl?<img src={p.imageUrl} className="w-9 h-9 rounded-lg object-cover"/>:<div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14}/></div>}<div className="min-w-0"><div className="text-sm font-semibold truncate">{p.name}</div><div className={`text-[11px] ${p.stock<=3?'text-red-500':'text-gray-500'}`}>Stock: {stockLabel(p)}</div></div></div><div className="flex items-center gap-2"><span className="font-bold text-sm">{formatINR(Number(p.price))}{unitLabel(p.unit)}</span>{!showArchived && <button onClick={()=>onSetProductVisibility?.(s.id,p.id,(p.visibilityMode||"public")==="public"?"search_only":"public")} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{(p.visibilityMode||"public")==="public"?"Hide from suggestions":"Search only"}</button>}<button onClick={()=>{setEditing({...p,shopId:s.id,category:s.category,categoryData:p.categoryData||{},packSize:p.packSize||getInventoryMeta(p.id).packSize||10,stock:p.unit==='pack'?((Number(p.stock)||0)/Number(p.packSize||getInventoryMeta(p.id).packSize||10)):p.stock});setImagePreview(p.imageUrl||null);setImageFile(null);if(editFileRef.current)editFileRef.current.value="";}} className="text-violet-600 text-xs font-bold px-2 py-1 bg-violet-50 rounded-lg">Edit</button>{showArchived ? <button onClick={()=>onRestoreProduct?.(s.id,p.id)} className="text-emerald-700 text-xs font-bold px-2 py-1 bg-emerald-50 rounded-lg">Restore</button> : <button onClick={()=>{if(confirm(`"${p.name}" ko archive karein? Purani billing aur stock history safe rahegi.`)) onDeleteProduct?.(s.id,p.id,p.name);}} className="text-red-600 text-xs font-bold px-2 py-1 bg-red-50 rounded-lg" title="Archive product"><Trash2 size={13}/></button>}</div></div>)}</div>
      </div>}
    </div>
    {menuOpen && <ShopMenuSheet shop={shop} items={menuItems} onPick={pickMenu} onClose={() => setMenuOpen(false)} />}
    {modals}
  </div>;
}
