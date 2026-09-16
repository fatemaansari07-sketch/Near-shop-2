import React, { useState } from "react";
import VoiceInput from "../../components/VoiceInput";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function BidTab({ bids, onCreateBid, onOwnerOffer, ownerShops }) {
  const [item, setItem] = useState("");
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState(AREAS[0]);
  const [offerInputs, setOfferInputs] = useState({});

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <div className="text-2xl font-extrabold flex items-center gap-2"><Gavel size={22} /> Live Bidding</div>
        <div className="text-white/80 text-sm mt-1">Bataiye kya chahiye, shops offer denge</div>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-bold text-sm text-gray-800 mb-2">Naya request banaiye</div>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Kya chahiye? (e.g. bluetooth speaker)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 outline-none" />
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="Budget (₹)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none" />
          <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none bg-white">
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => { if (item.trim() && budget) { onCreateBid(item, Number(budget), area); setItem(""); setBudget(""); } }}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Post Request
          </button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        {bids.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm text-gray-800">{b.item}</div>
                <div className="text-xs text-gray-400">Budget {formatINR(b.budget)} · {b.area} · {timeAgo(b.createdAt)}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${b.status === "open" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>{b.status}</span>
            </div>

            {b.offers.length > 0 && (
              <div className="mt-3 space-y-2">
                {b.offers.map((o, i) => (
                  <div key={i} className="bg-indigo-50 rounded-lg p-2 flex justify-between items-center text-xs">
                    <span className="font-medium text-indigo-700">{o.shopName}: {formatINR(o.price)} — {o.message}</span>
                  </div>
                ))}
              </div>
            )}

            {ownerShops.length > 0 && (
              <div className="mt-3 flex gap-2">
                <input
                  value={offerInputs[b.id] || ""} onChange={(e) => setOfferInputs({ ...offerInputs, [b.id]: e.target.value.replace(/\D/g, "") })}
                  placeholder="Aapka offer ₹" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none"
                />
                <button
                  onClick={() => { if (offerInputs[b.id]) { onOwnerOffer(b.id, ownerShops[0], Number(offerInputs[b.id])); setOfferInputs({ ...offerInputs, [b.id]: "" }); } }}
                  className="bg-indigo-600 text-white text-xs font-semibold px-3 rounded-lg flex items-center gap-1"
                ><Send size={12} /> Offer</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/ProfileTab.jsx
============================================================================ */

