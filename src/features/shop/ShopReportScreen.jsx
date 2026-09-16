import React, { useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { formatINR } from "../../data/mockData";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function ShopReportScreen({ shop, salesLog, onBack, onQuickDiscount }) {
  const [period, setPeriod] = useState("week"); // today | week | month

  const cutoff = useMemo(() => {
    const now = Date.now();
    if (period === "today") return now - 1000 * 60 * 60 * 24;
    if (period === "week") return now - 1000 * 60 * 60 * 24 * 7;
    return now - 1000 * 60 * 60 * 24 * 30;
  }, [period]);

  const shopLogs = salesLog.filter((l) => l.shopId === shop.id && l.timestamp >= cutoff);
  const totalRevenue = shopLogs.reduce((a, l) => a + l.revenue, 0);
  const totalUnits = shopLogs.reduce((a, l) => a + l.qty, 0);

  const productStats = shop.products.map((p) => {
    const sold = shopLogs.filter((l) => l.productName === p.name).reduce((a, l) => a + l.qty, 0);
    const pipeline = sold + (p.stock || 0);
    const soldPct = pipeline > 0 ? Math.round((sold / pipeline) * 100) : 0;
    return { ...p, sold, soldPct };
  }).sort((a, b) => b.sold - a.sold);

  const slowMovers = productStats.filter((p) => p.stock > 2 && p.soldPct < 20);
  const expiringSoon = shop.products
    .map((p) => ({ ...p, daysLeft: daysToExpiry(p.expiryDate) }))
    .filter((p) => p.daysLeft !== null && p.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold flex items-center gap-2"><BarChart3 size={22} /> Shop Report</div>
        <div className="text-white/80 text-sm mt-1">{shop.name}</div>
      </div>

      <div className="px-5 mt-4 flex gap-2">
        {[{ k: "today", l: "Aaj" }, { k: "week", l: "Is Hafte" }, { k: "month", l: "Is Mahine" }].map((p) => (
          <button
            key={p.k} onClick={() => setPeriod(p.k)}
            className={`px-4 py-2 rounded-full text-xs font-semibold ${period === p.k ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}
          >
            {p.l}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-extrabold text-violet-600">{formatINR(totalRevenue)}</div>
          <div className="text-xs text-gray-400">Total Revenue</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-extrabold text-emerald-600">{totalUnits}</div>
          <div className="text-xs text-gray-400">Units Sold</div>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="font-bold text-sm text-red-800 flex items-center gap-2"><Clock size={16} /> Expiring Soon</div>
            <div className="text-xs text-red-700 mt-1 mb-3">In products ki expiry nazdeek hai (ya ho chuki hai) — jaldi bech dena behtar hoga.</div>
            <div className="space-y-2">
              {expiringSoon.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {p.daysLeft < 0 ? `Expire ho chuka hai` : p.daysLeft === 0 ? "Aaj expire ho raha hai" : `${p.daysLeft} din baaki`} · Stock: {p.stock}
                    </div>
                  </div>
                  <button
                    onClick={() => onQuickDiscount(shop.id, p.name)}
                    className="bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap"
                  >
                    Discount lagao
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {slowMovers.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="font-bold text-sm text-amber-800 flex items-center gap-2"><Flame size={16} /> Slow-moving Products</div>
            <div className="text-xs text-amber-700 mt-1 mb-3">In products ki bikri kam hai stock ke comparison me — discount lagakar tezi se bech sakte hain.</div>
            <div className="space-y-2">
              {slowMovers.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">Sirf {p.soldPct}% bika · Stock: {p.stock}</div>
                  </div>
                  <button
                    onClick={() => onQuickDiscount(shop.id, p.name)}
                    className="bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap"
                  >
                    Discount lagao
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-bold text-sm mb-3">Product-wise Report</div>
          {productStats.length === 0 && <div className="text-center text-gray-400 text-sm py-4">Abhi tak koi product nahi hai.</div>}
          <div className="divide-y divide-gray-50">
            {productStats.map((p) => (
              <div key={p.id} className="py-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  <span className="text-sm font-bold text-violet-600">{p.sold} sold</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(p.soldPct, 100)}%` }} />
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{p.soldPct}% sold · Stock bacha: {p.stock}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/SellFlow.jsx  (POS: scan items, auto-bill, live stock update)
============================================================================ */

