import React, { useState, useEffect } from "react";
import { Search, Flame, Megaphone, Gavel, User, Camera } from "./shared/icons";
import { supabase } from "./supabaseClient";
import { genId, shopFromRow, bidFromRow, productFromRow, AREAS } from "./data/mockData";
import { LoginScreen, BottomNav } from "./components/AppChrome";
import { InterstitialAd } from "./features/ads/InterstitialAd";
import { DiscoverTab, ShopDetail, PriceCheckScreen } from "./features/discover/Discover";
import { FeedTab } from "./features/feed/FeedTab";
import { BidTab } from "./features/bid/BidTab";
import { ProfileTab, LeaderboardScreen } from "./features/profile/Profile";
import { AddShopForm, BarcodeScanModal } from "./features/shops/ShopForms";
import { MyShopDashboard } from "./features/shop/ShopManagement";
import { ShopReportScreen } from "./features/shop/ShopReportScreen";
import { SellFlow } from "./features/billing/SellFlow";
import { AdminPanel, EnterpriseTab, DataPortal } from "./features/admin/Admin";
import { NeedItScreen } from "./features/needIt/NeedItScreen";
import { setInventoryMeta } from "./lib/inventory";
import TodayHub from "./features/home/TodayHub";
import { makePromotion, PROMOTION_OPTIONS } from "./features/promotions/promotionService";

