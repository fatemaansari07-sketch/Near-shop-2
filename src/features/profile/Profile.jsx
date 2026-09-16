import React from "react";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function ProfileTab({ user, onCheckIn, onOpenLeaderboard, onOpenAddShop, onOpenMyShop, onLogout }) {
  const alreadyCheckedInToday = user.lastCheckIn && new Date(user.lastCheckIn).toDateString() === new Date().toDateString();
  const redeemCap = Math.floor(user.points * 0.2);
  const hasShop = user.myShopIds && user.myShopIds.length > 0;

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-8 pb-8 rounded-b-3xl text-white text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{user.name[0]}</div>
        <div className="font-bold text-lg mt-2">{user.name}</div>
        <div className="text-white/80 text-xs">+91 {user.phone}</div>
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

