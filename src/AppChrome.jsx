import React, { useState } from "react";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../shared/icons";

export function LoginScreen({ onLogin, onAdminLogin, blockedPhones, dataLicenses, onViewData }) {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [error, setError] = useState("");
  const [showDataBox, setShowDataBox] = useState(false);
  const [dataCode, setDataCode] = useState("");
  const [dataError, setDataError] = useState("");
  const tapTimer = useRef(null);

  const handleLogoTap = () => {
    setTapCount((c) => {
      const next = c + 1;
      if (next >= 5) {
        setAdminMode(true);
        return 0;
      }
      return next;
    });
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 1200);
  };

  const sendOtp = () => {
    if (phone.length !== 10) { setError("10 digit number daaliye"); return; }
    if (blockedPhones.includes(phone)) { setError("Yeh number admin dwara block kiya gaya hai."); return; }
    setError("");
    setOtpSent(true);
  };

  const verifyOtp = () => {
    if (otp.length !== 4) { setError("4 digit OTP daaliye (demo: 1234)"); return; }
    onLogin(phone);
  };

  const redeemDataCode = () => {
    const lic = dataLicenses.find((l) => l.code.toLowerCase() === dataCode.trim().toLowerCase());
    if (!lic) { setDataError("Yeh code valid nahi hai."); return; }
    if (lic.revoked) { setDataError("Yeh access link admin ne revoke kar diya hai."); return; }
    setDataError("");
    onViewData(lic);
  };

  if (adminMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4 text-indigo-600">
            <ShieldCheck size={22} /> <span className="font-bold text-lg">Admin Login</span>
          </div>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3"
            placeholder="Admin ID" onChange={() => {}}
          />
          <input
            type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            placeholder="Password (demo: admin123)"
          />
          {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
          <button
            onClick={() => (adminPass === "admin123" ? onAdminLogin() : setError("Galat password"))}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold"
          >
            Login as Admin
          </button>
          <button onClick={() => setAdminMode(false)} className="w-full mt-3 text-sm text-gray-400">
            ← Back to customer login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex flex-col justify-center px-6">
      <div className="text-center mb-10 select-none" onClick={handleLogoTap}>
        <div className="text-6xl mb-2">🏪</div>
        <div className="text-white text-3xl font-extrabold tracking-tight">ShopNear</div>
        <div className="text-white/80 text-sm mt-1">Find best prices nearby</div>
      </div>
      <div className="bg-white rounded-3xl p-6 shadow-2xl">
        {!otpSent ? (
          <>
            <label className="text-xs text-gray-500 font-medium">Mobile Number</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 mt-1 mb-4">
              <span className="text-gray-400 mr-2">+91</span>
              <input
                value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 outline-none" placeholder="9876543210"
              />
            </div>
            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
            <button onClick={sendOtp} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold">
              Send OTP
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-gray-500 font-medium">Enter OTP sent to +91 {phone}</label>
            <input
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mt-1 mb-4 tracking-[0.5em] text-center text-lg"
              placeholder="1234"
            />
            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
            <button onClick={verifyOtp} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold">
              Verify &amp; Continue
            </button>
          </>
        )}
      </div>
      <div className="text-center text-white/60 text-xs mt-6">Tap the logo 5x for admin access</div>

      {!showDataBox ? (
        <button onClick={() => setShowDataBox(true)} className="text-center text-white/70 text-xs mt-3 underline">
          🔗 Have an enterprise data access code?
        </button>
      ) : (
        <div className="bg-white/10 rounded-2xl p-4 mt-3">
          <div className="text-white/80 text-xs mb-2">Data access code daaliye — yehi page seedha data view me badal jaayega</div>
          <div className="flex gap-2">
            <input
              value={dataCode} onChange={(e) => setDataCode(e.target.value)}
              placeholder="e.g. SN-AB12CD" className="flex-1 border border-white/30 bg-white/10 text-white placeholder-white/50 rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
            />
            <button onClick={redeemDataCode} className="bg-emerald-500 text-white text-sm font-semibold px-4 rounded-xl">Go</button>
          </div>
          {dataError && <div className="text-red-200 text-xs mt-2">{dataError}</div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   FILE: components/BottomNav.jsx
============================================================================ */

export function BottomNav({ tabs, active, onChange }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 px-2 max-w-md mx-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1 ${active === t.key ? "text-violet-600" : "text-gray-400"}`}
        >
          <t.icon size={20} />
          <span className="text-[10px] font-medium">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   FILE: components/ShopCard.jsx
============================================================================ */