function AppInner() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [screen, setScreen] = useState("discover");
  const [activeShop, setActiveShop] = useState(null);
  const [sellShopId, setSellShopId] = useState(null);
  const [reportShopId, setReportShopId] = useState(null);
  const [priceCheckSeed, setPriceCheckSeed] = useState({ name: "", price: "" });
  const [showAd, setShowAd] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [location, setLocation] = useState("Surat, Gujarat (default)");
  const [userCoords, setUserCoords] = useState({ lat: 21.1702, lng: 72.8311 });
  const [needRequests, setNeedRequests] = useState([]);

  const [shops, setShops] = useState([]);
  const [bids, setBids] = useState([]);
  const [feed, setFeed] = useState([]);
  const [salesLog, setSalesLog] = useState([]);
  const [dataLicenses, setDataLicenses] = useState([]);
  const [activeDataLicense, setActiveDataLicense] = useState(null);
  const [users, setUsers] = useState([]);
  const [blockedList, setBlockedList] = useState({ phones: [], addresses: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---- Initial load: pull everything from Supabase once on mount ----
  useEffect(() => {
    async function loadAll() {
      try {
        const [
          { data: shopRows }, { data: productRows }, { data: reviewRows },
          { data: bidRows }, { data: offerRows }, { data: feedRows },
          { data: salesRows }, { data: blockedRows }, { data: licenseRows }, { data: userRows },
        ] = await Promise.all([
          supabase.from("shops").select("*"),
          supabase.from("products").select("*"),
          supabase.from("reviews").select("*"),
          supabase.from("bids").select("*").order("created_at", { ascending: false }),
          supabase.from("bid_offers").select("*"),
          supabase.from("feed_posts").select("*").order("created_at", { ascending: false }),
          supabase.from("sales_log").select("*").order("created_at", { ascending: false }),
          supabase.from("blocked_entities").select("*"),
          supabase.from("data_licenses").select("*").order("created_at", { ascending: false }),
          supabase.from("users").select("*"),
        ]);

        const { data: needRows, error: needErr } = await supabase.from("need_requests").select("*").order("created_at", { ascending: false });
        if (!needErr) {
          const now = Date.now();
          const active = (needRows || []).filter(r => new Date(r.expires_at).getTime() > now && r.status !== "expired");
          setNeedRequests(active);
          const expired = (needRows || []).filter(r => new Date(r.expires_at).getTime() <= now && r.status === "open").map(r => r.id);
          if (expired.length) await supabase.from("need_requests").update({ status: "expired" }).in("id", expired);
        }
        const mergedShops = (shopRows || []).map((r) => shopFromRow(r, productRows, reviewRows));
        const shopsById = Object.fromEntries(mergedShops.map((s) => [s.id, s]));

        setShops(mergedShops);
        setBids((bidRows || []).map((r) => bidFromRow(r, offerRows, shopsById)));
        setFeed((feedRows || []).map((r) => ({ id: r.id, shopName: shopsById[r.shop_id]?.name || "Shop", text: r.text, likes: r.likes, time: new Date(r.created_at).getTime() })));
        setSalesLog((salesRows || []).map((r) => ({
          id: r.id, shopId: r.shop_id, shopName: shopsById[r.shop_id]?.name || "Shop", area: r.area, city: r.city, state: r.state, country: r.country,
          category: r.category, productName: r.product_name, qty: Number(r.qty), revenue: Number(r.revenue), timestamp: new Date(r.created_at).getTime(),
        })));
        setBlockedList({
          phones: (blockedRows || []).filter((b) => b.type === "phone").map((b) => b.value),
          addresses: (blockedRows || []).filter((b) => b.type === "address").map((b) => b.value),
        });
        setDataLicenses((licenseRows || []).map((r) => ({ id: r.id, code: r.code, level: r.level, value: r.value, category: r.category, revoked: r.revoked, createdAt: new Date(r.created_at).getTime() })));
        setUsers((userRows || []).map((r) => ({ id: r.id, name: r.name, phone: r.phone, points: r.points, streak: r.streak, lastCheckIn: r.last_check_in ? new Date(r.last_check_in).getTime() : null, isBlocked: r.is_blocked, referralCode: r.referral_code })));
      } catch (err) {
        console.error("Failed to load data from Supabase:", err);
        setLoadError("Database se data load nahi ho paya. Environment variables check kariye.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const openNeedIt = () => { setScreen("needIt"); setShowAd(true); };
  const refreshNeedRequests = async () => {
    const { data } = await supabase.from("need_requests").select("*").order("created_at", { ascending: false });
    if (data) {
      const now = Date.now();
      const expired = data.filter(r => new Date(r.expires_at).getTime() <= now && r.status === "open").map(r => r.id);
      if (expired.length) await supabase.from("need_requests").update({ status: "expired" }).in("id", expired);
      setNeedRequests(data.filter(r => new Date(r.expires_at).getTime() > now && r.status !== "expired"));
    }
  };
  useEffect(() => { if (!user) return; const t=setInterval(refreshNeedRequests,15000); return()=>clearInterval(t); }, [user]);
  const changeTab = (key) => {
    if (key === "needIt") setShowAd(true);
    setTabSwitches((c) => {
      const next = c + 1;
      if (next % 3 === 0) setShowAd(true);
      return next;
    });
    setScreen(key);
  };

  const handleLogin = async (phone) => {
    try {
      let existing = users.find((u) => u.phone === phone);
      if (!existing) {
        const { data, error } = await supabase
          .from("users")
          .insert({ phone, name: "Naya User", referral_code: genId("REF").toUpperCase() })
          .select()
          .single();
        if (error) {
          if (error.code === "23505") {
            // User already exists in the DB but our local cache missed it (e.g. loaded
            // before this account was created elsewhere) — just fetch it instead.
            const { data: found, error: findErr } = await supabase.from("users").select("*").eq("phone", phone).single();
            if (findErr || !found) { alert("Login error: " + error.message); return; }
            existing = { id: found.id, name: found.name, phone: found.phone, points: found.points, streak: found.streak, lastCheckIn: found.last_check_in ? new Date(found.last_check_in).getTime() : null, isBlocked: found.is_blocked, referralCode: found.referral_code };
          } else {
            alert("Login error: " + error.message);
            return;
          }
        } else {
          existing = { id: data.id, name: data.name, phone: data.phone, points: data.points, streak: data.streak, lastCheckIn: null, isBlocked: false, referralCode: data.referral_code };
        }
        setUsers((u) => [...u, existing]);
      }
      setUser(existing);
      setShowAd(true);
    } catch (err) {
      alert("Login fail hua: " + err.message);
    }
  };

  const handleAdminLogin = () => { setIsAdmin(true); setShowAd(false); };

  const blockCheck = (phone, address) => blockedList.phones.includes(phone) || blockedList.addresses.includes(address);

  const myShops = user ? shops.filter((s) => s.owner_id === user.id) : [];
  const userView = user ? { ...user, myShopIds: myShops.map((s) => s.id) } : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
        <div className="text-white text-center">
          <div className="text-4xl mb-2">🏪</div>
          <div className="font-semibold">Loading ShopNear...</div>
          {loadError && <div className="text-red-200 text-sm mt-3 max-w-xs">{loadError}</div>}
        </div>
      </div>
    );
  }

  if (activeDataLicense) {
    return <DataPortal license={activeDataLicense} salesLog={salesLog} onBack={() => setActiveDataLicense(null)} />;
  }

  if (!user && !isAdmin) {
    return (
      <LoginScreen
        onLogin={handleLogin} onAdminLogin={handleAdminLogin} blockedPhones={blockedList.phones}
        dataLicenses={dataLicenses} onViewData={(lic) => setActiveDataLicense(lic)}
      />
    );
  }

  if (isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen font-sans">
        <AdminPanel
          shops={shops} users={users} bids={bids} salesLog={salesLog} dataLicenses={dataLicenses} blockedList={blockedList}
          onBlockShop={async (id) => {
            const s = shops.find((x) => x.id === id);
            await supabase.from("shops").update({ is_blocked: true }).eq("id", id);
            await supabase.from("blocked_entities").insert([{ type: "phone", value: s.phone }, { type: "address", value: s.address }]);
            setShops((prev) => prev.map((x) => (x.id === id ? { ...x, isBlocked: true } : x)));
            setBlockedList((b) => ({ phones: [...new Set([...b.phones, s.phone])], addresses: [...new Set([...b.addresses, s.address])] }));
          }}
          onUnblockShop={async (id) => {
            const s = shops.find((x) => x.id === id);
            await supabase.from("shops").update({ is_blocked: false }).eq("id", id);
            await supabase.from("blocked_entities").delete().in("value", [s.phone, s.address]);
            setShops((prev) => prev.map((x) => (x.id === id ? { ...x, isBlocked: false } : x)));
            setBlockedList((b) => ({ phones: b.phones.filter((p) => p !== s.phone), addresses: b.addresses.filter((a) => a !== s.address) }));
          }}
          onBlockUser={async (id) => {
            const u = users.find((x) => x.id === id);
            await supabase.from("users").update({ is_blocked: true }).eq("id", id);
            await supabase.from("blocked_entities").insert({ type: "phone", value: u.phone });
            setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, isBlocked: true } : x)));
            setBlockedList((b) => ({ ...b, phones: [...new Set([...b.phones, u.phone])] }));
          }}
          onUnblockUser={async (id) => {
            const u = users.find((x) => x.id === id);
            await supabase.from("users").update({ is_blocked: false }).eq("id", id);
            await supabase.from("blocked_entities").delete().eq("value", u.phone);
            setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, isBlocked: false } : x)));
            setBlockedList((b) => ({ ...b, phones: b.phones.filter((p) => p !== u.phone) }));
          }}
          onGenerateLicense={async (scope) => {
            const code = `SN-${genId("").toUpperCase()}`;
            const { data } = await supabase.from("data_licenses").insert({ code, level: scope.level, value: scope.value, category: scope.category }).select().single();
            if (data) setDataLicenses((prev) => [{ id: data.id, code: data.code, level: data.level, value: data.value, category: data.category, revoked: false, createdAt: Date.now() }, ...prev]);
          }}
          onRevokeLicense={async (id) => {
            const lic = dataLicenses.find((l) => l.id === id);
            await supabase.from("data_licenses").update({ revoked: !lic.revoked }).eq("id", id);
            setDataLicenses((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: !l.revoked } : l)));
          }}
          onLogout={() => setIsAdmin(false)}
        />
      </div>
    );
  }

  const tabs = [
    { key: "discover", label: "Discover", icon: Search },
    { key: "deals", label: "Aaj", icon: Flame },
    { key: "feed", label: "Feed", icon: Megaphone },
    { key: "bid", label: "Bid", icon: Gavel },
    { key: "profile", label: "Profile", icon: User },
    { key: "needIt", label: "Need It", icon: Camera },
  ];

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen font-sans relative">
      {showAd && <InterstitialAd onClose={() => setShowAd(false)} />}

      {screen === "discover" && (
        <DiscoverTab
          shops={shops} user={userView} location={location} userCoords={userCoords}
          onLocate={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocation("Current Location (GPS)"); },
                () => setLocation("Location permission denied")
              );
            } else {
              setLocation("GPS not available on this device");
            }
          }}
          onOpenShop={(s) => { setActiveShop(s); setScreen("shopDetail"); }}
          onAddShop={() => setScreen("addShop")}
          onOpenMyShop={() => setScreen("myShop")}
          onPriceCheck={(name, price) => { setPriceCheckSeed({ name, price }); setScreen("priceCheck"); }}
          onLogSearch={async (query, category) => {
            await supabase.from("search_events").insert({ user_id: user.id, query, category: category === "All" ? null : category, area: location });
          }}
        />
      )}

      {screen === "needIt" && (
        <NeedItScreen
          user={user} shops={shops} userCoords={userCoords} location={location} requests={needRequests}
          onBack={() => setScreen("discover")} onOpenAd={() => setShowAd(true)}
          onOpenShop={(s) => { if (!s) return; setActiveShop(s); setScreen("shopDetail"); }}
          onCreateRequest={async ({category,title,details,imageUrl}) => {
            const expiresAt = new Date(Date.now()+2*60*60*1000).toISOString();
            // BUG FIX: city used to be hardcoded to "Surat" for every request, no matter
            // where the customer's GPS coords actually were. Reverse-geocode the real
            // coordinates instead, falling back to Surat only if that lookup fails.
            let city = "Surat";
            try {
              const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${userCoords.lat}&lon=${userCoords.lng}`);
              const geo = await geoRes.json();
              city = geo?.address?.city || geo?.address?.town || geo?.address?.municipality || geo?.address?.county || city;
            } catch {}
            const { data, error } = await supabase.from("need_requests").insert({ customer_id:user.id, category, title, details, image_url:imageUrl, area:location, city, lat:userCoords.lat, lng:userCoords.lng, status:"open", expires_at:expiresAt }).select().single();
            if(error){ alert("Need It save nahi hua: "+error.message); return; }
            setNeedRequests(prev=>[data,...prev]);
          }}
          onRespond={async (requestId,shopId) => {
            const { data, error } = await supabase.from("need_responses").insert({ request_id:requestId, shop_id:shopId, message:"Mere paas hai — shop par available hai." }).select().single();
            if(error && error.code !== "23505"){ alert("Response nahi gaya: "+error.message); return; }
            await refreshNeedRequests();
          }}
          onCloseRequest={async id => { await supabase.from("need_requests").update({status:"closed",closed_at:new Date().toISOString()}).eq("id",id).eq("customer_id",user.id); setNeedRequests(p=>p.map(r=>r.id===id?{...r,status:"closed"}:r)); }}
          onComing={async (requestId,responseId) => { await supabase.from("need_requests").update({status:"coming"}).eq("id",requestId).eq("customer_id",user.id); await supabase.from("need_responses").update({status:"coming"}).eq("id",responseId); setNeedRequests(p=>p.map(r=>r.id===requestId?{...r,status:"coming"}:r)); alert("Shop ko bata diya: aap lene aa rahe ho. Agar saman mil gaya ho to Already Bought dabakar request close kar dena."); }}
        />
      )}

      {screen === "priceCheck" && (
        <PriceCheckScreen
          shops={shops} userCoords={userCoords}
          initialProductName={priceCheckSeed.name} initialPrice={priceCheckSeed.price}
          onBack={() => setScreen("discover")}
          onOpenShop={(s) => { setActiveShop(s); setScreen("shopDetail"); }}
        />
      )}

      {screen === "shopDetail" && activeShop && (
        <ShopDetail
          shop={shops.find((s) => s.id === activeShop.id)}
          currentUserName={user.name}
          onBack={() => setScreen("discover")}
          onAddReview={async (shopId, review) => {
            const { data } = await supabase.from("reviews").insert({ shop_id: shopId, user_name: review.user, rating: review.rating, text: review.text }).select().single();
            const newReview = data ? { id: data.id, user: data.user_name, rating: data.rating, text: data.text, reply: null } : review;
            setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, reviews: [newReview, ...s.reviews] } : s)));
          }}
          onClaimShop={async (shopId) => {
            await supabase.from("shops").update({ owner_id: user.id, is_claimed: true }).eq("id", shopId);
            setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, isClaimed: true, owner_id: user.id } : s)));
            alert("Shop claim ho gayi! Ab aap My Shop se products, stock aur billing manage kar sakte hain.");
            setScreen("myShop");
          }}
        />
      )}

      {screen === "deals" && (
        <TodayHub
          shops={shops}
          user={user}
          userCoords={userCoords}
          onOpenShop={(s) => { setActiveShop(s); setScreen("shopDetail"); }}
          onClaimReward={async (points) => {
            if (!points) return;
            const next = Number(user.points || 0) + Number(points);
            const { error } = await supabase.from("users").update({ points: next }).eq("id", user.id);
            if (!error) { setUser(u => ({ ...u, points: next })); setUsers(us => us.map(x => x.id === user.id ? { ...x, points: next } : x)); }
          }}
        />
      )}

      {screen === "feed" && (
        <FeedTab
          posts={feed}
          onLike={async (id) => {
            const post = feed.find((p) => p.id === id);
            await supabase.from("feed_posts").update({ likes: post.likes + 1 }).eq("id", id);
            setFeed((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
          }}
          onCreatePost={async (text) => {
            const shop = myShops[0];
            const { data } = await supabase.from("feed_posts").insert({ shop_id: shop?.id || null, text }).select().single();
            if (data) setFeed((prev) => [{ id: data.id, shopName: shop?.name || user.name, text, likes: 0, time: Date.now() }, ...prev]);
          }}
        />
      )}

      {screen === "bid" && (
        <BidTab
          bids={bids} ownerShops={myShops.map((s) => s.id)}
          onCreateBid={async (item, budget, area) => {
            // BUG FIX: area used to be hardcoded to AREAS[0] ("Ring Road") for every bid,
            // no matter where the customer actually was — now it's whatever they picked.
            const bidArea = area || AREAS[0];
            const { data } = await supabase.from("bids").insert({ customer_id: user.id, customer_name: user.name, item, budget, area: bidArea }).select().single();
            if (data) setBids((prev) => [{ id: data.id, customer: user.name, item, budget, area: bidArea, status: "open", createdAt: Date.now(), offers: [] }, ...prev]);
          }}
          onOwnerOffer={async (bidId, shopId, price) => {
            const shop = shops.find((s) => s.id === shopId);
            await supabase.from("bid_offers").insert({ bid_id: bidId, shop_id: shopId, price, message: "Available now" });
            setBids((prev) => prev.map((b) => (b.id === bidId ? { ...b, offers: [...b.offers, { shopId, shopName: shop.name, price, message: "Available now" }] } : b)));
          }}
        />
      )}

      {screen === "profile" && (
        <ProfileTab
          user={userView}
          onCheckIn={async () => {
            const nowDate = new Date();
            const last = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
            const today = nowDate.toDateString();
            const yesterday = new Date(nowDate.getTime() - 86400000).toDateString();
            if (last && last.toDateString() === today) return;
            const newPoints = Number(user.points || 0) + 10;
            const newStreak = last && last.toDateString() === yesterday ? Number(user.streak || 0) + 1 : 1;
            const now = nowDate.toISOString();
            await supabase.from("users").update({ points: newPoints, streak: newStreak, last_check_in: now }).eq("id", user.id);
            setUser((u) => ({ ...u, points: newPoints, streak: newStreak, lastCheckIn: Date.now() }));
            setUsers((us) => us.map(x => x.id === user.id ? { ...x, points: newPoints, streak: newStreak, lastCheckIn: Date.now() } : x));
          }}
          onOpenLeaderboard={() => setScreen("leaderboard")}
          onOpenAddShop={() => setScreen("addShop")}
          onOpenMyShop={() => setScreen("myShop")}
          onLogout={() => { setUser(null); setScreen("discover"); }}
        />
      )}

      {screen === "leaderboard" && <LeaderboardScreen currentUser={user} onBack={() => setScreen("profile")} />}

      {screen === "addShop" && (
        <AddShopForm
          blockCheck={blockCheck}
          existingShopCount={myShops.length}
          onBack={() => setScreen(myShops.length > 0 ? "myShop" : "discover")}
          onSubmit={async (form) => {
            const { data, error } = await supabase.from("shops").insert({
              owner_id: user.id, name: form.name, category: form.category, area: form.area,
              address: form.address, phone: form.phone,
              // BUG FIX: this used to be hardcoded to Surat/Gujarat/India for every new shop,
              // regardless of where the owner actually was. Now uses the city/state/country
              // captured from GPS reverse-geocoding (AddShopForm's "Use My Current Location"),
              // falling back to Surat/Gujarat/India only if the owner typed the address by hand.
              city: form.city || "Surat", state: form.state || "Gujarat", country: form.country || "India",
              lat: form.coords?.lat ?? (21.17 + Math.random() * 0.05),
              lng: form.coords?.lng ?? (72.83 + Math.random() * 0.05),
              rating: 5.0, is_claimed: true,
            }).select().single();
            if (error) { alert("Shop add nahi ho payi: " + error.message); return; }
            const newShop = shopFromRow(data, [], []);
            setShops((prev) => [newShop, ...prev]);
            setScreen("myShop");
          }}
        />
      )}

      {screen === "myShop" && (
        <MyShopDashboard
          shops={myShops}
          onBack={() => setScreen("profile")}
          onOpenSell={(shopId) => { setSellShopId(shopId); setScreen("sell"); }}
          onOpenReport={(shopId) => { setReportShopId(shopId); setScreen("myShopReport"); }}
          onAddAnotherShop={() => setScreen("addShop")}
          onPromote={async ({ shopId, productId, type, amount, hours, discount, message, coupon }) => {
            const option = PROMOTION_OPTIONS.find(x => x.key === type);
            const shop = shops.find(s => s.id === shopId);
            const product = shop?.products.find(p => p.id === productId);
            if (!shop || (option?.scope === "product" && !product)) return;
            const newPrice = product && discount > 0 ? +(Number(product.price) * (1 - Number(discount) / 100)).toFixed(2) : null;
            const promotion = makePromotion({ type, amount, hours, badge: option?.badge, discount: Number(discount) || 0, message, coupon, productId, productName: product?.name, originalPrice: product?.price, newPrice });
            if (option?.scope === "product") {
              const { error } = await supabase.from("products").update({ promotion }).eq("id", productId);
              if (error) return alert("Promotion save nahi hua: " + error.message);
              setShops(prev => prev.map(s => s.id !== shopId ? s : { ...s, products: s.products.map(p => p.id === productId ? { ...p, promotion } : p) }));
              if (type === "flash") { const flashDeal = { hours, expiresAt: new Date(promotion.expiresAt).getTime(), productName: product.name, originalPrice: product.price, discountPercent: Number(discount), newPrice, bulkOffer: null }; await supabase.from("shops").update({ flash_deal: flashDeal }).eq("id", shopId); setShops(prev => prev.map(s => s.id === shopId ? { ...s, flashDeal } : s)); }
            } else {
              const { error } = await supabase.from("shops").update({ promotion }).eq("id", shopId);
              if (error) return alert("Promotion save nahi hua: " + error.message);
              setShops(prev => prev.map(s => s.id === shopId ? { ...s, promotion } : s));
            }
            await supabase.from("promotion_events").insert({ user_id: user.id, shop_id: shopId, product_id: productId || null, type, amount, status: "mock_paid", payload: promotion });
            alert(`₹${amount} mock promotion active — ${option?.badge || "Promoted"}. Real payment gateway baad me connect karenge.`);
          }}
          onDeleteShop={async (shopId) => {
            const { error } = await supabase.from("shops").delete().eq("id", shopId);
            if (error) { alert("Delete nahi ho paya: " + error.message); return; }
            setShops((prev) => prev.filter((s) => s.id !== shopId));
          }}
          onUpdateProduct={async (shopId, productId, changes) => {
            const shop = shops.find((s) => s.id === shopId);
            const product = shop.products.find((p) => p.id === productId);
            const newHistory = [...(product.history || []), { date: "Today", price: Number(changes.price) }];
            const dbChanges = { name: changes.name, price: Number(changes.price), unit: changes.unit, stock: Number(changes.stock), pack_size: changes.unit === "pack" ? Math.max(1, Number(changes.packSize || 10)) : null, history: newHistory, image_url: changes.imageUrl || null, expiry_date: changes.expiryDate || null, barcode: changes.barcode || null, last_updated: new Date().toISOString() };
            const { error } = await supabase.from("products").update(dbChanges).eq("id", productId);
            if (error) { alert("Product update nahi hua: " + error.message); return null; }
            setShops((prev) => prev.map((s) => s.id !== shopId ? s : { ...s, products: s.products.map((p) => p.id !== productId ? p : { ...p, ...changes, price: Number(changes.price), stock: Number(changes.stock), lastUpdated: Date.now(), imageUrl: changes.imageUrl || null, expiryDate: changes.expiryDate || null, barcode: changes.barcode || null, packSize: changes.unit === "pack" ? Math.max(1, Number(changes.packSize || 10)) : null }) }));
            return { id: productId, packSize: changes.unit === "pack" ? Number(changes.packSize || 10) : null };
          }}
          onAddProduct={async (shopId, name, price, unit, stock, imageUrl, expiryDate, barcode, packSize) => {
            const { data, error } = await supabase.from("products").insert({ shop_id: shopId, name, price, unit, stock: unit === "pack" ? Number(stock) * Math.max(1, Number(packSize || 10)) : Number(stock), pack_size: unit === "pack" ? Math.max(1, Number(packSize || 10)) : null, history: [{ date: "Today", price }], image_url: imageUrl || null, expiry_date: expiryDate || null, barcode: barcode || null }).select().single();
            if (error) { alert("Product add nahi hua: " + error.message); return null; }
            const product = { ...productFromRow(data), packSize: unit === "pack" ? Number(packSize || 10) : null };
            if (unit === "pack") setInventoryMeta(data.id, { packSize: Number(packSize || 10) });
            setShops((prev) => prev.map((s) => (s.id !== shopId ? s : { ...s, products: [...s.products, product] })));
            return product;
          }}
        />
      )}

      {screen === "myShopReport" && reportShopId && (
        <ShopReportScreen
          shop={shops.find((s) => s.id === reportShopId)}
          salesLog={salesLog}
          onBack={() => setScreen("myShop")}
          onQuickDiscount={async (shopId, productName) => {
            const shop = shops.find((s) => s.id === shopId);
            const product = shop.products.find((p) => p.name === productName);
            const discountPercent = 15;
            const originalPrice = product?.price ?? 0;
            const newPrice = +(originalPrice * (1 - discountPercent / 100)).toFixed(2);
            const flashDeal = { plan: "2hr", expiresAt: Date.now() + 1000 * 60 * 120, productName, discountPercent, originalPrice, newPrice, bulkOffer: null };
            await supabase.from("shops").update({ flash_deal: flashDeal }).eq("id", shopId);
            setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, flashDeal } : s)));
            alert(`₹10 paid (mock). "${productName}" pe 15% Flash Deal live ho gaya!`);
          }}
        />
      )}

      {screen === "sell" && sellShopId && (
        <SellFlow
          shop={shops.find((s) => s.id === sellShopId)}
          onBack={() => setScreen("myShop")}
          onCompleteSale={async (shopId, cartItems) => {
            const shop = shops.find((s) => s.id === shopId);
            const nowIso = new Date().toISOString();

            const updates = await Promise.all(cartItems.map((item) => {
              const product = shop.products.find((p) => p.id === item.productId);
              if (!product) return { error: new Error(`Product ${item.name} nahi mila.`) };
              const soldQty = item.unit === "piece" ? item.qty : item.baseQty;
              const newStock = +(product.stock - soldQty).toFixed(3);
              if (newStock < -1e-9) return { error: new Error(`${item.name} ka stock kam hai.`) };
              return supabase.from("products").update({ stock: newStock, last_updated: nowIso }).eq("id", item.productId);
            }));
            const updateError = updates.find((r) => r?.error)?.error;
            if (updateError) { alert("Stock update nahi hua: " + updateError.message); return false; }

            const salesRows = cartItems.map((item) => ({
              shop_id: shop.id, product_name: item.name,
              qty: item.unit === "pack" ? +(item.baseQty * (item.packSize || 10)).toFixed(0) : item.unit === "piece" ? item.qty : +(item.baseQty * 1000).toFixed(0),
              revenue: item.lineTotal, area: shop.area, city: shop.city, state: shop.state, country: shop.country, category: shop.category,
            }));
            const { data: insertedSales } = await supabase.from("sales_log").insert(salesRows).select();

            setShops((prev) => prev.map((s) => {
              if (s.id !== shopId) return s;
              return {
                ...s,
                products: s.products.map((p) => {
                  const item = cartItems.find((c) => c.productId === p.id);
                  if (!item) return p;
                  const soldQty = item.unit === "piece" ? item.qty : item.baseQty;
                  return { ...p, stock: +(p.stock - soldQty).toFixed(3), lastUpdated: Date.now() };
                }),
              };
            }));
            if (insertedSales) {
              setSalesLog((prev) => [
                ...insertedSales.map((r) => ({
                  id: r.id, shopId: r.shop_id, shopName: shop.name, area: r.area, city: r.city, state: r.state, country: r.country,
                  category: r.category, productName: r.product_name, qty: Number(r.qty), revenue: Number(r.revenue), timestamp: Date.now(),
                })),
                ...prev,
              ]);
            }
            return true;
          }}
        />
      )}

      {["discover", "deals", "feed", "bid", "profile", "needIt"].includes(screen) && (
        <BottomNav tabs={tabs} active={screen} onChange={changeTab} />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: components/ErrorBoundary.jsx
   Safety net — if any part of the app throws (e.g. a third-party library
   like the barcode scanner misbehaving), show a friendly recoverable screen
   instead of a blank white page.
============================================================================ */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Kuch gadbad ho gayi" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="font-bold text-gray-800 mb-1">Kuch gadbad ho gayi</div>
            <div className="text-xs text-gray-500 mb-4">{this.state.message}</div>
            <button
              onClick={() => { this.setState({ hasError: false, message: "" }); window.location.reload(); }}
              className="bg-violet-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm"
            >
              Dobara try kariye
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
