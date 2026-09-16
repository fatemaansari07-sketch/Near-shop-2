import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import VoiceInput from "../../components/VoiceInput";
import { parseProductVoice, parseExpiry } from "../../lib/voiceParser";
import { formatINR, CATEGORIES, AREAS, BARCODE_DB, genId } from "../../data/mockData";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

export function AddShopForm({ onBack, onSubmit, blockCheck, existingShopCount = 0 }) {
  const isPaid = existingShopCount >= 1;
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], area: "", address: "", phone: "", city: "", state: "", country: "" });
  const [coords, setCoords] = useState(null); // { lat, lng } — captured via GPS, sent through on submit
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocateMsg("GPS is device pe available nahi hai — address khud type kariye."); return; }
    setLocating(true);
    setLocateMsg("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setCoords({ lat, lng });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const auto = data?.display_name || "";
          const a = data?.address || {};
          const areaGuess = a.suburb || a.neighbourhood || a.city_district || a.town || a.village || "";
          const cityGuess = a.city || a.town || a.municipality || a.county || "";
          const stateGuess = a.state || "";
          const countryGuess = a.country || "";
          setForm((f) => ({
            ...f, address: auto, area: areaGuess || f.area,
            city: cityGuess || f.city, state: stateGuess || f.state, country: countryGuess || f.country,
          }));
          setLocateMsg("Address bhar diya — gali no./room no./landmark add karke sahi kar lijiye. Agar address adhoora lage, phone ki Location setting me 'High Accuracy' mode on karke dobara try kariye.");
        } catch {
          setLocateMsg("Location mil gayi, lekin address text nahi nikal paya — khud type kar dijiye.");
        }
        setLocating(false);
      },
      () => { setLocateMsg("Location permission nahi mili — address khud type kariye."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async () => {
    if (!form.name || !form.address || !form.area || form.phone.length !== 10) { setError("Sab fields sahi se bhariye"); return; }
    const blocked = blockCheck(form.phone, form.address);
    if (blocked) { setError("Yeh number ya address admin dwara block kiya gaya hai. Naya shop add nahi ho sakta."); return; }
    if (isPaid && !confirm("₹4999 ka payment karke ye dukaan add karein? (Mock payment)")) return;
    setSaving(true);
    await onSubmit({ ...form, coords });
    setSaving(false);
    if (isPaid) alert("₹4999 paid (mock). Dukaan add ho gayi!");
  };

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold">Add Your Shop</div>
        <div className="text-white/80 text-sm mt-1">{isPaid ? "2nd+ dukaan ke liye ek baar ki fee lagti hai" : "Shop turant live ho jaayegi, koi approval wait nahi"}</div>
      </div>
      <div className="px-5 mt-4 space-y-3">
        {isPaid && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="font-bold text-sm text-amber-800">Ye aapki {existingShopCount + 1}vi dukaan hai</div>
            <div className="text-xs text-amber-700 mt-1">Pehli dukaan free hai. Isse aage har dukaan ke liye ₹4999 ek-baar ki fee lagti hai.</div>
          </div>
        )}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop ka naam" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none bg-white" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none bg-white">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <button
          type="button" disabled={locating} onClick={useMyLocation}
          className="w-full flex items-center justify-center gap-2 bg-emerald-50 disabled:opacity-60 text-emerald-700 font-semibold py-3 rounded-xl text-sm"
        >
          <Navigation size={15} /> {locating ? "Location le rahe hain..." : "📍 Use My Current Location"}
        </button>
        {locateMsg && <div className="text-xs text-gray-500">{locateMsg}</div>}

        <div>
          <label className="text-xs text-gray-500 font-medium">Area / Mohalla</label>
          <input
            value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder="e.g. Rasulabad, Bhatar Road" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none bg-white mt-1"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium">Poora address</label>
          <textarea
            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Gali no., room/dukan no., landmark — sab yaha add/edit kar sakte hain"
            rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none bg-white mt-1"
          />
        </div>

        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Shop contact number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none bg-white" />
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button disabled={saving} onClick={submit} className="w-full bg-violet-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl">
          {saving ? "Adding..." : isPaid ? "Pay ₹4999 & Add Shop" : "Add Shop — Go Live Instantly"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: components/BarcodeScanModal.jsx
============================================================================ */

export function BarcodeScanModal({ onClose, onDetected, subtitle }) {
  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errMsg, setErrMsg] = useState("");
  const regionId = useRef(`scan-region-${Math.random().toString(36).slice(2)}`).current;
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);

  const safeStop = async () => {
    if (stoppedRef.current || !scannerRef.current) return;
    stoppedRef.current = true;
    try { await scannerRef.current.stop(); } catch {}
    try { await scannerRef.current.clear(); } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            await safeStop();
            const known = BARCODE_DB.find((b) => b.code === decodedText);
            onDetected(known || { code: decodedText, name: "", suggestedPrice: "" });
          },
          () => {},
        );
        if (!cancelled) setStatus("scanning");
      } catch (err) {
        if (!cancelled) { setStatus("error"); setErrMsg("Camera access nahi mila — permission diya hai ya check kariye, ya neeche se number khud daaliye."); }
      }
    })();
    return () => {
      cancelled = true;
      safeStop();
    };
  }, []);

  const manualEntry = async () => {
    const code = prompt("Barcode number daaliye:");
    if (!code) return;
    await safeStop();
    const known = BARCODE_DB.find((b) => b.code === code);
    onDetected(known || { code, name: "", suggestedPrice: "" });
  };

  const handleClose = async () => {
    await safeStop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6">
      <div className="w-72 h-72 rounded-2xl overflow-hidden relative bg-black">
        <div id={regionId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">Camera khul rahi hai...</div>
        )}
      </div>
      <div className="text-white mt-4 text-sm text-center">{subtitle || "Barcode ko frame ke andar rakhiye..."}</div>
      {status === "error" && <div className="text-red-300 text-xs mt-2 text-center max-w-xs">{errMsg}</div>}
      <button onClick={manualEntry} className="mt-4 text-white/70 text-xs underline">Barcode number khud type karo</button>
      <button onClick={handleClose} className="mt-3 bg-white/20 text-white px-6 py-2 rounded-full text-sm">Cancel</button>
    </div>
  );
}

/* ============================================================================
   FILE: screens/MyShopDashboard.jsx
============================================================================ */

