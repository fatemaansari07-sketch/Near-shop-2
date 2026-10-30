import React, { useMemo } from "react";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function ProfileTab({ user, onCheckIn, onOpenLeaderboard, onOpenAddShop, onOpenMyShop, onOpenKhata, khataPending = 0, onOpenLegal, onSavePhone, onLogout }) {
  const alreadyCheckedInToday = user.lastCheckIn && new Date(user.lastCheckIn).toDateString() === new Date().toDateString();
  const redeemCap = Math.floor(user.points * 0.2);
  const hasShop = user.myShopIds && user.myShopIds.length > 0;

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-8 pb-8 rounded-b-3xl text-white text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{user.name[0]}</div>
        <div className="font-bold text-lg mt-2">{user.name}</div>
        <div className="text-white/80 text-xs">{user.phone ? `+91 ${user.phone}` : user.email}</div>
      </div>

      <div className="px-5 -mt-5 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">Points Balance</div>
          <div className="text-xl font-extrabold text-violet-600">{user.points}</div>
          <div className="text-[10px] text-gray-400 mt-1">Max redeemable: {redeemCap} pts (20% cap)</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">Check-in Streak</div>
          <div className="text-xl font-extrabold text-orange-500 flex items-center gap-1">{user.streak} <Flame size={16} /></div>
          <button
            disabled={alreadyCheckedInToday} onClick={onCheckIn}
            className={`text-[10px] font-semibold mt-1 px-2 py-1 rounded-full ${alreadyCheckedInToday ? "bg-gray-100 text-gray-400" : "bg-orange-100 text-orange-600"}`}
          >
            {alreadyCheckedInToday ? "Checked in ✓" : "Check in today (+10 pts)"}
          </button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        <button onClick={hasShop ? onOpenMyShop : onOpenAddShop} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100">
          <div className="flex items-center gap-3"><Store size={18} className="text-violet-600" /><span className="font-semibold text-sm">{hasShop ? "My Shop" : "Add Your Shop"}</span></div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <button onClick={onOpenKhata} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100">
          <div className="flex items-center gap-3"><span className="text-lg leading-none">📒</span><span className="font-semibold text-sm">Udhar Khata</span>{khataPending > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{khataPending} new</span>}</div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <button onClick={onOpenLeaderboard} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100">
          <div className="flex items-center gap-3"><Trophy size={18} className="text-amber-500" /><span className="font-semibold text-sm">Leaderboard</span></div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <div className="w-full bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-2"><Gift size={18} className="text-pink-500" /><span className="font-semibold text-sm">Refer &amp; Earn</span></div>
          <div className="text-xs text-gray-400">Share your code, dono ko 50 points milenge</div>
          <div className="flex items-center justify-between mt-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="font-mono text-sm font-bold text-violet-600">{user.referralCode}</span>
            <Share2 size={16} className="text-gray-400" />
          </div>
        </div>
        <PhoneCard user={user} onSavePhone={onSavePhone} />
        <div className="flex justify-center gap-4 text-xs text-gray-400 pt-2">
          <button onClick={() => onOpenLegal?.("privacy")} className="underline">Privacy Policy</button>
          <button onClick={() => onOpenLegal?.("terms")} className="underline">Terms</button>
        </div>
        <button onClick={onLogout} className="w-full text-center text-red-400 text-sm font-semibold py-3">Logout</button>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/LeaderboardScreen.jsx
============================================================================ */

export function LeaderboardScreen({ onBack, currentUser }) {
  const board = useMemo(() => {
    const base = [
      { name: "Priya S.", points: 890 }, { name: "Rahul M.", points: 720 },
      { name: "Sneha K.", points: 610 }, { name: currentUser.name, points: currentUser.points },
      { name: "Vikram T.", points: 280 },
    ];
    return base.sort((a, b) => b.points - a.points);
  }, [currentUser]);

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold flex items-center gap-2"><Trophy size={22} /> Leaderboard</div>
      </div>
      <div className="px-5 mt-4 space-y-2">
        {board.map((b, i) => (
          <div key={i} className={`flex items-center justify-between rounded-2xl p-4 ${b.name === currentUser.name ? "bg-violet-100 border border-violet-300" : "bg-white border border-gray-100"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i < 3 ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-500"}`}>{i + 1}</div>
              <span className="font-semibold text-sm">{b.name}</span>
            </div>
            <span className="font-bold text-violet-600 text-sm">{b.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/AddShopForm.jsx
============================================================================ */


function PhoneCard({ user, onSavePhone }) {
  const [edit, setEdit] = React.useState(false);
  const [val, setVal] = React.useState(user.phone || "");
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (!/^\d{10}$/.test(val)) { alert("10 digit ka mobile number daaliye."); return; }
    setBusy(true);
    const ok = await onSavePhone?.(val);
    setBusy(false);
    if (ok) setEdit(false);
  };
  return <div className="bg-white rounded-2xl p-4 border border-gray-100">
    <div className="flex justify-between items-center"><div className="font-semibold text-sm">📱 Mobile / WhatsApp number</div>{!edit && <button onClick={() => setEdit(true)} className="text-xs font-bold text-violet-600">{user.phone ? "Badlo" : "Add karo"}</button>}</div>
    {!edit && <div className="text-xs text-gray-500 mt-1">{user.phone ? `+91 ${user.phone}` : "Optional. Dukaan wale bid ya udhar ke liye aapse WhatsApp/call kar saken."}</div>}
    {edit && <div className="flex gap-2 mt-2"><input value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" className="flex-1 border rounded-xl px-3 py-2 text-sm"/><button disabled={busy} onClick={save} className="bg-violet-600 disabled:opacity-50 text-white px-4 rounded-xl text-sm font-bold">Save</button></div>}
  </div>;
}
