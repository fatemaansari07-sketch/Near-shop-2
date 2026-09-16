import React, { useState } from "react";
import VoiceInput from "../../components/VoiceInput";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function FeedTab({ posts, onLike, onCreatePost }) {
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-teal-500 to-emerald-600 px-5 pt-6 pb-6 rounded-b-3xl text-white flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold flex items-center gap-2"><Megaphone size={22} /> Neighbourhood Feed</div>
          <div className="text-white/80 text-sm mt-1">Updates from shops around you</div>
        </div>
        <button onClick={() => setComposing(true)} className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center"><Plus size={18} /></button>
      </div>
      <div className="px-5 mt-4 space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-sm text-gray-800">{p.shopName}</div>
              <div className="text-[10px] text-gray-400">{timeAgo(p.time)}</div>
            </div>
            <div className="text-sm text-gray-600 mt-2">{p.text}</div>
            <button onClick={() => onLike(p.id)} className="mt-3 text-xs text-emerald-600 font-semibold">❤️ {p.likes} likes</button>
          </div>
        ))}
      </div>

      {composing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold">New Post</div>
              <button onClick={() => setComposing(false)}><X size={18} /></button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Apne customers ko kya batana hai?" className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none" />
            <div className="text-xs text-gray-400 mt-2">Posting costs ₹10 (mock payment)</div>
            <button
              onClick={() => { if (text.trim()) { onCreatePost(text); setText(""); setComposing(false); } }}
              className="w-full mt-3 bg-emerald-600 text-white font-semibold py-3 rounded-xl"
            >
              Pay ₹10 &amp; Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/BidTab.jsx
============================================================================ */

