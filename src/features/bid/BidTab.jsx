import React, { useState, useRef, useEffect } from "react";
import { AREAS, CATEGORIES, formatINR, timeAgo } from "../../data/mockData";
import { waLink } from "../khata/khataApi";
import { markCustSeen, useCustSeen } from "./bidUtils";
import { Gavel, Phone, MessageCircle, Store, Check, ChevronRight } from "lucide-react";

const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 outline-none";
const chip = { open: "bg-blue-100 text-blue-600", accepted: "bg-emerald-100 text-emerald-600", closed: "bg-gray-100 text-gray-500" };
const chipText = { open: "🟢 open", accepted: "✅ accepted", closed: "band" };

export function BidTab({ bids, user, onCreateBid, onAcceptOffer, onCloseBid, onUseOffer }) {
  const [item, setItem] = useState("");
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState(AREAS[0]);
  const [category, setCategory] = useState("Electronics");
  const [openIds, setOpenIds] = useState({});
  const seen = useCustSeen();
  const initSeen = useRef(null);
  if (initSeen.current === null) initSeen.current = seen; // "NEW" highlight isi ke hisaab se
  const mine = bids.filter((b) => b.customerId === user?.id);

  useEffect(() => { mine.forEach((b) => markCustSeen(b.id, b.offers.length)); }, [bids]); // eslint-disable-line

  const newCount = (b) => Math.max(0, b.offers.length - (initSeen.current[b.id] || 0));
  const isOpen = (b) => openIds[b.id] ?? (newCount(b) > 0 || b.status === "accepted");
  const toggle = (b) => setOpenIds((x) => ({ ...x, [b.id]: !isOpen(b) }));

  const offerMsg = (b, o) => `Namaste, NearShop pe aapka offer dekha: "${b.item}" ke liye ${formatINR(o.price)}. Kya abhi available hai?`;

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <div className="text-2xl font-extrabold flex items-center gap-2"><Gavel size={22} /> Live Bidding</div>
        <div className="text-white/80 text-sm mt-1">Bataiye kya chahiye, shops offer denge</div>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-bold text-sm text-gray-800 mb-2">Naya request banaiye</div>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Kya chahiye? (e.g. bluetooth speaker)" className={input} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input + " bg-white"}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="Budget (₹)" className={input} />
          <select value={area} onChange={(e) => setArea(e.target.value)} className={input + " bg-white"}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <button onClick={() => { if (item.trim() && budget) { onCreateBid(item, Number(budget), area, category); setItem(""); setBudget(""); } }} className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl text-sm">Post Request</button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        {mine.length === 0 && <div className="text-center text-gray-400 text-sm mt-8">Aapne abhi koi request nahi daali.</div>}
        {mine.map((b) => {
          const open = isOpen(b), nc = newCount(b);
          const sorted = [...b.offers].sort((x, y) => x.price - y.price);
          const chosen = b.offers.find((o) => o.shopId === b.acceptedShopId);
          return (
            <div key={b.id} className={`bg-white rounded-2xl border ${nc > 0 ? "border-indigo-300" : "border-gray-100"}`}>
              <button onClick={() => toggle(b)} className="w-full text-left p-4 flex justify-between items-start">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-800">{b.item}</div>
                  <div className="text-xs text-gray-400">Budget {formatINR(b.budget)} · {b.area} · {timeAgo(b.createdAt)}</div>
                  <div className="mt-1.5 text-[11px] font-bold">{b.offers.length > 0 ? <span className={nc > 0 ? "text-indigo-600" : "text-gray-500"}>🔔 {b.offers.length} dukaan interested{nc > 0 ? ` · ${nc} NEW` : ""}</span> : <span className="text-gray-400">⏳ Abhi kisi dukaan ka offer nahi aaya</span>}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${chip[b.status] || chip.closed}`}>{chipText[b.status] || b.status}</span><ChevronRight size={14} className={`text-gray-300 transition-transform ${open ? "rotate-90" : ""}`} /></div>
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-2">
                  {b.status === "accepted" && chosen && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="text-xs font-bold text-emerald-700">✅ Aapne ye offer chuna</div>
                      <div className="font-bold text-sm mt-1">{chosen.shopName} — {formatINR(chosen.price)}</div>
                      <div className="flex gap-2 mt-2">
                        {chosen.shopPhone && <a href={`tel:${chosen.shopPhone}`} className="flex-1 text-center bg-white border rounded-lg py-2 text-xs font-bold text-gray-700"><Phone size={12} className="inline mr-1" />Call</a>}
                        {chosen.shopPhone && <a href={waLink(chosen.shopPhone, offerMsg(b, chosen))} target="_blank" rel="noreferrer" className="flex-1 text-center bg-emerald-600 text-white rounded-lg py-2 text-xs font-bold"><MessageCircle size={12} className="inline mr-1" />WhatsApp</a>}
                        <button onClick={() => onUseOffer?.(chosen)} className="flex-1 bg-white border rounded-lg py-2 text-xs font-bold text-gray-700"><Store size={12} className="inline mr-1" />Dukaan</button>
                      </div>
                    </div>
                  )}
                  {b.status === "open" && sorted.map((o, i) => {
                    const diff = b.budget - o.price;
                    return (
                      <div key={o.id || i} className={`rounded-xl p-3 ${i === 0 && sorted.length > 1 ? "bg-emerald-50 border border-emerald-200" : "bg-indigo-50"}`}>
                        <div className="flex justify-between items-start">
                          <div className="min-w-0"><div className="font-bold text-sm text-gray-800">{o.shopName}{i === 0 && sorted.length > 1 ? " 🏆" : ""}</div><div className="text-[11px] text-gray-500">{[o.shopArea, o.message, o.createdAt ? timeAgo(o.createdAt) : null].filter(Boolean).join(" · ")}</div></div>
                          <div className="text-right"><div className="font-extrabold text-indigo-700">{formatINR(o.price)}</div><div className={`text-[10px] font-bold ${diff >= 0 ? "text-emerald-600" : "text-orange-500"}`}>{diff >= 0 ? (diff > 0 ? `Budget se ${formatINR(diff)} kam` : "Budget me") : `Budget se ${formatINR(-diff)} zyada`}</div></div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {o.shopPhone && <a href={`tel:${o.shopPhone}`} className="bg-white border rounded-lg px-3 py-2 text-xs font-bold text-gray-700"><Phone size={12} /></a>}
                          {o.shopPhone && <a href={waLink(o.shopPhone, offerMsg(b, o))} target="_blank" rel="noreferrer" className="bg-white border border-emerald-300 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700"><MessageCircle size={12} /></a>}
                          <button onClick={() => onUseOffer?.(o)} className="bg-white border rounded-lg px-3 py-2 text-xs font-bold text-gray-700"><Store size={12} className="inline mr-1" />Dukaan</button>
                          <button onClick={() => { if (window.confirm(`${o.shopName} ka ${formatINR(o.price)} wala offer chunna hai?`)) onAcceptOffer?.(b.id, o.shopId); }} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-xs font-bold"><Check size={12} className="inline mr-1" />Ye offer lo</button>
                        </div>
                      </div>
                    );
                  })}
                  {b.status === "open" && b.offers.length === 0 && <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">Jaise hi koi dukaan interested hogi, yahin uska naam aur price dikhega aur 🔔 aayega.</div>}
                  {b.status === "open" && <button onClick={() => { if (window.confirm("Ye request band kar dein?")) onCloseBid?.(b.id); }} className="text-[11px] text-gray-400 underline">Request band karo</button>}
                  {b.status === "closed" && <div className="text-xs text-gray-400">Ye request band hai.</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
