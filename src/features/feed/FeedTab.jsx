import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { timeAgo, formatINR } from "../../data/mockData";
import { isPromotionActive } from "../promotions/promotionService";
import { uploadProductImage } from "../../lib/uploadImage";
import { FEED_PRO_PRICE, useFeedPro } from "../../lib/platform";
import PromotionPanel from "../promotions/PromotionPanel";
import ShopPicker from "../../components/ShopPicker";
import AdSlot from "../ads/AdSlot";

const VIDEO_OK = /^https:\/\/([a-z0-9-]+\.)*(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)(\/|$)/i;
const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/i); return m ? m[1] : null; };
// In-app player URLs. YouTube/Instagram/Facebook all provide official embed pages; they only work for PUBLIC videos.
function embedOf(u) {
  const url = String(u || "");
  const y = ytId(url); if (y) return { src: `https://www.youtube-nocookie.com/embed/${y}`, kind: "yt", ratio: /\/shorts\//i.test(url) ? "9 / 16" : "16 / 9" };
  const ig = url.match(/instagram\.com\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/i);
  if (ig) return { src: `https://www.instagram.com/${/^reel/i.test(ig[1]) ? "reel" : ig[1]}/${ig[2]}/embed`, kind: "ig" };
  if (/facebook\.com|fb\.watch/i.test(url)) return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`, kind: "fb", ratio: /\/reel\/|\/reels\//i.test(url) ? "9 / 16" : "16 / 9" };
  return null;
}
// Instagram's embed page reports its real height by postMessage; follow it so the video keeps its own shape.
function VideoEmbed({ em }) {
  const [h, setH] = useState(em.kind === "ig" ? 620 : null);
  useEffect(() => {
    if (em.kind !== "ig") return;
    const on = (e) => {
      if (!/instagram\.com$/i.test(new URL(e.origin).hostname)) return;
      try { const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; const ht = d?.details?.height ?? d?.height; if (d?.type === "MEASURE" && ht > 100) setH(Math.min(1100, Math.round(ht))); } catch {}
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [em.kind]);
  const style = em.kind === "ig" ? { height: h } : { aspectRatio: em.ratio, maxHeight: "75vh", margin: "0 auto" };
  return <div className="rounded-xl overflow-hidden bg-black w-full" style={style}><iframe title="video" src={em.src} className="w-full h-full block" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" /></div>;
}
const videoLabel = (u) => /instagram/i.test(u) ? "Instagram" : /youtu/i.test(u) ? "YouTube" : "Facebook";

// Same rule as the Deals screen: live discount from the product's own active promotion.
export function livePrice(product) {
  const old = Number(product?.price) || 0;
  const promo = product?.promotion;
  if (!isPromotionActive(promo) || !["discount", "flash"].includes(promo.type)) return { old, now: old, pct: 0 };
  const pct = Number(promo.discount) || 0;
  const now = pct > 0 ? +(old * (1 - pct / 100)).toFixed(2) : promo.newPrice != null ? Number(promo.newPrice) : old;
  return { old, now, pct: pct > 0 ? pct : now < old ? Math.round((1 - now / old) * 100) : 0 };
}

function Comments({ post, me, isShopOwner, feedPro, onCount }) {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("feed_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    if (error) setErr("Comments load nahi hue: " + error.message); else { setRows(data || []); onCount?.((data || []).length); }
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    const t = text.trim(); if (!t || !me) return;
    setErr("");
    const { error } = await supabase.from("feed_comments").insert({ post_id: post.id, text: t, parent_id: replyTo || null });
    if (error) { setErr(error.message.includes("Feed Pro") ? "Reply ke liye Feed Pro membership chahiye." : error.message); return; }
    setText(""); setReplyTo(null); await load();
  };
  const del = async (id) => { await supabase.from("feed_comments").delete().eq("id", id); await load(); };
  const top = (rows || []).filter((c) => !c.parent_id);
  const Row = ({ c, reply }) => (
    <div className={`${reply ? "ml-6 mt-1 bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"} border rounded-xl px-3 py-2`}>
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="font-bold text-gray-800">{c.is_shop_reply ? `🏪 ${post.shopName} (dukaan)` : c.author_name || "User"}</span>
        <span className="text-gray-400">{timeAgo(new Date(c.created_at).getTime())}</span>
      </div>
      <div className="text-sm text-gray-700 break-words">{c.text}</div>
      <div className="flex gap-3 mt-1 text-[11px] font-semibold">
        {isShopOwner && !reply && <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-emerald-700">{feedPro ? "↩ Reply" : "🔒 Reply"}</button>}
        {(c.user_id === me || isShopOwner) && <button onClick={() => del(c.id)} className="text-red-500">Delete</button>}
      </div>
      {replyTo === c.id && !feedPro && <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">Customer ke comment ka reply dene ke liye Feed Pro (₹{FEED_PRO_PRICE}/mahina) chahiye.</div>}
    </div>
  );
  return (
    <div className="mt-3 space-y-2">
      {rows === null && !err && <div className="text-xs text-gray-400">Loading…</div>}
      {top.map((c) => <div key={c.id}><Row c={c} />{(rows || []).filter((r) => r.parent_id === c.id).map((r) => <Row key={r.id} c={r} reply />)}</div>)}
      {rows && !top.length && <div className="text-xs text-gray-400">Abhi koi comment nahi. Pehla comment aap karein.</div>}
      {err && <div className="text-[11px] text-red-600">{err}</div>}
      {me ? (!replyTo || feedPro) && <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={replyTo ? "Reply likhiye…" : "Comment likhiye…"} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
        <button onClick={send} disabled={!text.trim()} className="bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold px-4 rounded-xl">Bhejo</button>
      </div> : <div className="text-xs text-gray-400">Comment ke liye login karein.</div>}
    </div>
  );
}

function PostCard({ post, shop, me, isMine, followed, followers, liked, canReplyOwner, feedPro, onFollow, onLike, onDelete, onOpenShop }) {
  const [open, setOpen] = useState(false);
  const [cc, setCc] = useState(post.comments);
  useEffect(() => setCc(post.comments), [post.comments]);
  const product = post.productId ? shop?.products?.find((p) => p.id === post.productId && !p.archived_at) : null;
  const lp = product ? livePrice(product) : null;
  const img = post.videoUrl ? null : post.imageUrl || product?.imageUrl;
  const hidePrice = shop?.hideProductPrices;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="min-w-0">
          <button onClick={() => shop && onOpenShop?.(shop)} className="font-bold text-sm text-gray-800 truncate text-left">{post.shopName}</button>
          <div className="text-[10px] text-gray-400">{timeAgo(post.time)}{followers != null && ` · ${followers} followers`}</div>
        </div>
        {isMine ? <button onClick={() => onDelete(post.id)} className="text-[11px] text-red-500 font-semibold">Delete</button>
          : shop && me && <button onClick={() => onFollow(shop.id, followed)} className={`text-xs font-bold px-3 py-1.5 rounded-full ${followed ? "bg-gray-100 text-gray-600" : "bg-emerald-600 text-white"}`}>{followed ? "Following ✓" : "+ Follow"}</button>}
      </div>
      {img && <img src={img} alt="" loading="lazy" className="w-full h-auto block mt-3" />}
      {post.text && <div className="px-4 mt-3 text-sm text-gray-700 whitespace-pre-wrap break-words">{post.text}</div>}
      {product && lp && (
        <button onClick={() => onOpenShop?.(shop, product)} className="mx-4 mt-3 w-[calc(100%-2rem)] text-left flex items-center justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{product.name}</div>
            {lp.pct > 0 && <span className="inline-block mt-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{lp.pct}% OFF</span>}
          </div>
          <div className="text-right shrink-0">
            {hidePrice ? <div className="text-xs font-bold text-gray-600">Contact for price</div> : <>
              {lp.now < lp.old && <div className="text-[10px] text-gray-400 line-through">{formatINR(lp.old)}</div>}
              <div className="font-extrabold text-emerald-600">{formatINR(lp.now)}</div></>}
            <div className="text-[10px] font-bold text-orange-600">Product dekho ›</div>
          </div>
        </button>
      )}
      {post.productId && !product && <div className="mx-4 mt-3 text-[11px] text-gray-400">Ye product ab available nahi hai.</div>}
      {post.videoUrl && (() => { const em = embedOf(post.videoUrl); return <div className="mx-4 mt-3">
        {em && <VideoEmbed em={em} />}
        <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] text-violet-600 font-semibold mt-1">{em ? `Video nahi chal rahi? ${videoLabel(post.videoUrl)} par kholein ↗` : `▶ ${videoLabel(post.videoUrl)} par video dekho`}</a>
      </div>; })()}
      <div className="flex items-center gap-5 px-4 py-3 text-sm">
        <button onClick={() => onLike(post.id, liked)} className={`font-semibold ${liked ? "text-red-500" : "text-gray-500"}`}>{liked ? "❤️" : "🤍"} {post.likes}</button>
        <button onClick={() => setOpen((v) => !v)} className="font-semibold text-gray-500">💬 {cc}</button>
      </div>
      {open && <div className="px-4 pb-4 -mt-1"><Comments post={post} me={me} isShopOwner={canReplyOwner} feedPro={feedPro} onCount={setCc} /></div>}
    </div>
  );
}

function Composer({ ownedShops, feedPro, followerCount, onDone, onClose, onPromote }) {
  const [shopId, setShopId] = useState(ownedShops[0]?.id);
  const shop = ownedShops.find((s) => s.id === shopId) || ownedShops[0];
  const [text, setText] = useState("");
  const [productId, setProductId] = useState("");
  const [video, setVideo] = useState("");
  const [file, setFile] = useState(null);
  const [media, setMedia] = useState("photo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [mode, setMode] = useState("one");
  const [picked, setPicked] = useState(() => new Set());
  const products = (shop?.products || []).filter((p) => !p.archived_at);
  const submit = async () => {
    setErr("");
    const v = media === "video" ? video.trim() : "";
    const picked = media === "photo" ? file : null;
    if (v && !VIDEO_OK.test(v)) return setErr("Video link sirf Instagram / YouTube / Facebook (https) ka ho sakta hai.");
    if (!text.trim() && !picked && !productId && !v) return setErr("Kuch to likhiye ya photo / product chuniye.");
    setBusy(true);
    let imageUrl = null;
    if (picked) { imageUrl = await uploadProductImage(shop.id, picked); if (!imageUrl) { setBusy(false); return setErr("Photo upload nahi hui. Dobara try karein."); } }
    const chosenProduct = products.find((p) => p.id === productId);
    const targets = mode === "all" ? ownedShops : mode === "pick" ? ownedShops.filter((x) => picked.has(x.id)) : [shop];
    if (!targets.length) { setBusy(false); return setErr("Kam se kam ek dukaan chuniye."); }
    const rows = targets.map((sh) => {
      // same product in another shop = match by name; if that shop doesn't stock it the post goes without product card
      const pid = sh.id === shop.id ? productId || null : (chosenProduct && (sh.products || []).find((p) => !p.archived_at && String(p.name).trim().toLowerCase() === String(chosenProduct.name).trim().toLowerCase())?.id) || null;
      return { shop_id: sh.id, text: text.trim(), v2: true, image_url: imageUrl, video_url: v || null, product_id: pid };
    });
    const { error } = await supabase.from("feed_posts").insert(rows);
    setBusy(false);
    if (error) return setErr(/v2|column|image_url/i.test(error.message) ? "Database update baaki hai (SQL migration 20261113 chalayein)." : error.message);
    onDone();
  };
  // Offer from inside a post = Deals AND Feed. (Offer lagaya directly from Promotion panel = Deals only.)
  const promoteAndPost = async (x) => {
    const ok = await onPromote({ ...x, productId });
    if (ok) await submit();
    return ok;
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3"><div className="font-bold">Naya Post</div><button onClick={onClose} className="text-xl leading-none">×</button></div>
        {ownedShops.length > 1 && <select value={shopId} onChange={(e) => { setShopId(e.target.value); setProductId(""); }} className="w-full border rounded-xl px-3 py-2.5 text-sm mb-2">{ownedShops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="Customers ko kya batana hai?" className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none" />
        <div className="flex gap-2 mt-3">
          {[["photo", "📷 Photo"], ["video", "▶ Video link"]].map(([k, l]) => <button type="button" key={k} onClick={() => setMedia(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${media === k ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Ek post me ya photo ya video, dono nahi (Instagram jaisa).</div>
        {media === "photo"
          ? <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm mt-2" />
          : <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Instagram / YouTube / Facebook link https://…" className="w-full border rounded-xl px-3 py-2.5 text-sm mt-2" />}
        <label className="block mt-2 text-xs text-gray-500">🏷️ Product jodein (price aur discount apne aap live dikhega)
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border rounded-xl px-3 py-2.5 text-sm mt-1"><option value="">— koi product nahi —</option>{products.map((p) => { const l = livePrice(p); return <option key={p.id} value={p.id}>{p.name} · {formatINR(l.now)}{l.pct ? ` (${l.pct}% off)` : ""}</option>; })}</select></label>
        {productId && onPromote && <div className="mt-3">
          <button type="button" onClick={() => setShowPromo((v) => !v)} className="w-full text-left text-sm font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">{showPromo ? "▾" : "▸"} 🚀 Is product par offer / promotion lagao (optional)</button>
          {showPromo && <div className="mt-2"><PromotionPanel productOnly shops={[shop]} onPromote={promoteAndPost} initialProductId={productId} /><div className="text-[10px] text-gray-400 mt-1">Offer lagate hi ye post Feed me bhi chala jayega aur Deals me bhi dikhega.</div></div>}
        </div>}
        {ownedShops.length > 1 && <ShopPicker allowOne shops={ownedShops} mode={mode} setMode={setMode} picked={picked} setPicked={setPicked} />}
        <div className={`mt-3 text-[11px] rounded-xl p-2.5 ${feedPro ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {feedPro ? "✅ Feed Pro active: ye post nearby sabhi users ko dikhega, aur aap comments ka reply kar sakte hain."
            : `Abhi ye post sirf aapke ${followerCount} followers ko dikhega. Sabko dikhane aur reply dene ke liye Feed Pro (₹${FEED_PRO_PRICE}/mahina) lein. Payment ke baad admin activate karta hai.`}
        </div>
        {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
        <button onClick={submit} disabled={busy} className="w-full mt-3 bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">{busy ? "Post ho raha hai…" : "Post karo"}</button>
      </div>
    </div>
  );
}

export function FeedTab({ user, shops = [], ownedShops = [], onOpenShop, onPromote, embedded = false, onSeeAll }) {
  const me = user?.id || null;
  const feedPro = useFeedPro(me).active;
  const [posts, setPosts] = useState(null);
  const [likedSet, setLikedSet] = useState(new Set());
  const [follows, setFollows] = useState(new Set());
  const [counts, setCounts] = useState({});
  const [tab, setTab] = useState("all");
  const [composing, setComposing] = useState(false);
  const [err, setErr] = useState("");
  const [limit, setLimit] = useState(5);
  const shopsById = useMemo(() => Object.fromEntries(shops.map((s) => [s.id, s])), [shops]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) { setErr("Feed load nahi hua: " + error.message); setPosts([]); return; }
    setPosts(data || []);
    const ids = (data || []).map((p) => p.id);
    const [lk, fl, ct] = await Promise.all([
      me && ids.length ? supabase.from("feed_likes").select("post_id").eq("user_id", me).in("post_id", ids) : { data: [] },
      me ? supabase.from("feed_follows").select("shop_id").eq("user_id", me) : { data: [] },
      supabase.rpc("shop_follower_counts"),
    ]);
    setLikedSet(new Set((lk.data || []).map((x) => x.post_id)));
    setFollows(new Set((fl.data || []).map((x) => x.shop_id)));
    setCounts(Object.fromEntries((ct.data || []).map((x) => [x.shop_id, Number(x.followers)])));
  }, [me]);
  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (shopId, was) => {
    setFollows((s) => { const n = new Set(s); was ? n.delete(shopId) : n.add(shopId); return n; });
    setCounts((c) => ({ ...c, [shopId]: Math.max(0, (c[shopId] || 0) + (was ? -1 : 1)) }));
    const { error } = was ? await supabase.from("feed_follows").delete().eq("user_id", me).eq("shop_id", shopId) : await supabase.from("feed_follows").insert({ user_id: me, shop_id: shopId });
    if (error) load();
  };
  const toggleLike = async (id, was) => {
    setLikedSet((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: Math.max(0, (p.likes || 0) + (was ? -1 : 1)) } : p)));
    const { error } = was ? await supabase.from("feed_likes").delete().eq("user_id", me).eq("post_id", id) : await supabase.from("feed_likes").insert({ user_id: me, post_id: id });
    if (error) load();
  };
  const del = async (id) => { if (!window.confirm("Ye post delete karein?")) return; await supabase.from("feed_posts").delete().eq("id", id); load(); };

  const myShopIds = new Set(ownedShops.map((s) => s.id));
  const visible = (posts || []).filter((p) => tab === "all" || (p.shop_id && (follows.has(p.shop_id) || myShopIds.has(p.shop_id))));
  const myFollowers = ownedShops.reduce((n, s) => n + (counts[s.id] || 0), 0);

  return (
    <div className={embedded ? "" : "pb-24"}>
      {embedded ? (
        <div className="px-5 mt-4 flex items-center justify-between">
          <div className="font-extrabold text-sm">📣 Feed</div>
          <div className="flex items-center gap-2">
            {[["all", "Sab"], ["following", "Following"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1 rounded-full text-[11px] font-bold ${tab === k ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}
            {ownedShops.length > 0 && <button onClick={() => setComposing(true)} className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[11px] font-bold">+ Post</button>}
          </div>
        </div>
      ) : (
      <div className="bg-gradient-to-br from-teal-500 to-emerald-600 px-5 pt-6 pb-5 rounded-b-3xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold">📣 Feed</div>
            <div className="text-white/80 text-sm mt-1">Dukaano ke posts, offers aur naya maal</div>
          </div>
          {ownedShops.length > 0 && <button onClick={() => setComposing(true)} className="bg-white/20 px-4 h-10 rounded-full text-sm font-bold">+ Post</button>}
        </div>
        <div className="flex gap-2 mt-4">
          {[["all", "Sab"], ["following", "Following"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-xs font-bold ${tab === k ? "bg-white text-emerald-700" : "bg-white/20 text-white"}`}>{l}</button>)}
        </div>
      </div>
      )}
      {ownedShops.length > 0 && !feedPro && (
        <div className="mx-5 mt-4 text-[11px] bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-3">
          Aapke posts abhi sirf <b>{myFollowers} followers</b> ko dikhte hain. <b>Feed Pro ₹{FEED_PRO_PRICE}/mahina</b> lene par post sabko dikhega aur aap comments ka reply kar paoge. Payment ke baad admin se activate karwayein.
        </div>
      )}
      <div className="px-5 mt-4 space-y-3">
        {err && <div className="text-xs bg-red-50 text-red-700 rounded-xl p-3">{err}</div>}
        {posts === null && <div className="text-sm text-gray-400 text-center py-8">Loading…</div>}
        {posts && !visible.length && !err && <div className="text-sm text-gray-400 text-center py-10">{tab === "following" ? "Abhi aap kisi dukaan ko follow nahi karte. 'Sab' me se + Follow dabayein." : "Abhi koi post nahi."}</div>}
        {(embedded ? visible.slice(0, limit) : visible).map((r, idx) => {
          const shop = shopsById[r.shop_id];
          const post = { id: r.id, shopName: shop?.name || "Shop", text: r.text, likes: r.likes || 0, comments: r.comments_count || 0, time: new Date(r.created_at).getTime(), imageUrl: r.image_url, videoUrl: r.video_url, productId: r.product_id };
          const mine = !!r.shop_id && myShopIds.has(r.shop_id);
          return <React.Fragment key={r.id}>{idx % 4 === 3 && <AdSlot placement="feed" seed={idx} />}<PostCard post={post} shop={shop} me={me} isMine={mine} canReplyOwner={mine} feedPro={feedPro}
            followed={follows.has(r.shop_id)} followers={r.shop_id ? counts[r.shop_id] || 0 : null} liked={likedSet.has(r.id)}
            onFollow={toggleFollow} onLike={me ? toggleLike : () => {}} onDelete={del} onOpenShop={onOpenShop} /></React.Fragment>;
        })}
        {embedded && visible.length > limit && <button onClick={() => setLimit((n) => n + 5)} className="w-full text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl py-2.5">Aur posts dekho ({visible.length - limit})</button>}
      </div>
      {composing && <Composer onPromote={onPromote} ownedShops={ownedShops} feedPro={feedPro} followerCount={myFollowers} onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
    </div>
  );
}
