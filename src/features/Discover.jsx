import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import VoiceInput from "../../components/VoiceInput";
import { parseSearchVoice } from "../../lib/voiceParser";
import { formatINR, formatKm, distanceKm, CATEGORIES, AREAS, SEARCH_AD_PRICING, SEARCH_AD_LEVEL_LABEL } from "../../data/mockData";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";
import { BarcodeScanModal } from "../shops/ShopForms";
import { promotionRank, productPromotionRank } from "../promotions/promotionService";
import SponsoredLoadingCard from "../ads/SponsoredLoadingCard";

export function ShopCard({ shop, onOpen, distanceLabel }) {
  const call = (e) => { e.stopPropagation(); window.open(`tel:${shop.phone}`); };
  const whatsapp = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${shop.phone}`); };
  const maps = (e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${shop.lat},${shop.lng}`); };

  return (
    <div onClick={() => onOpen(shop)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-gray-900">{shop.name}</div>
          <div className="text-xs text-gray-400">{shop.category} · {shop.area}</div>{promotionRank(shop.promotion)>0&&<span className="inline-block mt-1 text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{shop.promotion.badge||"PROMOTED"} · SPONSORED</span>}
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-amber-500 text-xs"><Star size={12} fill="currentColor" /> {shop.rating}</span>
            {distanceLabel && <span className="flex items-center gap-1 text-violet-500 text-xs font-semibold"><MapPin size={11} /> {distanceLabel}</span>}
          </div>
        </div>
        {shop.flashDeal && (
          <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Zap size={10} /> DEAL
          </span>
        )}
        {shop.isClaimed === false && (
          <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full">UNCLAIMED</span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {shop.products.length > 0
          ? shop.products.slice(0, 2).map((p) => `${p.name} · ${formatINR(p.price)}`).join("  |  ")
          : shop.isClaimed === false && "Google se import — products list ke liye owner ko claim karna hoga"}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={call} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg">
          <Phone size={13} /> Call
        </button>
        <button onClick={whatsapp} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg">
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button onClick={maps} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg">
          <Navigation size={13} /> Maps
        </button>
      </div>
    </div>
  );
}

export function ProductResultCard({ product, shop, distanceLabel, onOpenShop }) {
  const call = (e) => { e.stopPropagation(); window.open(`tel:${shop.phone}`); };
  const whatsapp = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${shop.phone}`); };
  const maps = (e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${shop.lat},${shop.lng}`); };

  return (
    <div onClick={() => onOpenShop(shop)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-gray-900">{product.name}</div>{productPromotionRank(product.promotion)>0&&<span className="inline-block mt-1 text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{product.promotion.badge||"FEATURED"} · SPONSORED</span>}
          <div className="text-xs text-gray-400 mt-0.5">Available at <span className="font-semibold text-gray-600">{shop.name}</span></div>
          <div className="flex items-center gap-2 mt-1">
            {distanceLabel && <span className="flex items-center gap-1 text-violet-500 text-xs font-semibold"><MapPin size={11} /> {distanceLabel} away</span>}
            <span className="text-xs text-gray-400">{shop.area}</span>
          </div>
        </div>
        <div className="text-right">{product.promotion?.newPrice && <div className="text-[10px] text-gray-400 line-through">{formatINR(Number(product.price))}</div>}<div className="font-extrabold text-violet-600">{formatINR(Number(product.promotion?.newPrice || product.price))}</div></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={call} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg">
          <Phone size={13} /> Call
        </button>
        <button onClick={whatsapp} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg">
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button onClick={maps} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg">
          <Navigation size={13} /> Maps
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: components/SponsoredLoadingCard.jsx
============================================================================ */

export function DiscoverTab({ shops, user, onOpenShop, onAddShop, onOpenMyShop, location, onLocate, userCoords, onPriceCheck, onLogSearch }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showScan, setShowScan] = useState(false);
  const [searchMode, setSearchMode] = useState("smart");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(() => { setIsSearching(false); if (query.trim()) onLogSearch?.(query.trim(), category); }, 650);
    return () => clearTimeout(t);
  }, [query, searchMode]);

  const liveShops = shops.filter((s) => !s.isBlocked && (category === "All" || s.category === category));

  const withDistance = (list) =>
    list
      .map((s) => ({ ...s, _dist: distanceKm(userCoords?.lat, userCoords?.lng, s.lat, s.lng) }))
      .sort((a, b) => (promotionRank(b.promotion) - promotionRank(a.promotion)) || ((a._dist ?? 999) - (b._dist ?? 999)));

  const q = query.trim().toLowerCase();

  let shopResults = [];
  let productResults = [];

  if (!q) {
    shopResults = withDistance(liveShops);
  } else if (searchMode === "shop") {
    shopResults = withDistance(liveShops.filter((s) => s.name.toLowerCase().includes(q)));
  } else if (searchMode === "product") {
    liveShops.forEach((s) => s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) productResults.push({ product: p, shop: s }); }));
    productResults = productResults
      .map((r) => ({ ...r, _dist: distanceKm(userCoords?.lat, userCoords?.lng, r.shop.lat, r.shop.lng) }))
      .sort((a, b) => (productPromotionRank(b.product.promotion) - productPromotionRank(a.product.promotion)) || (promotionRank(b.shop.promotion) - promotionRank(a.shop.promotion)) || ((a._dist ?? 999) - (b._dist ?? 999)));
  } else {
    const shopMatches = liveShops.filter((s) => s.name.toLowerCase().includes(q));
    if (shopMatches.length > 0) {
      shopResults = withDistance(shopMatches);
    } else {
      liveShops.forEach((s) => s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) productResults.push({ product: p, shop: s }); }));
      productResults = productResults
        .map((r) => ({ ...r, _dist: distanceKm(userCoords?.lat, userCoords?.lng, r.shop.lat, r.shop.lng) }))
        .sort((a, b) => (productPromotionRank(b.product.promotion) - productPromotionRank(a.product.promotion)) || (promotionRank(b.shop.promotion) - promotionRank(a.shop.promotion)) || ((a._dist ?? 999) - (b._dist ?? 999)));
    }
  }

  const hasShop = user.myShopIds && user.myShopIds.length > 0;

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-8 rounded-b-3xl text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <MapPin size={14} /> {location}
          </div>
          <button onClick={onLocate} className="bg-white/20 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
            <Navigation size={12} /> Locate Me
          </button>
        </div>
        <div className="text-3xl font-extrabold mt-3">ShopNear</div>
        <div className="text-white/80 text-sm">Find best prices nearby</div>
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-3">
            <Search size={16} className="text-gray-400" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, barcodes, ya dukan..." className="flex-1 outline-none px-2 text-sm text-gray-700"
            />
          </div>
          <VoiceInput onText={(text) => { const parsed = parseSearchVoice(text); if (parsed.compare && parsed.query) onPriceCheck(parsed.query, ""); else setQuery(parsed.query || text); }} />
          <button onClick={() => setShowScan(true)} className="bg-indigo-700 w-11 h-11 rounded-xl flex items-center justify-center">
            <ScanLine size={20} />
          </button>
        </div>

        <div className="flex bg-white/15 rounded-xl p-1 mt-3">
          {[
            { key: "smart", label: "Product ya Shop" },
            { key: "product", label: "Sirf Product" },
            { key: "shop", label: "Sirf Shop" },
          ].map((m) => (
            <button
              key={m.key} onClick={() => setSearchMode(m.key)}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg ${searchMode === m.key ? "bg-white text-violet-700" : "text-white/80"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPriceCheck("", "")}
          className="w-full mt-2 bg-emerald-400/90 text-emerald-950 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
        >
          <IndianRupee size={14} /> Scan a purchase — kya kahi sasta hai?
        </button>
      </div>

      <div className="px-5 -mt-4">
        <button
          onClick={hasShop ? onOpenMyShop : onAddShop}
          className="w-full bg-white shadow-lg rounded-2xl p-4 flex items-center justify-between border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <Store size={18} />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-900 text-sm">{hasShop ? "My Shop" : "Add Your Shop"}</div>
              <div className="text-xs text-gray-400">{hasShop ? `Manage ${user.myShopIds.length} shop(s)` : "Start selling to your neighbourhood"}</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${category === c ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4">
        {q && isSearching ? (
          <SponsoredLoadingCard />
        ) : (
          <>
            {q && productResults.length > 0 && (
              <div className="text-xs text-gray-400 mb-2">"{query}" dukan naam se nahi mila — yeh product jin dukaano me mila, sabse najdik pehle:</div>
            )}

            {productResults.length > 0
              ? productResults.map((r, i) => (
                  <ProductResultCard key={r.product.id + i} product={r.product} shop={r.shop} distanceLabel={formatKm(r._dist)} onOpenShop={onOpenShop} />
                ))
              : shopResults.length === 0
              ? <div className="text-center text-gray-400 text-sm mt-10">Koi result nahi mila. Kuch aur try kariye.</div>
              : shopResults.map((s) => <ShopCard key={s.id} shop={s} onOpen={onOpenShop} distanceLabel={formatKm(s._dist)} />)
            }
          </>
        )}
      </div>

      {showScan && (
        <BarcodeScanModal
          subtitle="Barcode ko frame ke andar rakhiye..."
          onClose={() => setShowScan(false)}
          onDetected={(item) => {
            setShowScan(false);
            if (item.name) { setQuery(item.name); setSearchMode("product"); }
            else alert(`Barcode ${item.code} pehchana nahi gaya. Naam se search kariye.`);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/ShopDetail.jsx
============================================================================ */

export function ShopDetail({ shop, onBack, onAddReview, currentUserName, onClaimShop }) {
  const [tab, setTab] = useState("products");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [productSearch, setProductSearch] = useState("");
  const [detailProduct, setDetailProduct] = useState(null);

  const filteredProducts = shop.products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold">{shop.name}</div>
        <div className="text-white/80 text-sm">{shop.category} · {shop.area}</div>
        <div className="flex items-center gap-1 mt-1 text-amber-300 text-sm"><Star size={14} fill="currentColor" /> {shop.rating}</div>
        <div className="flex gap-2 mt-4">
          <a href={`tel:${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><Phone size={13} /> Call</a>
          <a href={`https://wa.me/91${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
          <a href={`https://maps.google.com/?q=${shop.lat},${shop.lng}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><Navigation size={13} /> Maps</a>
        </div>
      </div>

      {shop.isClaimed === false && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="font-bold text-sm text-amber-800 flex items-center gap-2"><Store size={16} /> Unclaimed Listing</div>
          <div className="text-xs text-amber-700 mt-1">
            Yeh listing public jaankari (jaise Google) se import ki gayi hai — koi products/stock data nahi hai kyuki wo private hai. Kya yeh aapki dukaan hai?
          </div>
          <button
            onClick={() => onClaimShop(shop.id)}
            className="mt-3 w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Claim This Shop — Free me manage kariye
          </button>
        </div>
      )}

      <div className="flex px-5 mt-4 gap-2">
        {["products", "reviews"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-xs font-semibold capitalize ${tab === t ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>{t}</button>
        ))}
      </div>

      {tab === "products" && (
        <div className="px-5 mt-4 space-y-3">
          <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <Search size={15} className="text-gray-400" />
            <input
              value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Is dukaan me product dhundo..." className="flex-1 outline-none px-2 text-sm text-gray-700"
            />
          </div>
          {shop.products.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-6">
              {shop.isClaimed === false ? "Abhi tak koi product list nahi hui — owner ke claim karne ke baad hi dikhega." : "Abhi tak koi product add nahi hua."}
            </div>
          )}
          {shop.products.length > 0 && filteredProducts.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-6">"{productSearch}" is dukaan me nahi mila.</div>
          )}
          {filteredProducts.map((p) => {
            const isOpen = detailProduct === p.id;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => setDetailProduct(isOpen ? null : p.id)}
                  className="w-full text-left p-4 flex gap-3 items-center active:bg-gray-50"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300">
                      <Package size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {p.unit === "piece" ? `${p.stock} pcs available` : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit} available`}
                    </div>
                  </div>
                  <div className="font-bold text-violet-600">{formatINR(p.price)}</div>
                  <ChevronRight size={16} className={`text-gray-300 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 animate-[fadeIn_0.2s_ease-in]">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[11px] text-gray-400">Available Stock</div>
                        <div className="font-bold text-sm text-gray-800">{p.unit === "piece" ? `${p.stock} pcs` : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit}`}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[11px] text-gray-400">Price Update</div>
                        <div className="font-bold text-sm text-gray-800">{timeAgo(p.lastUpdated)}</div>
                      </div>
                    </div>

                    {p.expiryDate && (
                      <div className="bg-amber-50 rounded-xl p-3 mb-3 text-xs text-amber-700 font-semibold">
                        Expiry: {new Date(p.expiryDate).toLocaleDateString("en-IN")}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 font-medium mb-1">Price History</div>
                    <div className="h-32 mb-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={p.history}>
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                          <Tooltip formatter={(v) => formatINR(v)} />
                          <Line type="monotone" dataKey="price" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex gap-2">
                      <a href={`tel:${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2.5 rounded-lg"><Phone size={13} /> Call</a>
                      <a href={`https://wa.me/91${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2.5 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "reviews" && (
        <div className="px-5 mt-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Apna review likhiye</div>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={18} onClick={() => setReviewRating(n)} className={n <= reviewRating ? "text-amber-400 cursor-pointer" : "text-gray-200 cursor-pointer"} fill={n <= reviewRating ? "currentColor" : "none"} />
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Aapka anubhav kaisa raha?" className="w-full border border-gray-200 rounded-xl p-2 text-sm outline-none" rows={2} />
            <button
              onClick={() => { if (reviewText.trim()) { onAddReview(shop.id, { id: genId("r"), user: currentUserName, rating: reviewRating, text: reviewText, reply: null }); setReviewText(""); } }}
              className="mt-2 bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg"
            >
              Submit Review
            </button>
          </div>
          {shop.reviews.length === 0 && <div className="text-center text-gray-400 text-sm mt-4">Abhi tak koi review nahi.</div>}
          {shop.reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between">
                <div className="font-semibold text-sm text-gray-800">{r.user}</div>
                <div className="flex text-amber-400">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>
              </div>
              <div className="text-sm text-gray-600 mt-1">{r.text}</div>
              {r.reply && (
                <div className="mt-2 bg-violet-50 rounded-lg p-2 text-xs text-violet-700">
                  <span className="font-semibold">Owner reply {shop.premiumReviews && <Lock size={10} className="inline ml-1" />}: </span>{r.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/PriceCheckScreen.jsx
============================================================================ */

export function PriceCheckScreen({ shops, userCoords, initialProductName, initialPrice, onBack, onOpenShop }) {
  const [productName, setProductName] = useState(initialProductName || "");
  const [paidPrice, setPaidPrice] = useState(initialPrice ? String(initialPrice) : "");
  const [showScan, setShowScan] = useState(false);

  const q = productName.trim().toLowerCase();
  const matches = [];
  if (q) {
    shops.forEach((s) => {
      if (s.isBlocked) return;
      s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) matches.push({ product: p, shop: s }); });
    });
  }
  const withDist = matches
    .map((m) => ({ ...m, _dist: distanceKm(userCoords?.lat, userCoords?.lng, m.shop.lat, m.shop.lng) }))
    .sort((a, b) => a.product.price - b.product.price);

  const paid = Number(paidPrice) || null;
  const cheapest = withDist[0];
  const savingsVsPaid = paid && cheapest ? paid - cheapest.product.price : null;

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold flex items-center gap-2"><IndianRupee size={22} /> Price Check</div>
        <div className="text-white/80 text-sm mt-1">Dekhte hain kahi aur sasta to nahi mil raha</div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500 font-medium">Product ka naam</label>
            <button onClick={() => setShowScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
              <ScanLine size={12} /> Scan
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <input
                value={productName} onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Paracetamol" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <VoiceInput onText={(text) => { const parsed = parseSearchVoice(text); setProductName(parsed.query || text); }} />
          </div>
          <label className="text-xs text-gray-500 font-medium">Aapne kitne me liya? (₹) — optional</label>
          <input
            value={paidPrice} onChange={(e) => setPaidPrice(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 20" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 outline-none"
          />
        </div>

        {!q && <div className="text-center text-gray-400 text-sm mt-6">Product ka naam daaliye ya upar scan kariye.</div>}

        {q && withDist.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-6">Yeh product aas-paas kisi registered shop me nahi mila.</div>
        )}

        {withDist.length > 0 && (
          <div className="space-y-2">
            {paid && cheapest && (
              <div className={`rounded-2xl p-4 text-center font-bold ${savingsVsPaid > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {savingsVsPaid > 0
                  ? `🎉 ${cheapest.shop.name} me ${formatINR(savingsVsPaid)} sasta hai!`
                  : "Aapne already sabse acha price liya tha 👍"}
              </div>
            )}
            {withDist.map((m, i) => {
              const diff = paid ? paid - m.product.price : null;
              return (
                <div key={m.product.id + i} onClick={() => onOpenShop(m.shop)} className="bg-white rounded-2xl p-4 border border-gray-100 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{m.shop.name}</div>
                      <div className="text-xs text-gray-400">{m.shop.area} {m._dist != null && `· ${formatKm(m._dist)} away`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-violet-600">{formatINR(m.product.price)}</div>
                      {diff != null && diff !== 0 && (
                        <div className={`text-[10px] font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-400"}`}>
                          {diff > 0 ? `${formatINR(diff)} cheaper` : `${formatINR(-diff)} costlier`}
                        </div>
                      )}
                      {i === 0 && <div className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5 justify-end"><Award size={10} /> Best price</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <a href={`tel:${m.shop.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg"><Phone size={13} /> Call</a>
                    <a href={`https://wa.me/91${m.shop.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
                    <a href={`https://maps.google.com/?q=${m.shop.lat},${m.shop.lng}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg"><Navigation size={13} /> Maps</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showScan && (
        <BarcodeScanModal
          subtitle="Jo cheez kharidi (ya kharidne wale hain) uska barcode scan kariye"
          onClose={() => setShowScan(false)}
          onDetected={(item) => {
            setShowScan(false);
            if (item.name) { setProductName(item.name); if (item.suggestedPrice) setPaidPrice(String(item.suggestedPrice)); }
            else alert(`Barcode ${item.code} pehchana nahi gaya. Naam khud daaliye.`);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/DealsTab.jsx
============================================================================ */

