import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, MapPin, ScanLine, Flame, Megaphone, Trophy, Home as HomeIcon,
  User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp,
  Gavel, Gift, Users as UsersIcon, ShieldCheck, X, ChevronRight, Check,
  Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee,
  BarChart3, PieChart as PieIcon, Package, Clock, Send, Lock,
  Trash2, Printer, Receipt, ShoppingCart, History
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { supabase } from "./supabaseClient";

/* ============================================================================
   FILE: data/mockData.js
   (Split this out first when breaking the app into multiple files)
============================================================================ */

const AREAS = ["Ring Road", "Adajan", "Varachha", "Vesu", "Katargam", "Piplod"];
const CATEGORIES = ["Grocery", "Electronics", "Pharmacy", "Bakery", "Fashion", "Stationery"];

// Mock barcode database — in a real backend this would call an external barcode/product API
const BARCODE_DB = [
  { code: "8901030895556", name: "Amul Milk 1L", suggestedPrice: 66 },
  { code: "8901063052029", name: "Tata Salt 1kg", suggestedPrice: 28 },
  { code: "8901058851862", name: "Aashirvaad Atta 5kg", suggestedPrice: 259 },
  { code: "8904004401234", name: "USB-C Cable", suggestedPrice: 149 },
  { code: "8904004405678", name: "Power Bank 10000mAh", suggestedPrice: 899 },
  { code: "8901030612349", name: "Parle-G Biscuit 200g", suggestedPrice: 20 },
  { code: "8901725123456", name: "Colgate Toothpaste 100g", suggestedPrice: 55 },
  { code: "8902080012345", name: "Maggi Noodles 4-pack", suggestedPrice: 56 },
];

// Sponsored slot shown briefly while search results are "loading" — real
// revenue lever: brands/local shops pay to appear here (₹/day or CPM based).
// In production this list would come from an ads backend, ranked/rotated by
// campaign budget, category match, and area targeting.
const SPONSORED_ADS = [
  { id: "ad1", brand: "Amul", tagline: "Taaza Amul Milk — abhi order karo apne najdiki store se", emoji: "🥛", color: "from-blue-500 to-blue-600" },
  { id: "ad2", brand: "Colgate", tagline: "Colgate Strong Teeth — 20% off is hafte", emoji: "🦷", color: "from-red-500 to-rose-600" },
  { id: "ad3", brand: "Patel Electronics", tagline: "Power banks pe best price — Adajan me abhi available", emoji: "🔋", color: "from-slate-600 to-slate-700" },
  { id: "ad4", brand: "Krishna General Store", tagline: "Fresh vegetables aaj subah aayi — Ring Road", emoji: "🥦", color: "from-emerald-500 to-teal-600" },
];

// Self-serve "Search Ad" pricing — distinct from Flash Deal. Price scales with
// reach: a shop can only target the geography it actually sits in (its own
// area/city/state/country), so wider reach costs more. All run for 24 hours.
const SEARCH_AD_PRICING = { area: 10, city: 25, state: 75, country: 150 };
const SEARCH_AD_LEVEL_LABEL = { area: "Area (najdik mohalla)", city: "Poora City", state: "Poora State", country: "Poora Country" };

const INITIAL_SHOPS = [
  {
    id: "s1", name: "Krishna General Store", owner: "u1", category: "Grocery",
    area: "Ring Road", address: "Ring Road, Surat", phone: "9876543210",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.170, lng: 72.831, rating: 4.5, isBlocked: false, premiumReviews: true,
    products: [
      { id: "p1", name: "Amul Milk 1L", price: 66, history: [
        { date: "Jun 1", price: 62 }, { date: "Jun 10", price: 64 }, { date: "Jun 20", price: 65 }, { date: "Jul 1", price: 66 }
      ], unit: "piece", stock: 40, lastUpdated: Date.now() - 1000 * 60 * 60 * 3 },
      { id: "p2", name: "Tata Salt 1kg", price: 28, history: [
        { date: "Jun 1", price: 26 }, { date: "Jun 15", price: 27 }, { date: "Jul 1", price: 28 }
      ], unit: "piece", stock: 25, lastUpdated: Date.now() - 1000 * 60 * 60 * 5 },
      { id: "p3", name: "Aashirvaad Atta 5kg", price: 259, history: [
        { date: "Jun 1", price: 245 }, { date: "Jun 15", price: 252 }, { date: "Jul 1", price: 259 }
      ], unit: "piece", stock: 15, lastUpdated: Date.now() - 1000 * 60 * 60 * 8 },
      { id: "p8", name: "Toor Dal (loose)", price: 120, history: [
        { date: "Jun 1", price: 110 }, { date: "Jun 20", price: 115 }, { date: "Jul 1", price: 120 }
      ], unit: "weight", stock: 30, lastUpdated: Date.now() - 1000 * 60 * 60 * 2 }, // price is per KG
    ],
    reviews: [
      { id: "r1", user: "Meera", rating: 5, text: "Sabse taaza doodh milta hai yahan!", reply: "Dhanyavaad Meera ji! 🙏" },
      { id: "r2", user: "Ajay", rating: 4, text: "Achi service, thoda bhीड़ hoti hai evening me.", reply: null },
    ],
    flashDeal: null,
  },
  {
    id: "s2", name: "Patel Electronics", owner: "u1", category: "Electronics",
    area: "Adajan", address: "Adajan, Surat", phone: "9876500000",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.183, lng: 72.795, rating: 4.2, isBlocked: false, premiumReviews: false,
    products: [
      { id: "p4", name: "USB-C Cable", price: 149, history: [{ date: "Jun 1", price: 179 }, { date: "Jun 20", price: 159 }, { date: "Jul 1", price: 149 }], unit: "piece", stock: 18, lastUpdated: Date.now() - 1000 * 60 * 60 * 6 },
      { id: "p5", name: "Power Bank 10000mAh", price: 899, history: [{ date: "Jun 1", price: 999 }, { date: "Jul 1", price: 899 }], unit: "piece", stock: 7, lastUpdated: Date.now() - 1000 * 60 * 60 * 20 },
    ],
    reviews: [],
    flashDeal: null,
  },
  {
    id: "s3", name: "Raj Medical Store", owner: "u2", category: "Pharmacy",
    area: "Varachha", address: "Varachha, Surat", phone: "9123456789",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.203, lng: 72.850, rating: 4.7, isBlocked: false, premiumReviews: false,
    products: [
      { id: "p6", name: "Paracetamol 10 tab", price: 22, history: [{ date: "Jun 1", price: 20 }, { date: "Jul 1", price: 22 }], unit: "piece", stock: 60, lastUpdated: Date.now() - 1000 * 60 * 30 },
      { id: "p6b", name: "Azithromycin 500 (3 tab)", price: 85, history: [{ date: "Jun 1", price: 80 }, { date: "Jul 1", price: 85 }], unit: "piece", stock: 20, lastUpdated: Date.now() - 1000 * 60 * 60 },
    ],
    reviews: [],
    flashDeal: { plan: "2hr", expiresAt: Date.now() + 1000 * 60 * 40, item: "Paracetamol 10 tab", discount: "15% off" },
  },
  {
    id: "s4", name: "Sundaram Bakery", owner: "u3", category: "Bakery",
    area: "Vesu", address: "Vesu, Surat", phone: "9988776655",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.140, lng: 72.780, rating: 4.8, isBlocked: false, premiumReviews: false,
    products: [
      { id: "p7", name: "Brown Bread", price: 45, history: [{ date: "Jun 1", price: 40 }, { date: "Jul 1", price: 45 }], unit: "piece", stock: 22, lastUpdated: Date.now() - 1000 * 60 * 60 * 4 },
    ],
    reviews: [],
    flashDeal: null,
  },
  {
    id: "s5", name: "Shree Sai Medical", owner: "u4", category: "Pharmacy",
    area: "Alkapuri", address: "Alkapuri, Vadodara", phone: "9812345670",
    city: "Vadodara", state: "Gujarat", country: "India",
    lat: 22.309, lng: 73.181, rating: 4.4, isBlocked: false, premiumReviews: false,
    products: [
      { id: "p9", name: "Paracetamol 10 tab", price: 20, history: [{ date: "Jun 1", price: 19 }, { date: "Jul 1", price: 20 }], unit: "piece", stock: 45, lastUpdated: Date.now() - 1000 * 60 * 60 * 2 },
      { id: "p10", name: "Azithromycin 500 (3 tab)", price: 82, history: [{ date: "Jun 1", price: 78 }, { date: "Jul 1", price: 82 }], unit: "piece", stock: 10, lastUpdated: Date.now() - 1000 * 60 * 45 },
    ],
    reviews: [],
    flashDeal: null,
  },
  {
    id: "s6", name: "Andheri Care Pharmacy", owner: "u5", category: "Pharmacy",
    area: "Andheri West", address: "Andheri West, Mumbai", phone: "9823456781",
    city: "Mumbai", state: "Maharashtra", country: "India",
    lat: 19.136, lng: 72.827, rating: 4.6, isBlocked: false, premiumReviews: false,
    products: [
      { id: "p11", name: "Paracetamol 10 tab", price: 25, history: [{ date: "Jun 1", price: 24 }, { date: "Jul 1", price: 25 }], unit: "piece", stock: 12, lastUpdated: Date.now() - 1000 * 60 * 20 },
      { id: "p12", name: "Azithromycin 500 (3 tab)", price: 90, history: [{ date: "Jun 1", price: 88 }, { date: "Jul 1", price: 90 }], unit: "piece", stock: 5, lastUpdated: Date.now() - 1000 * 60 * 15 },
    ],
    reviews: [],
    flashDeal: null,
  },

  // ---- Unclaimed listings imported from public Google Maps data ----
  // These give the app day-1 coverage before owners sign up. No products/stock
  // yet since that data isn't public — owner has to claim the listing to add it.
  {
    id: "s7", name: "Dhiraj Sons, The Mega Store", owner: null, isClaimed: false, category: "Grocery",
    area: "Athwa", address: "near Chowpati, Athwa, Surat, Gujarat 395001", phone: "9825600627",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.1853, lng: 72.8092, rating: 4.1, isBlocked: false, premiumReviews: false,
    products: [], reviews: [], flashDeal: null,
  },
  {
    id: "s8", name: "Maheshwar Medical Stores", owner: null, isClaimed: false, category: "Pharmacy",
    area: "Varachha", address: "Varachha Main Rd, near Gurunagar Gate, Surat, Gujarat 395006", phone: "2612568156",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.2126, lng: 72.8571, rating: 4.3, isBlocked: false, premiumReviews: false,
    products: [], reviews: [], flashDeal: null,
  },
  {
    id: "s9", name: "Ravi Medical Stores", owner: null, isClaimed: false, category: "Pharmacy",
    area: "Bhagal", address: "Zampa Bazaar, Navapura, Bhagal, Surat, Gujarat 395003", phone: "9825193193",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.1966, lng: 72.8297, rating: 4.1, isBlocked: false, premiumReviews: false,
    products: [], reviews: [], flashDeal: null,
  },
  {
    id: "s10", name: "Easy Electronics", owner: null, isClaimed: false, category: "Electronics",
    area: "Mughal Sarai", address: "Hemangini Apartment, Mughal Sarai, Surat, Gujarat 395003", phone: "9825703800",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.2017, lng: 72.8214, rating: 4.5, isBlocked: false, premiumReviews: false,
    products: [], reviews: [], flashDeal: null,
  },
  {
    id: "s11", name: "Misri Electronics", owner: null, isClaimed: false, category: "Electronics",
    area: "Singanpor", address: "Fatakdawadi, Industrial Area, Singanpor, Surat, Gujarat 395004", phone: "9265925792",
    city: "Surat", state: "Gujarat", country: "India",
    lat: 21.2145, lng: 72.8222, rating: 5.0, isBlocked: false, premiumReviews: false,
    products: [], reviews: [], flashDeal: null,
  },
];

const INITIAL_BIDS = [
  {
    id: "b1", customer: "You", item: "iPhone charger 20W (original)", budget: 900, area: "Ring Road",
    status: "open", createdAt: Date.now() - 1000 * 60 * 30,
    offers: [{ shopId: "s2", shopName: "Patel Electronics", price: 850, message: "Stock available, aa jaiye!" }],
  },
];

const INITIAL_FEED = [
  { id: "f1", shopName: "Krishna General Store", text: "Fresh vegetables aa gayi hain aaj subah! 🥦🥕", likes: 12, time: Date.now() - 1000 * 60 * 60 * 2 },
  { id: "f2", shopName: "Sundaram Bakery", text: "Weekend special: Buy 2 pastry get 1 free 🎂", likes: 27, time: Date.now() - 1000 * 60 * 60 * 5 },
];

const CURRENT_USER_SEED = {
  id: "u1", name: "Khan Saheb", phone: "9998887770", role: "customer",
  points: 340, streak: 4, lastCheckIn: null, isBlocked: false,
  referralCode: "KHAN340", myShopIds: ["s1", "s2"],
};

// Every completed POS sale gets logged here — this is the raw feed the
// enterprise "Market Intelligence" data-licensing layer is built on top of.
const daysAgo = (n) => Date.now() - n * 24 * 60 * 60 * 1000;
const INITIAL_SALES_LOG = [
  { id: "sl1", shopId: "s3", shopName: "Raj Medical Store", area: "Varachha", city: "Surat", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Paracetamol 10 tab", qty: 5, revenue: 110, timestamp: daysAgo(1) },
  { id: "sl2", shopId: "s3", shopName: "Raj Medical Store", area: "Varachha", city: "Surat", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Azithromycin 500 (3 tab)", qty: 3, revenue: 255, timestamp: daysAgo(1) },
  { id: "sl3", shopId: "s3", shopName: "Raj Medical Store", area: "Varachha", city: "Surat", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Paracetamol 10 tab", qty: 8, revenue: 176, timestamp: daysAgo(3) },
  { id: "sl4", shopId: "s3", shopName: "Raj Medical Store", area: "Varachha", city: "Surat", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Azithromycin 500 (3 tab)", qty: 6, revenue: 510, timestamp: daysAgo(4) },
  { id: "sl5", shopId: "s5", shopName: "Shree Sai Medical", area: "Alkapuri", city: "Vadodara", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Paracetamol 10 tab", qty: 2, revenue: 40, timestamp: daysAgo(2) },
  { id: "sl6", shopId: "s5", shopName: "Shree Sai Medical", area: "Alkapuri", city: "Vadodara", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Azithromycin 500 (3 tab)", qty: 9, revenue: 738, timestamp: daysAgo(2) },
  { id: "sl7", shopId: "s5", shopName: "Shree Sai Medical", area: "Alkapuri", city: "Vadodara", state: "Gujarat", country: "India", category: "Pharmacy", productName: "Azithromycin 500 (3 tab)", qty: 7, revenue: 574, timestamp: daysAgo(5) },
  { id: "sl8", shopId: "s6", shopName: "Andheri Care Pharmacy", area: "Andheri West", city: "Mumbai", state: "Maharashtra", country: "India", category: "Pharmacy", productName: "Azithromycin 500 (3 tab)", qty: 4, revenue: 360, timestamp: daysAgo(1) },
  { id: "sl9", shopId: "s6", shopName: "Andheri Care Pharmacy", area: "Andheri West", city: "Mumbai", state: "Maharashtra", country: "India", category: "Pharmacy", productName: "Paracetamol 10 tab", qty: 1, revenue: 25, timestamp: daysAgo(6) },
  { id: "sl10", shopId: "s1", shopName: "Krishna General Store", area: "Ring Road", city: "Surat", state: "Gujarat", country: "India", category: "Grocery", productName: "Amul Milk 1L", qty: 12, revenue: 792, timestamp: daysAgo(1) },
  { id: "sl11", shopId: "s1", shopName: "Krishna General Store", area: "Ring Road", city: "Surat", state: "Gujarat", country: "India", category: "Grocery", productName: "Toor Dal (loose)", qty: 3, revenue: 360, timestamp: daysAgo(2) },
  { id: "sl12", shopId: "s1", shopName: "Krishna General Store", area: "Ring Road", city: "Surat", state: "Gujarat", country: "India", category: "Grocery", productName: "Aashirvaad Atta 5kg", qty: 4, revenue: 1036, timestamp: daysAgo(4) },
  { id: "sl13", shopId: "s2", shopName: "Patel Electronics", area: "Adajan", city: "Surat", state: "Gujarat", country: "India", category: "Electronics", productName: "USB-C Cable", qty: 6, revenue: 894, timestamp: daysAgo(3) },
  { id: "sl14", shopId: "s2", shopName: "Patel Electronics", area: "Adajan", city: "Surat", state: "Gujarat", country: "India", category: "Electronics", productName: "Power Bank 10000mAh", qty: 2, revenue: 1798, timestamp: daysAgo(5) },
  { id: "sl15", shopId: "s4", shopName: "Sundaram Bakery", area: "Vesu", city: "Surat", state: "Gujarat", country: "India", category: "Bakery", productName: "Brown Bread", qty: 15, revenue: 675, timestamp: daysAgo(1) },
];

/* ============================================================================
   FILE: lib/utils.js
============================================================================ */

const formatINR = (n) => `₹${n.toLocaleString("en-IN")}`;
const timeAgo = (ts) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const genId = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

// Haversine distance in km between two lat/lng points
const distanceKm = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lat2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const formatKm = (km) => (km == null ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// ---- Enterprise data-licensing helpers ----
// Filters the raw sales log down to whatever scope a data license grants access to.
const filterSalesLog = (salesLog, scope) =>
  salesLog.filter((l) => {
    if (scope.category && scope.category !== "All" && l.category !== scope.category) return false;
    if (scope.level === "shop") return l.shopId === scope.value;
    if (scope.level === "area") return l.area === scope.value;
    if (scope.level === "city") return l.city === scope.value;
    if (scope.level === "state") return l.state === scope.value;
    if (scope.level === "country") return l.country === scope.value;
    return true;
  });

const aggregateByProduct = (logs) => {
  const map = {};
  logs.forEach((l) => {
    if (!map[l.productName]) map[l.productName] = { productName: l.productName, qty: 0, revenue: 0 };
    map[l.productName].qty += l.qty;
    map[l.productName].revenue += l.revenue;
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty);
};

const scopeLabel = (scope) => {
  const levelLabel = { shop: "Shop", area: "Area", city: "City", state: "State", country: "Country" }[scope.level];
  const catLabel = scope.category && scope.category !== "All" ? ` · ${scope.category}` : "";
  return `${levelLabel}: ${scope.valueLabel || scope.value}${catLabel}`;
};

// ---- Supabase row <-> app-shape mappers ----
// DB columns are snake_case; the rest of the app (all the components below)
// expects the camelCase shape that used to come from the mock data. These
// keep that boundary in one place so nothing else has to change.
const shopFromRow = (row, products, reviews) => ({
  ...row,
  isBlocked: row.is_blocked,
  isClaimed: row.is_claimed,
  premiumReviews: row.premium_reviews,
  flashDeal: row.flash_deal,
  products: (products || []).filter((p) => p.shop_id === row.id).map(productFromRow),
  reviews: (reviews || []).filter((r) => r.shop_id === row.id).map(reviewFromRow),
});
const productFromRow = (row) => ({ ...row, lastUpdated: new Date(row.last_updated).getTime(), imageUrl: row.image_url, expiryDate: row.expiry_date });
const daysToExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};
// Loose-quantity units: how the owner enters quantity at POS vs. how stock is stored
const UNIT_META = {
  weight: { enteredLabel: "grams", enteredShort: "g", divisor: 1000, stockUnit: "kg" },
  volume: { enteredLabel: "ml", enteredShort: "ml", divisor: 1000, stockUnit: "L" },
  length: { enteredLabel: "cm", enteredShort: "cm", divisor: 100, stockUnit: "m" },
};
const reviewFromRow = (row) => ({ id: row.id, user: row.user_name, rating: row.rating, text: row.text, reply: row.reply });
const bidFromRow = (row, offers, shopsById) => ({
  id: row.id, customer: row.customer_name, item: row.item, budget: Number(row.budget),
  area: row.area, status: row.status, createdAt: new Date(row.created_at).getTime(),
  offers: (offers || []).filter((o) => o.bid_id === row.id).map((o) => ({
    shopId: o.shop_id, shopName: shopsById[o.shop_id]?.name || "Shop", price: Number(o.price), message: o.message,
  })),
});

/* ============================================================================
   FILE: components/InterstitialAd.jsx
============================================================================ */

function InterstitialAd({ onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-8 text-white text-center">
          <span className="absolute top-3 left-3 text-[10px] bg-white/25 px-2 py-0.5 rounded-full tracking-wide">SPONSORED</span>
          {secondsLeft > 0 ? (
            <span className="absolute top-3 right-3 text-xs bg-black/30 w-6 h-6 rounded-full flex items-center justify-center">{secondsLeft}</span>
          ) : (
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/30 w-6 h-6 rounded-full flex items-center justify-center">
              <X size={14} />
            </button>
          )}
          <div className="text-5xl mb-3">🛍️</div>
          <div className="text-xl font-bold">ShopNear Premium</div>
          <div className="text-sm opacity-90 mt-1">Remove ads &amp; unlock owner reply on reviews — ₹99/month</div>
        </div>
        <div className="p-4">
          <button
            disabled={secondsLeft > 0}
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 disabled:opacity-50 font-semibold text-gray-500"
          >
            {secondsLeft > 0 ? `Continue in ${secondsLeft}s` : "Continue to app"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: components/LoginScreen.jsx
============================================================================ */

function LoginScreen({ onLogin, onAdminLogin, blockedPhones, dataLicenses, onViewData }) {
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

function BottomNav({ tabs, active, onChange }) {
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

function ShopCard({ shop, onOpen, distanceLabel }) {
  const call = (e) => { e.stopPropagation(); window.open(`tel:${shop.phone}`); };
  const whatsapp = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${shop.phone}`); };
  const maps = (e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${shop.lat},${shop.lng}`); };

  return (
    <div onClick={() => onOpen(shop)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-gray-900">{shop.name}</div>
          <div className="text-xs text-gray-400">{shop.category} · {shop.area}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-amber-500 text-xs"><Star size={12} fill="currentColor" /> {shop.rating}</span>
            {distanceLabel && <span className="flex items-center gap-1 text-violet-500 text-xs font-semibold"><MapPin size={11} /> {distanceLabel}</span>}
          </div>
        </div>
        {shop.flashDeal && (
          <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Zap size={10} /> DEAL
          </span>
        )}
        {shop.isClaimed === false && (
          <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full">UNCLAIMED</span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {shop.products.length > 0
          ? shop.products.slice(0, 2).map((p) => `${p.name} · ${formatINR(p.price)}`).join("  |  ")
          : shop.isClaimed === false && "Google se import — products list ke liye owner ko claim karna hoga"}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={call} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg">
          <Phone size={13} /> Call
        </button>
        <button onClick={whatsapp} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg">
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button onClick={maps} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg">
          <Navigation size={13} /> Maps
        </button>
      </div>
    </div>
  );
}

function ProductResultCard({ product, shop, distanceLabel, onOpenShop }) {
  const call = (e) => { e.stopPropagation(); window.open(`tel:${shop.phone}`); };
  const whatsapp = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${shop.phone}`); };
  const maps = (e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${shop.lat},${shop.lng}`); };

  return (
    <div onClick={() => onOpenShop(shop)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-gray-900">{product.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">Available at <span className="font-semibold text-gray-600">{shop.name}</span></div>
          <div className="flex items-center gap-2 mt-1">
            {distanceLabel && <span className="flex items-center gap-1 text-violet-500 text-xs font-semibold"><MapPin size={11} /> {distanceLabel} away</span>}
            <span className="text-xs text-gray-400">{shop.area}</span>
          </div>
        </div>
        <div className="font-extrabold text-violet-600">{formatINR(product.price)}</div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={call} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg">
          <Phone size={13} /> Call
        </button>
        <button onClick={whatsapp} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg">
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button onClick={maps} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg">
          <Navigation size={13} /> Maps
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: components/SponsoredLoadingCard.jsx
============================================================================ */

const _adImpressionCounts = {};
function pickFairAd(pool) {
  if (pool.length === 0) return null;
  const minCount = Math.min(...pool.map((a) => _adImpressionCounts[a.id] || 0));
  const leastShown = pool.filter((a) => (_adImpressionCounts[a.id] || 0) === minCount);
  const chosen = leastShown[Math.floor(Math.random() * leastShown.length)];
  _adImpressionCounts[chosen.id] = (_adImpressionCounts[chosen.id] || 0) + 1;
  return chosen;
}

function SponsoredLoadingCard({ realAds = [], onReportAd }) {
  const pool = useMemo(() => {
    const demo = SPONSORED_ADS.map((a) => ({ ...a, isReal: false }));
    const real = realAds.map((a) => ({
      id: a.id, brand: a.shopName, tagline: a.message, emoji: "📢",
      color: "from-violet-600 to-purple-700", isReal: true,
    }));
    return [...demo, ...real];
  }, [realAds]);

  const ad = useMemo(() => pickFairAd(pool), [pool]);
  if (!ad) return null;

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-4 bg-gradient-to-br ${ad.color} text-white flex items-center gap-3 animate-pulse`}>
        <div className="text-3xl">{ad.emoji}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] bg-white/25 inline-block px-2 py-0.5 rounded-full">SPONSORED</div>
            {ad.isReal && onReportAd && (
              <button onClick={() => onReportAd(ad.id)} className="text-[10px] text-white/70 underline">Report</button>
            )}
          </div>
          <div className="font-bold text-sm">{ad.brand}</div>
          <div className="text-xs text-white/90">{ad.tagline}</div>
        </div>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   FILE: screens/DiscoverTab.jsx
============================================================================ */

function DiscoverTab({ shops, user, onOpenShop, onAddShop, onOpenMyShop, location, onLocate, userCoords, onPriceCheck }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showScan, setShowScan] = useState(false);
  const [searchMode, setSearchMode] = useState("smart");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(() => setIsSearching(false), 650);
    return () => clearTimeout(t);
  }, [query, searchMode]);

  const liveShops = shops.filter((s) => !s.isBlocked && (category === "All" || s.category === category));

  const withDistance = (list) =>
    list
      .map((s) => ({ ...s, _dist: distanceKm(userCoords?.lat, userCoords?.lng, s.lat, s.lng) }))
      .sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));

  const q = query.trim().toLowerCase();

  let shopResults = [];
  let productResults = [];

  if (!q) {
    shopResults = withDistance(liveShops);
  } else if (searchMode === "shop") {
    shopResults = withDistance(liveShops.filter((s) => s.name.toLowerCase().includes(q)));
  } else if (searchMode === "product") {
    liveShops.forEach((s) => s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) productResults.push({ product: p, shop: s }); }));
    productResults = productResults
      .map((r) => ({ ...r, _dist: distanceKm(userCoords?.lat, userCoords?.lng, r.shop.lat, r.shop.lng) }))
      .sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));
  } else {
    const shopMatches = liveShops.filter((s) => s.name.toLowerCase().includes(q));
    if (shopMatches.length > 0) {
      shopResults = withDistance(shopMatches);
    } else {
      liveShops.forEach((s) => s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) productResults.push({ product: p, shop: s }); }));
      productResults = productResults
        .map((r) => ({ ...r, _dist: distanceKm(userCoords?.lat, userCoords?.lng, r.shop.lat, r.shop.lng) }))
        .sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));
    }
  }

  const hasShop = user.myShopIds && user.myShopIds.length > 0;

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-8 rounded-b-3xl text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <MapPin size={14} /> {location}
          </div>
          <button onClick={onLocate} className="bg-white/20 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
            <Navigation size={12} /> Locate Me
          </button>
        </div>
        <div className="text-3xl font-extrabold mt-3">ShopNear</div>
        <div className="text-white/80 text-sm">Find best prices nearby</div>
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-3">
            <Search size={16} className="text-gray-400" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, barcodes, ya dukan..." className="flex-1 outline-none px-2 text-sm text-gray-700"
            />
          </div>
          <button onClick={() => setShowScan(true)} className="bg-indigo-700 w-11 h-11 rounded-xl flex items-center justify-center">
            <ScanLine size={20} />
          </button>
        </div>

        <div className="flex bg-white/15 rounded-xl p-1 mt-3">
          {[
            { key: "smart", label: "Product ya Shop" },
            { key: "product", label: "Sirf Product" },
            { key: "shop", label: "Sirf Shop" },
          ].map((m) => (
            <button
              key={m.key} onClick={() => setSearchMode(m.key)}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg ${searchMode === m.key ? "bg-white text-violet-700" : "text-white/80"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPriceCheck("", "")}
          className="w-full mt-2 bg-emerald-400/90 text-emerald-950 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
        >
          <IndianRupee size={14} /> Scan a purchase — kya kahi sasta hai?
        </button>
      </div>

      <div className="px-5 -mt-4">
        <button
          onClick={hasShop ? onOpenMyShop : onAddShop}
          className="w-full bg-white shadow-lg rounded-2xl p-4 flex items-center justify-between border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <Store size={18} />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-900 text-sm">{hasShop ? "My Shop" : "Add Your Shop"}</div>
              <div className="text-xs text-gray-400">{hasShop ? `Manage ${user.myShopIds.length} shop(s)` : "Start selling to your neighbourhood"}</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${category === c ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4">
        {q && isSearching ? (
          <SponsoredLoadingCard />
        ) : (
          <>
            {q && productResults.length > 0 && (
              <div className="text-xs text-gray-400 mb-2">"{query}" dukan naam se nahi mila — yeh product jin dukaano me mila, sabse najdik pehle:</div>
            )}

            {productResults.length > 0
              ? productResults.map((r, i) => (
                  <ProductResultCard key={r.product.id + i} product={r.product} shop={r.shop} distanceLabel={formatKm(r._dist)} onOpenShop={onOpenShop} />
                ))
              : shopResults.length === 0
              ? <div className="text-center text-gray-400 text-sm mt-10">Koi result nahi mila. Kuch aur try kariye.</div>
              : shopResults.map((s) => <ShopCard key={s.id} shop={s} onOpen={onOpenShop} distanceLabel={formatKm(s._dist)} />)
            }
          </>
        )}
      </div>

      {showScan && (
        <BarcodeScanModal
          subtitle="Barcode ko frame ke andar rakhiye..."
          onClose={() => setShowScan(false)}
          onDetected={(item) => {
            setShowScan(false);
            if (item.name) { setQuery(item.name); setSearchMode("product"); }
            else alert(`Barcode ${item.code} pehchana nahi gaya. Naam se search kariye.`);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/ShopDetail.jsx
============================================================================ */

function ShopDetail({ shop, onBack, onAddReview, currentUserName, onClaimShop }) {
  const [tab, setTab] = useState("products");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [productSearch, setProductSearch] = useState("");
  const [detailProduct, setDetailProduct] = useState(null);

  const filteredProducts = shop.products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold">{shop.name}</div>
        <div className="text-white/80 text-sm">{shop.category} · {shop.area}</div>
        <div className="flex items-center gap-1 mt-1 text-amber-300 text-sm"><Star size={14} fill="currentColor" /> {shop.rating}</div>
        <div className="flex gap-2 mt-4">
          <a href={`tel:${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><Phone size={13} /> Call</a>
          <a href={`https://wa.me/91${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
          <a href={`https://maps.google.com/?q=${shop.lat},${shop.lng}`} className="flex-1 flex items-center justify-center gap-1 bg-white/20 text-xs font-semibold py-2.5 rounded-lg"><Navigation size={13} /> Maps</a>
        </div>
      </div>

      {shop.isClaimed === false && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="font-bold text-sm text-amber-800 flex items-center gap-2"><Store size={16} /> Unclaimed Listing</div>
          <div className="text-xs text-amber-700 mt-1">
            Yeh listing public jaankari (jaise Google) se import ki gayi hai — koi products/stock data nahi hai kyuki wo private hai. Kya yeh aapki dukaan hai?
          </div>
          <button
            onClick={() => onClaimShop(shop.id)}
            className="mt-3 w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Claim This Shop — Free me manage kariye
          </button>
        </div>
      )}

      <div className="flex px-5 mt-4 gap-2">
        {["products", "reviews"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-xs font-semibold capitalize ${tab === t ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>{t}</button>
        ))}
      </div>

      {tab === "products" && (
        <div className="px-5 mt-4 space-y-3">
          <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <Search size={15} className="text-gray-400" />
            <input
              value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Is dukaan me product dhundo..." className="flex-1 outline-none px-2 text-sm text-gray-700"
            />
          </div>
          {shop.products.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-6">
              {shop.isClaimed === false ? "Abhi tak koi product list nahi hui — owner ke claim karne ke baad hi dikhega." : "Abhi tak koi product add nahi hua."}
            </div>
          )}
          {shop.products.length > 0 && filteredProducts.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-6">"{productSearch}" is dukaan me nahi mila.</div>
          )}
          {filteredProducts.map((p) => {
            const isOpen = detailProduct === p.id;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => setDetailProduct(isOpen ? null : p.id)}
                  className="w-full text-left p-4 flex gap-3 items-center active:bg-gray-50"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300">
                      <Package size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {p.unit === "piece" ? `${p.stock} pcs available` : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit} available`}
                    </div>
                  </div>
                  <div className="font-bold text-violet-600">{formatINR(p.price)}</div>
                  <ChevronRight size={16} className={`text-gray-300 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 animate-[fadeIn_0.2s_ease-in]">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[11px] text-gray-400">Available Stock</div>
                        <div className="font-bold text-sm text-gray-800">{p.unit === "piece" ? `${p.stock} pcs` : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit}`}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[11px] text-gray-400">Price Update</div>
                        <div className="font-bold text-sm text-gray-800">{timeAgo(p.lastUpdated)}</div>
                      </div>
                    </div>

                    {p.expiryDate && (
                      <div className="bg-amber-50 rounded-xl p-3 mb-3 text-xs text-amber-700 font-semibold">
                        Expiry: {new Date(p.expiryDate).toLocaleDateString("en-IN")}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 font-medium mb-1">Price History</div>
                    <div className="h-32 mb-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={p.history}>
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                          <Tooltip formatter={(v) => formatINR(v)} />
                          <Line type="monotone" dataKey="price" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex gap-2">
                      <a href={`tel:${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2.5 rounded-lg"><Phone size={13} /> Call</a>
                      <a href={`https://wa.me/91${shop.phone}`} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2.5 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "reviews" && (
        <div className="px-5 mt-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Apna review likhiye</div>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={18} onClick={() => setReviewRating(n)} className={n <= reviewRating ? "text-amber-400 cursor-pointer" : "text-gray-200 cursor-pointer"} fill={n <= reviewRating ? "currentColor" : "none"} />
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Aapka anubhav kaisa raha?" className="w-full border border-gray-200 rounded-xl p-2 text-sm outline-none" rows={2} />
            <button
              onClick={() => { if (reviewText.trim()) { onAddReview(shop.id, { id: genId("r"), user: currentUserName, rating: reviewRating, text: reviewText, reply: null }); setReviewText(""); } }}
              className="mt-2 bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg"
            >
              Submit Review
            </button>
          </div>
          {shop.reviews.length === 0 && <div className="text-center text-gray-400 text-sm mt-4">Abhi tak koi review nahi.</div>}
          {shop.reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between">
                <div className="font-semibold text-sm text-gray-800">{r.user}</div>
                <div className="flex text-amber-400">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>
              </div>
              <div className="text-sm text-gray-600 mt-1">{r.text}</div>
              {r.reply && (
                <div className="mt-2 bg-violet-50 rounded-lg p-2 text-xs text-violet-700">
                  <span className="font-semibold">Owner reply {shop.premiumReviews && <Lock size={10} className="inline ml-1" />}: </span>{r.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/PriceCheckScreen.jsx
============================================================================ */

function PriceCheckScreen({ shops, userCoords, initialProductName, initialPrice, onBack, onOpenShop }) {
  const [productName, setProductName] = useState(initialProductName || "");
  const [paidPrice, setPaidPrice] = useState(initialPrice ? String(initialPrice) : "");
  const [showScan, setShowScan] = useState(false);

  const q = productName.trim().toLowerCase();
  const matches = [];
  if (q) {
    shops.forEach((s) => {
      if (s.isBlocked) return;
      s.products.forEach((p) => { if (p.name.toLowerCase().includes(q)) matches.push({ product: p, shop: s }); });
    });
  }
  const withDist = matches
    .map((m) => ({ ...m, _dist: distanceKm(userCoords?.lat, userCoords?.lng, m.shop.lat, m.shop.lng) }))
    .sort((a, b) => a.product.price - b.product.price);

  const paid = Number(paidPrice) || null;
  const cheapest = withDist[0];
  const savingsVsPaid = paid && cheapest ? paid - cheapest.product.price : null;

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold flex items-center gap-2"><IndianRupee size={22} /> Price Check</div>
        <div className="text-white/80 text-sm mt-1">Dekhte hain kahi aur sasta to nahi mil raha</div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500 font-medium">Product ka naam</label>
            <button onClick={() => setShowScan(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
              <ScanLine size={12} /> Scan
            </button>
          </div>
          <input
            value={productName} onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Lays Chips 20rs pack" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none"
          />
          <label className="text-xs text-gray-500 font-medium">Aapne kitne me liya? (₹) — optional</label>
          <input
            value={paidPrice} onChange={(e) => setPaidPrice(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 20" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 outline-none"
          />
        </div>

        {!q && <div className="text-center text-gray-400 text-sm mt-6">Product ka naam daaliye ya upar scan kariye.</div>}

        {q && withDist.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-6">Yeh product aas-paas kisi registered shop me nahi mila.</div>
        )}

        {withDist.length > 0 && (
          <div className="space-y-2">
            {paid && cheapest && (
              <div className={`rounded-2xl p-4 text-center font-bold ${savingsVsPaid > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {savingsVsPaid > 0
                  ? `🎉 ${cheapest.shop.name} me ${formatINR(savingsVsPaid)} sasta hai!`
                  : "Aapne already sabse acha price liya tha 👍"}
              </div>
            )}
            {withDist.map((m, i) => {
              const diff = paid ? paid - m.product.price : null;
              return (
                <div key={m.product.id + i} onClick={() => onOpenShop(m.shop)} className="bg-white rounded-2xl p-4 border border-gray-100 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{m.shop.name}</div>
                      <div className="text-xs text-gray-400">{m.shop.area} {m._dist != null && `· ${formatKm(m._dist)} away`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-violet-600">{formatINR(m.product.price)}</div>
                      {diff != null && diff !== 0 && (
                        <div className={`text-[10px] font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-400"}`}>
                          {diff > 0 ? `${formatINR(diff)} cheaper` : `${formatINR(-diff)} costlier`}
                        </div>
                      )}
                      {i === 0 && <div className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5 justify-end"><Award size={10} /> Best price</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <a href={`tel:${m.shop.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg"><Phone size={13} /> Call</a>
                    <a href={`https://wa.me/91${m.shop.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-semibold py-2 rounded-lg"><MessageCircle size={13} /> WhatsApp</a>
                    <a href={`https://maps.google.com/?q=${m.shop.lat},${m.shop.lng}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold py-2 rounded-lg"><Navigation size={13} /> Maps</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showScan && (
        <BarcodeScanModal
          subtitle="Jo cheez kharidi (ya kharidne wale hain) uska barcode scan kariye"
          onClose={() => setShowScan(false)}
          onDetected={(item) => {
            setShowScan(false);
            if (item.name) { setProductName(item.name); if (item.suggestedPrice) setPaidPrice(String(item.suggestedPrice)); }
            else alert(`Barcode ${item.code} pehchana nahi gaya. Naam khud daaliye.`);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/DealsTab.jsx
============================================================================ */

function DealsTab({ shops, myShops, onStartFlashDeal }) {
  const active = shops.filter((s) => s.flashDeal && !s.isBlocked);

  const myProducts = myShops.flatMap((s) => s.products.map((p) => ({ ...p, shopId: s.id, shopName: s.name })));
  const [productKey, setProductKey] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [bulkOn, setBulkOn] = useState(false);
  const [bulkQty, setBulkQty] = useState("");
  const [bulkExtraPct, setBulkExtraPct] = useState("");
  const [sliderHours, setSliderHours] = useState(12);
  const sliderPrice = Math.round((sliderHours / 12) * 10);

  useEffect(() => { if (!productKey && myProducts.length > 0) setProductKey(`${myProducts[0].shopId}:${myProducts[0].id}`); }, [myProducts.length]); // eslint-disable-line

  const selected = myProducts.find((p) => `${p.shopId}:${p.id}` === productKey);
  const pct = Number(discountPct) || 0;
  const newPrice = selected && pct > 0 ? +(selected.price * (1 - pct / 100)).toFixed(2) : null;

  const launch = (hours, amount) => {
    if (!selected) { alert("Pehle apni shop add kariye"); return; }
    if (!pct || pct <= 0 || pct >= 100) { alert("Sahi discount % daaliye (1-99)"); return; }
    const bulkOffer = bulkOn && bulkQty && bulkExtraPct ? { minQty: Number(bulkQty), extraPercent: Number(bulkExtraPct) } : null;
    onStartFlashDeal(selected.shopId, hours, amount, {
      productName: selected.name, originalPrice: selected.price, discountPercent: pct, newPrice, bulkOffer,
    });
  };

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-orange-400 to-pink-500 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <div className="text-2xl font-extrabold flex items-center gap-2"><Flame size={22} /> Flash Deals</div>
        <div className="text-white/80 text-sm mt-1">Limited-time offers from shops nearby</div>
      </div>
      <div className="px-5 mt-4 space-y-3">
        {active.length === 0 && <div className="text-center text-gray-400 text-sm mt-8">Abhi koi live deal nahi hai.</div>}
        {active.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                <div className="text-xs text-gray-400">{s.area}</div>
              </div>
              <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full">{s.flashDeal.discountPercent}% off</span>
            </div>
            <div className="text-sm text-gray-700 mt-2 font-medium">{s.flashDeal.productName || s.flashDeal.item}</div>
            {s.flashDeal.originalPrice != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm line-through">{formatINR(s.flashDeal.originalPrice)}</span>
                <span className="text-emerald-600 font-extrabold text-sm">{formatINR(s.flashDeal.newPrice)}</span>
              </div>
            )}
            {s.flashDeal.bulkOffer && (
              <div className="text-[11px] text-violet-600 font-semibold mt-1">
                🎁 {s.flashDeal.bulkOffer.minQty}+ piece lo, extra {s.flashDeal.bulkOffer.extraPercent}% off
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><Clock size={12} /> Ends {new Date(s.flashDeal.expiresAt).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      <div className="px-5 mt-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-bold text-sm text-gray-800 mb-1">Shop owner ho?</div>
          <div className="text-xs text-gray-400 mb-3">Flash deal launch karke customers ko turant attract kariye.</div>

          {myProducts.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-3">Pehle apni shop me products add kariye.</div>
          ) : (
            <>
              <select value={productKey} onChange={(e) => setProductKey(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2">
                {myProducts.map((p) => <option key={`${p.shopId}:${p.id}`} value={`${p.shopId}:${p.id}`}>{p.name} ({p.shopName})</option>)}
              </select>
              <input
                value={discountPct} onChange={(e) => setDiscountPct(e.target.value.replace(/\D/g, ""))}
                placeholder="Kitne % discount? (e.g. 15)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2"
              />
              {selected && pct > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 mb-2 flex items-center justify-between">
                  <span className="text-xs text-emerald-700">Preview</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm line-through">{formatINR(selected.price)}</span>
                    <span className="text-emerald-700 font-extrabold">{formatINR(newPrice)}</span>
                  </span>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <input type="checkbox" checked={bulkOn} onChange={(e) => setBulkOn(e.target.checked)} />
                Bulk-quantity pe extra discount dena hai?
              </label>
              {bulkOn && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={bulkQty} onChange={(e) => setBulkQty(e.target.value.replace(/\D/g, ""))} placeholder="Kitne piece se?" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  <input value={bulkExtraPct} onChange={(e) => setBulkExtraPct(e.target.value.replace(/\D/g, ""))} placeholder="Extra %" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-3 mt-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 font-medium">Kitni der Flash Deal chalani hai?</span>
                  <span className="text-sm font-extrabold text-orange-600">{sliderHours}h · {formatINR(sliderPrice)}</span>
                </div>
                <input
                  type="range" min={12} max={168} step={12}
                  value={sliderHours} onChange={(e) => setSliderHours(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>12h</span><span>7 din</span>
                </div>
                <button onClick={() => launch(sliderHours, sliderPrice)} className="w-full mt-3 bg-orange-500 text-white text-sm font-semibold py-2.5 rounded-lg">
                  {formatINR(sliderPrice)} me {sliderHours} ghante ke liye chalao
                </button>
              </div>

              <div className="mt-3 bg-violet-50 rounded-xl p-3">
                <button onClick={() => launch(24 * 30, 299)} className="w-full bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-lg">
                  ₹299 — Poora Mahina (Unlimited swaps)
                </button>
                <div className="text-[11px] text-violet-600 mt-2">
                  30 din slider se lena hota to {formatINR(Math.round((24 * 30 / 12) * 10))}+ lagta — monthly plan me product/discount jitni baar chaho badal sakte ho, ek hi price me.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/FeedTab.jsx
============================================================================ */

function FeedTab({ posts, onLike, onCreatePost }) {
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

function BidTab({ bids, onCreateBid, onOwnerOffer, ownerShops }) {
  const [item, setItem] = useState("");
  const [budget, setBudget] = useState("");
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
          <button
            onClick={() => { if (item.trim() && budget) { onCreateBid(item, Number(budget)); setItem(""); setBudget(""); } }}
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

function ProfileTab({ user, onCheckIn, onOpenLeaderboard, onOpenAddShop, onOpenMyShop, onLogout }) {
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

function LeaderboardScreen({ onBack, currentUser }) {
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

function AddShopForm({ onBack, onSubmit, blockCheck, existingShopCount = 0 }) {
  const isPaid = existingShopCount >= 1;
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], area: "", address: "", phone: "" });
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
          setForm((f) => ({ ...f, address: auto, area: areaGuess || f.area }));
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

function BarcodeScanModal({ onClose, onDetected, subtitle }) {
  const [scanning, setScanning] = useState(true);

  const simulateScan = () => {
    setScanning(false);
    setTimeout(() => {
      const known = Math.random() > 0.3;
      if (known) {
        const item = BARCODE_DB[Math.floor(Math.random() * BARCODE_DB.length)];
        onDetected(item);
      } else {
        onDetected({ code: String(Math.floor(1e12 + Math.random() * 9e12)), name: "", suggestedPrice: "" });
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6">
      <div className="w-64 h-64 border-2 border-white/60 rounded-2xl flex items-center justify-center relative overflow-hidden">
        <Camera size={40} className="text-white/50" />
        {scanning && <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 animate-pulse" />}
      </div>
      <div className="text-white mt-4 text-sm text-center">{subtitle || "Barcode ko frame ke andar rakhiye..."}</div>
      <button onClick={simulateScan} className="mt-6 bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm">
        {scanning ? "Tap to Scan" : "Scanning..."}
      </button>
      <button onClick={onClose} className="mt-3 text-white/60 text-xs">Cancel</button>
    </div>
  );
}

/* ============================================================================
   FILE: screens/MyShopDashboard.jsx
============================================================================ */

function MyShopDashboard({ shops, onBack, onUpdatePrice, onAddProduct, onOpenSell, onOpenReport, onAddAnotherShop, onDeleteShop }) {
  const [newProd, setNewProd] = useState({ shopId: shops[0]?.id, name: "", price: "", code: "", unit: "piece", stock: "", expiryDate: "" });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [showScan, setShowScan] = useState(false);

  const unitLabel = (u) => (u === "weight" ? "/kg" : u === "volume" ? "/litre" : u === "length" ? "/metre" : "/piece");
  const stockLabel = (p) => (p.unit === "weight" ? `${p.stock} kg` : p.unit === "volume" ? `${p.stock} L` : p.unit === "length" ? `${p.stock} m` : `${p.stock} pcs`);

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submitNewProduct = async () => {
    if (!(newProd.name && newProd.price && newProd.stock)) return;
    setUploadingProduct(true);
    let imageUrl = null;
    if (imageFile) {
      const path = `${newProd.shopId}/${genId("img")}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, imageFile);
      if (!uploadError) {
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
    }
    await onAddProduct(newProd.shopId, newProd.name, Number(newProd.price), newProd.unit, Number(newProd.stock), imageUrl, newProd.expiryDate || null);
    setNewProd({ shopId: newProd.shopId, name: "", price: "", code: "", unit: "piece", stock: "", expiryDate: "" });
    setImageFile(null);
    setImagePreview(null);
    setUploadingProduct(false);
  };

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold">My Shop{shops.length > 1 ? "s" : ""}</div>
            <div className="text-white/80 text-sm mt-1">Manage products, stock &amp; billing</div>
          </div>
          <button onClick={onAddAnotherShop} className="bg-white/20 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 whitespace-nowrap">
            <Plus size={14} /> Naya Shop
          </button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {shops.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="font-bold text-sm text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-400">{s.area} · {s.products.length} products</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenReport(s.id)}
                  className="flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-2 rounded-lg"
                >
                  <BarChart3 size={13} /> Report
                </button>
                <button
                  onClick={() => onOpenSell(s.id)}
                  className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                >
                  <ShoppingCart size={13} /> New Sale
                </button>
              </div>
            </div>
            <div className="mt-2 divide-y divide-gray-50">
              {s.products.map((p) => (
                <div key={p.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300"><Package size={14} /></div>
                      )}
                      <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" defaultValue={p.price}
                        onBlur={(e) => onUpdatePrice(s.id, p.id, Number(e.target.value))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right outline-none"
                      />
                      <span className="text-[10px] text-gray-400">{unitLabel(p.unit)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[11px] font-semibold ${p.stock <= 3 ? "text-red-500" : "text-gray-500"}`}>Stock: {stockLabel(p)}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><History size={10} /> Updated {timeAgo(p.lastUpdated)}</span>
                  </div>
                  {p.expiryDate && (() => {
                    const d = daysToExpiry(p.expiryDate);
                    if (d < 0) return <div className="text-[11px] font-semibold text-red-600 mt-1">⚠️ Expire ho chuka hai ({new Date(p.expiryDate).toLocaleDateString("en-IN")})</div>;
                    if (d <= 7) return <div className="text-[11px] font-semibold text-amber-600 mt-1">⏰ {d} din me expire hoga ({new Date(p.expiryDate).toLocaleDateString("en-IN")})</div>;
                    return <div className="text-[10px] text-gray-400 mt-1">Expiry: {new Date(p.expiryDate).toLocaleDateString("en-IN")}</div>;
                  })()}
                </div>
              ))}
            </div>
            <button
              onClick={() => { if (confirm(`"${s.name}" delete karni hai? Iske sare products aur data bhi delete ho jaayenge — ye undo nahi ho sakta.`)) onDeleteShop(s.id); }}
              className="w-full mt-3 flex items-center justify-center gap-1 bg-red-50 text-red-500 text-xs font-semibold py-2 rounded-lg"
            >
              <Trash2 size={13} /> Delete Shop
            </button>
          </div>
        ))}

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-sm">Naya product add kariye</div>
            <button
              onClick={() => setShowScan(true)}
              className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              <ScanLine size={13} /> Scan Barcode
            </button>
          </div>
          {newProd.code && (
            <div className="text-[11px] text-gray-400 mb-2">Scanned code: {newProd.code}{!newProd.name && " — naam nahi mila, khud daaliye"}</div>
          )}
          <select value={newProd.shopId} onChange={(e) => setNewProd({ ...newProd, shopId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2">
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} placeholder="Product naam" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2" />

          <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl p-3 mb-2 cursor-pointer">
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="w-14 h-14 rounded-lg object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <Camera size={20} />
              </div>
            )}
            <div className="text-xs text-gray-500 flex-1">
              {imagePreview ? "Photo select ho gaya — badalne ke liye tap karo" : "Product ki photo add kariye (optional)"}
            </div>
            <input type="file" accept="image/*" capture="environment" onChange={handleImagePick} className="hidden" />
          </label>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <select value={newProd.unit} onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="piece">Piece-wise (e.g. tube, packet)</option>
              <option value="weight">Loose weight (₹ per kg)</option>
              <option value="volume">Loose liquid (₹ per litre)</option>
              <option value="length">Loose length (₹ per metre — kapda, ribbon, wire)</option>
            </select>
            <input value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: e.target.value.replace(/\D/g, "") })} placeholder={`Price ₹ ${unitLabel(newProd.unit)}`} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <input
            value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value.replace(/[^0-9.]/g, "") })}
            placeholder={newProd.unit === "piece" ? "Starting stock (pcs)" : newProd.unit === "weight" ? "Starting stock (kg)" : newProd.unit === "length" ? "Starting stock (metre)" : "Starting stock (litre)"}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2"
          />
          <div>
            <label className="text-xs text-gray-500">Expiry date (optional)</label>
            <input
              type="date" value={newProd.expiryDate} onChange={(e) => setNewProd({ ...newProd, expiryDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 mb-3"
            />
          </div>
          <button
            disabled={uploadingProduct}
            onClick={submitNewProduct}
            className="w-full bg-violet-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            {uploadingProduct ? "Adding..." : "Add Product"}
          </button>
        </div>
      </div>

      {showScan && (
        <BarcodeScanModal
          subtitle="Product ke barcode ko scan kariye — naam aur price apne aap bhar jaayenge"
          onClose={() => setShowScan(false)}
          onDetected={(item) => {
            setNewProd((prev) => ({ ...prev, code: item.code, name: item.name || prev.name, price: item.suggestedPrice ? String(item.suggestedPrice) : prev.price }));
            setShowScan(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILE: screens/ShopReportScreen.jsx
   Shop owner's own "Intelligence" — today/week/month totals, per-product
   sell-through %, and a slow-mover alert that one-taps into a Flash Deal
   (same paid feature already in DealsTab — this just makes it easy to find).
============================================================================ */

function ShopReportScreen({ shop, salesLog, onBack, onQuickDiscount }) {
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

function SellFlow({ shop, onBack, onCompleteSale }) {
  const [cart, setCart] = useState([]);
  const [showScan, setShowScan] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pendingProduct, setPendingProduct] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [receipt, setReceipt] = useState(null);

  const inStock = shop.products.filter((p) => (p.stock ?? 0) > 0);

  const addPieceToCart = (product) => {
    setCart((prev) => {
      const already = prev.find((c) => c.productId === product.id);
      const currentQty = already ? already.qty : 0;
      if (currentQty + 1 > product.stock) { alert(`${product.name} ka stock sirf ${product.stock} pcs bacha hai.`); return prev; }
      if (already) {
        return prev.map((c) => (c.productId === product.id ? { ...c, qty: c.qty + 1, displayQty: `${c.qty + 1} pcs`, lineTotal: (c.qty + 1) * product.price } : c));
      }
      return [...prev, { productId: product.id, name: product.name, unit: "piece", price: product.price, qty: 1, displayQty: "1 pcs", lineTotal: product.price }];
    });
  };

  const confirmWeightQty = () => {
    const amount = Number(qtyInput);
    if (!amount || amount <= 0) return;
    const meta = UNIT_META[pendingProduct.unit] || UNIT_META.weight;
    const baseQty = amount / meta.divisor;
    const existing = cart.find((c) => c.productId === pendingProduct.id);
    const totalBaseQty = (existing ? existing.baseQty : 0) + baseQty;
    if (totalBaseQty > pendingProduct.stock) {
      alert(`${pendingProduct.name} ka stock sirf ${pendingProduct.stock} ${meta.stockUnit} bacha hai.`);
      return;
    }
    const lineTotal = +(totalBaseQty * pendingProduct.price).toFixed(2);
    const displayQty = `${(totalBaseQty * meta.divisor).toFixed(0)} ${meta.enteredShort}`;
    setCart((prev) => {
      const already = prev.find((c) => c.productId === pendingProduct.id);
      if (already) return prev.map((c) => (c.productId === pendingProduct.id ? { ...c, baseQty: totalBaseQty, displayQty, lineTotal } : c));
      return [...prev, { productId: pendingProduct.id, name: pendingProduct.name, unit: pendingProduct.unit, price: pendingProduct.price, baseQty: totalBaseQty, displayQty, lineTotal }];
    });
    setPendingProduct(null);
    setQtyInput("");
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((c) => c.productId !== productId));

  const total = cart.reduce((sum, c) => sum + c.lineTotal, 0);

  const pickProduct = (product) => {
    if (product.unit === "piece") addPieceToCart(product);
    else setPendingProduct(product);
  };

  const simulateScan = () => {
    if (inStock.length === 0) { setShowScan(false); alert("Is shop me stock khatam ho gaya hai."); return; }
    const product = inStock[Math.floor(Math.random() * inStock.length)];
    setShowScan(false);
    pickProduct(product);
  };

  const [finishing, setFinishing] = useState(false);
  const finishSale = async () => {
    if (cart.length === 0) return;
    setFinishing(true);
    const bill = { id: genId("bill"), shopName: shop.name, items: cart, total, timestamp: Date.now() };
    await onCompleteSale(shop.id, cart);
    setFinishing(false);
    setReceipt(bill);
  };

  if (receipt) {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white text-center">
          <Check size={32} className="mx-auto mb-1" />
          <div className="text-xl font-extrabold">Sale Complete</div>
          <div className="text-white/80 text-xs mt-1">Stock apne aap update ho gaya</div>
        </div>
        <div className="px-5 mt-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Receipt size={16} className="text-gray-500" /><span className="font-bold text-sm">{receipt.shopName}</span></div>
            <div className="text-[11px] text-gray-400 mb-3">{new Date(receipt.timestamp).toLocaleString()}</div>
            <div className="divide-y divide-dashed divide-gray-200">
              {receipt.items.map((it) => (
                <div key={it.productId} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">{it.name} <span className="text-gray-400 text-xs">× {it.displayQty}</span></span>
                  <span className="font-semibold">{formatINR(it.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-3 mt-1 border-t border-gray-200 font-extrabold text-violet-600">
              <span>Total</span><span>{formatINR(total)}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm"><Printer size={15} /> Print Bill</button>
            <button onClick={onBack} className="flex-1 bg-violet-600 text-white font-semibold py-3 rounded-xl text-sm">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-2xl font-extrabold flex items-center gap-2"><ShoppingCart size={22} /> New Sale</div>
        <div className="text-white/80 text-sm mt-1">{shop.name}</div>
      </div>

      <div className="px-5 mt-4 space-y-2">
        <button onClick={() => setShowScan(true)} className="w-full bg-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg">
          <ScanLine size={20} /> Scan Barcode
        </button>
        <button onClick={() => setShowPicker(true)} className="w-full bg-white border-2 border-dashed border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2">
          <Package size={18} /> Barcode nahi hai? List se chuno
        </button>
      </div>

      <div className="px-5 mt-4 space-y-2">
        {cart.length === 0 && <div className="text-center text-gray-400 text-sm mt-8">Cart khali hai. Scan kariye ya list se product chuniye.</div>}
        {cart.map((c) => (
          <div key={c.productId} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-gray-800">{c.name}</div>
              <div className="text-xs text-gray-400">{c.displayQty} · {formatINR(c.price)}{c.unit === "piece" ? "/pc" : `/${(UNIT_META[c.unit] || UNIT_META.weight).stockUnit}`}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-violet-600 text-sm">{formatINR(c.lineTotal)}</span>
              <button onClick={() => removeFromCart(c.productId)} className="text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 p-4">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-gray-500">Total ({cart.length} items)</span>
            <span className="font-extrabold text-lg text-violet-600">{formatINR(total)}</span>
          </div>
          <button disabled={finishing} onClick={finishSale} className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
            <Check size={18} /> {finishing ? "Saving..." : "OK — Finish Sale & Generate Bill"}
          </button>
        </div>
      )}

      {showScan && (
        <BarcodeScanModal subtitle="Bikne wale item ko scan kariye" onClose={() => setShowScan(false)} onDetected={simulateScan} />
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[75vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold text-sm">Product chuniye (barcode ke bina)</div>
              <button onClick={() => { setShowPicker(false); setPickerQuery(""); }}><X size={18} /></button>
            </div>
            <input
              autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search product..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 outline-none"
            />
            <div className="overflow-y-auto space-y-2">
              {inStock.filter((p) => p.name.toLowerCase().includes(pickerQuery.toLowerCase())).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { pickProduct(p); setShowPicker(false); setPickerQuery(""); }}
                  className="w-full flex items-center justify-between bg-gray-50 rounded-xl p-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">Stock: {p.unit === "piece" ? `${p.stock} pcs` : `${p.stock} ${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit}`}</div>
                  </div>
                  <div className="text-sm font-bold text-violet-600">{formatINR(p.price)}{p.unit === "piece" ? "" : `/${(UNIT_META[p.unit] || UNIT_META.weight).stockUnit}`}</div>
                </button>
              ))}
              {inStock.filter((p) => p.name.toLowerCase().includes(pickerQuery.toLowerCase())).length === 0 && (
                <div className="text-center text-gray-400 text-sm py-6">Koi product nahi mila</div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingProduct && (() => {
        const meta = UNIT_META[pendingProduct.unit] || UNIT_META.weight;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
            <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5">
              <div className="font-bold text-sm mb-1">{pendingProduct.name}</div>
              <div className="text-xs text-gray-400 mb-3">
                Price: {formatINR(pendingProduct.price)} / {meta.stockUnit} · Available: {pendingProduct.stock} {meta.stockUnit}
              </div>
              <label className="text-xs text-gray-500">Customer ne kitna liya? ({meta.enteredLabel} me)</label>
              <input
                autoFocus value={qtyInput} onChange={(e) => setQtyInput(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 50"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg mt-1 mb-2 outline-none"
              />
              {qtyInput && (
                <div className="text-xs text-emerald-600 font-semibold mb-3">
                  Bill amount: {formatINR(+((Number(qtyInput) / meta.divisor) * pendingProduct.price).toFixed(2))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setPendingProduct(null); setQtyInput(""); }} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl">Cancel</button>
                <button onClick={confirmWeightQty} className="flex-1 bg-violet-600 text-white font-semibold py-3 rounded-xl">Add to Cart</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ============================================================================
   FILE: screens/AdminPanel.jsx
============================================================================ */

const PIE_COLORS = ["#7C3AED", "#F97316", "#10B981", "#3B82F6", "#EC4899", "#F59E0B"];

function AdminPanel({ shops, users, bids, salesLog, dataLicenses, blockedList, onBlockShop, onUnblockShop, onBlockUser, onUnblockUser, onGenerateLicense, onRevokeLicense, onLogout }) {
  const [tab, setTab] = useState("overview");

  const areaDemand = useMemo(() => {
    const counts = {};
    bids.forEach((b) => { counts[b.area] = (counts[b.area] || 0) + 1; });
    shops.forEach((s) => { counts[s.area] = (counts[s.area] || 0) + 0.3; });
    return Object.entries(counts).map(([area, count]) => ({ area, requests: Math.round(count * 10) / 10 }));
  }, [bids, shops]);

  const categoryDist = useMemo(() => {
    const counts = {};
    shops.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [shops]);

  const topShops = useMemo(() => [...shops].sort((a, b) => b.rating - a.rating).slice(0, 5), [shops]);

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-5 pt-6 pb-6 rounded-b-3xl text-white flex justify-between items-start">
        <div>
          <div className="text-2xl font-extrabold">Admin Panel</div>
          <div className="text-white/80 text-sm">Platform management</div>
        </div>
        <button onClick={onLogout} className="text-xs bg-white/20 px-3 py-1.5 rounded-full">Logout</button>
      </div>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto pb-1">
        {["overview", "shops", "users", "intelligence", "enterprise"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${tab === t ? "bg-violet-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="px-5 mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500 to-purple-600 text-white"><div className="text-2xl font-extrabold">{shops.length}</div><div className="text-xs opacity-90">Shops</div></div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-teal-500 to-cyan-600 text-white"><div className="text-2xl font-extrabold">{shops.reduce((a, s) => a + s.products.length, 0)}</div><div className="text-xs opacity-90">Products</div></div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-400 to-red-500 text-white"><div className="text-2xl font-extrabold">{users.length}</div><div className="text-xs opacity-90">Users</div></div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-500 to-pink-600 text-white"><div className="text-2xl font-extrabold">{blockedList.phones.length}</div><div className="text-xs opacity-90">Blocked</div></div>
        </div>
      )}

      {tab === "shops" && (
        <div className="px-5 mt-4 space-y-3">
          {shops.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-400">{s.area} · {s.phone}</div>
                </div>
                {s.isBlocked ? (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">BLOCKED</span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">LIVE</span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {s.isBlocked ? (
                  <button onClick={() => onUnblockShop(s.id)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg"><Unlock size={13} /> Unblock</button>
                ) : (
                  <button onClick={() => onBlockShop(s.id)} className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-500 text-xs font-semibold py-2 rounded-lg"><Ban size={13} /> Block (rule violation)</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="px-5 mt-4 space-y-3">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-400">+91 {u.phone}</div>
                </div>
                {u.isBlocked ? (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">BLOCKED</span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">ACTIVE</span>
                )}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Blocking bhi unke phone/address ko block karega — naya account nahi ban payega.</div>
              <div className="flex gap-2 mt-3">
                {u.isBlocked ? (
                  <button onClick={() => onUnblockUser(u.id)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-semibold py-2 rounded-lg"><Unlock size={13} /> Unblock</button>
                ) : (
                  <button onClick={() => onBlockUser(u.id)} className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-500 text-xs font-semibold py-2 rounded-lg"><Ban size={13} /> Block user</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "intelligence" && (
        <div className="px-5 mt-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="font-bold text-sm mb-2 flex items-center gap-2"><BarChart3 size={16} className="text-violet-600" /> Area-wise demand</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaDemand}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="area" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Kaha kis area me sabse jyada demand/requests aa rahe hain.</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="font-bold text-sm mb-2 flex items-center gap-2"><PieIcon size={16} className="text-violet-600" /> Category-wise shop distribution</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryDist} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="font-bold text-sm mb-2 flex items-center gap-2"><Award size={16} className="text-amber-500" /> Top performing shops</div>
            {topShops.map((s, i) => (
              <div key={s.id} className="flex justify-between items-center py-1.5 text-sm">
                <span className="text-gray-600">{i + 1}. {s.name} <span className="text-gray-400 text-xs">({s.area})</span></span>
                <span className="font-semibold text-amber-500 flex items-center gap-1"><Star size={12} fill="currentColor" /> {s.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "enterprise" && (
        <EnterpriseTab shops={shops} salesLog={salesLog} dataLicenses={dataLicenses} onGenerateLicense={onGenerateLicense} onRevokeLicense={onRevokeLicense} />
      )}
    </div>
  );
}

function EnterpriseTab({ shops, salesLog, dataLicenses, onGenerateLicense, onRevokeLicense }) {
  const [level, setLevel] = useState("city");
  const [category, setCategory] = useState("All");

  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr)];
    if (level === "shop") return shops.map((s) => ({ value: s.id, label: s.name }));
    if (level === "area") return uniq(shops.map((s) => s.area)).map((v) => ({ value: v, label: v }));
    if (level === "city") return uniq(shops.map((s) => s.city)).map((v) => ({ value: v, label: v }));
    if (level === "state") return uniq(shops.map((s) => s.state)).map((v) => ({ value: v, label: v }));
    return uniq(shops.map((s) => s.country)).map((v) => ({ value: v, label: v }));
  }, [level, shops]);

  const [value, setValue] = useState("");
  useEffect(() => { setValue(options[0]?.value || ""); }, [level, options.length]); // eslint-disable-line

  const scope = { level, value, category, valueLabel: options.find((o) => o.value === value)?.label };
  const filtered = value ? filterSalesLog(salesLog, scope) : [];
  const productData = aggregateByProduct(filtered);
  const totalQty = filtered.reduce((a, l) => a + l.qty, 0);
  const totalRevenue = filtered.reduce((a, l) => a + l.revenue, 0);

  return (
    <div className="px-5 mt-4 space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="font-bold text-sm mb-1 flex items-center gap-2"><IndianRupee size={16} className="text-emerald-600" /> Enterprise Data Access</div>
        <div className="text-[11px] text-gray-400 mb-3">Manufacturers/distributors ko exact scope ka data bechiye — shop se lekar poore country tak.</div>

        <div className="text-xs text-gray-500 font-medium mb-1">Geography level</div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {["shop", "area", "city", "state", "country"].map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize ${level === l ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"}`}>{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <select value={value} onChange={(e) => setValue(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="text-[11px] text-gray-400 mb-2">Live preview — {scopeLabel(scope)}</div>
          {productData.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">Is scope me abhi koi sales data nahi hai.</div>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productData.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="productName" tick={{ fontSize: 8 }} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-xs mt-2 text-gray-500">
                <span>Total units sold: <b className="text-gray-800">{totalQty}</b></span>
                <span>Revenue: <b className="text-gray-800">{formatINR(totalRevenue)}</b></span>
              </div>
            </>
          )}
        </div>

        <button
          disabled={!value}
          onClick={() => onGenerateLicense(scope)}
          className="w-full bg-emerald-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
        >
          <Send size={15} /> Generate Shareable Data Link
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="font-bold text-sm mb-3">Active Data Licenses</div>
        {dataLicenses.length === 0 && <div className="text-center text-gray-400 text-xs py-4">Abhi tak koi link generate nahi hua.</div>}
        <div className="space-y-2">
          {dataLicenses.map((lic) => (
            <div key={lic.id} className={`rounded-xl p-3 border ${lic.revoked ? "border-gray-100 bg-gray-50 opacity-60" : "border-emerald-100 bg-emerald-50"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-semibold text-gray-800">{scopeLabel(lic)}</div>
                  <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5">{lic.code}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Created {timeAgo(lic.createdAt)}</div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`shopnear.app/data/${lic.code}`); alert("Link copied: shopnear.app/data/" + lic.code); }}
                    className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-full font-semibold text-gray-600"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => onRevokeLicense(lic.id)}
                    className={`text-[10px] px-2 py-1 rounded-full font-semibold ${lic.revoked ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}
                  >
                    {lic.revoked ? "Restore" : "Revoke"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: screens/DataPortal.jsx
============================================================================ */

function DataPortal({ license, salesLog, onBack }) {
  const filtered = filterSalesLog(salesLog, license);
  const productData = aggregateByProduct(filtered);
  const totalQty = filtered.reduce((a, l) => a + l.qty, 0);
  const totalRevenue = filtered.reduce((a, l) => a + l.revenue, 0);
  const shopCount = new Set(filtered.map((l) => l.shopId)).size;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pt-6 pb-6 rounded-b-3xl text-white">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20} /></button>
        <div className="text-xs bg-white/20 inline-block px-2 py-1 rounded-full mb-2">LICENSED DATA VIEW</div>
        <div className="text-xl font-extrabold">{scopeLabel(license)}</div>
        <div className="text-white/80 text-xs mt-1">Code: {license.code}</div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <div className="text-lg font-extrabold text-emerald-600">{totalQty}</div>
          <div className="text-[10px] text-gray-400">Units sold</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <div className="text-lg font-extrabold text-violet-600">{formatINR(totalRevenue)}</div>
          <div className="text-[10px] text-gray-400">Revenue</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <div className="text-lg font-extrabold text-orange-500">{shopCount}</div>
          <div className="text-[10px] text-gray-400">Shops</div>
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-bold text-sm mb-2 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> Product-wise demand</div>
          {productData.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-6">Is scope me abhi data uplabdh nahi hai.</div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="productName" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 divide-y divide-gray-50">
                {productData.map((p) => (
                  <div key={p.productName} className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-600">{p.productName}</span>
                    <span className="font-semibold text-gray-800">{p.qty} units · {formatINR(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FILE: App.jsx  (root component — wires everything above together)
   Now backed by Supabase: shops/products/reviews/bids/offers/feed/sales/
   licenses/blocked-list/users all live in Postgres. Local React state is
   just a cache of what's in the DB, refreshed on load and updated after
   every write.
============================================================================ */

export default function App() {
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

  const changeTab = (key) => {
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
    { key: "deals", label: "Deals", icon: Flame },
    { key: "feed", label: "Feed", icon: Megaphone },
    { key: "bid", label: "Bid", icon: Gavel },
    { key: "profile", label: "Profile", icon: User },
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
        <DealsTab
          shops={shops}
          myShops={myShops}
          onStartFlashDeal={async (shopId, hours, amount, details) => {
            const expiresAt = Date.now() + hours * 60 * 60 * 1000;
            const flashDeal = { hours, expiresAt, ...details };
            await supabase.from("shops").update({ flash_deal: flashDeal }).eq("id", shopId);
            setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, flashDeal } : s)));
            alert(`₹${amount} paid (mock). "${details.productName}" pe Flash Deal live!`);
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
          onCreateBid={async (item, budget) => {
            const { data } = await supabase.from("bids").insert({ customer_id: user.id, customer_name: user.name, item, budget, area: AREAS[0] }).select().single();
            if (data) setBids((prev) => [{ id: data.id, customer: user.name, item, budget, area: AREAS[0], status: "open", createdAt: Date.now(), offers: [] }, ...prev]);
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
            const newPoints = user.points + 10, newStreak = user.streak + 1, now = new Date().toISOString();
            await supabase.from("users").update({ points: newPoints, streak: newStreak, last_check_in: now }).eq("id", user.id);
            setUser((u) => ({ ...u, points: newPoints, streak: newStreak, lastCheckIn: Date.now() }));
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
              address: form.address, phone: form.phone, city: "Surat", state: "Gujarat", country: "India",
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
          onDeleteShop={async (shopId) => {
            const { error } = await supabase.from("shops").delete().eq("id", shopId);
            if (error) { alert("Delete nahi ho paya: " + error.message); return; }
            setShops((prev) => prev.filter((s) => s.id !== shopId));
          }}
          onUpdatePrice={async (shopId, productId, price) => {
            const shop = shops.find((s) => s.id === shopId);
            const product = shop.products.find((p) => p.id === productId);
            const newHistory = [...product.history, { date: "Today", price }];
            await supabase.from("products").update({ price, history: newHistory, last_updated: new Date().toISOString() }).eq("id", productId);
            setShops((prev) => prev.map((s) => (s.id !== shopId ? s : {
              ...s,
              products: s.products.map((p) => (p.id !== productId ? p : { ...p, price, history: newHistory, lastUpdated: Date.now() })),
            })));
          }}
          onAddProduct={async (shopId, name, price, unit, stock, imageUrl, expiryDate) => {
            const { data } = await supabase.from("products").insert({ shop_id: shopId, name, price, unit, stock, history: [{ date: "Today", price }], image_url: imageUrl || null, expiry_date: expiryDate || null }).select().single();
            if (data) setShops((prev) => prev.map((s) => (s.id !== shopId ? s : { ...s, products: [...s.products, productFromRow(data)] })));
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

            await Promise.all(cartItems.map((item) => {
              const product = shop.products.find((p) => p.id === item.productId);
              const soldQty = item.unit === "piece" ? item.qty : item.baseQty;
              const newStock = +(product.stock - soldQty).toFixed(3);
              return supabase.from("products").update({ stock: newStock, last_updated: nowIso }).eq("id", item.productId);
            }));

            const salesRows = cartItems.map((item) => ({
              shop_id: shop.id, product_name: item.name,
              qty: item.unit === "piece" ? item.qty : +(item.baseQty * 1000).toFixed(0),
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
          }}
        />
      )}

      {["discover", "deals", "feed", "bid", "profile"].includes(screen) && (
        <BottomNav tabs={tabs} active={screen} onChange={changeTab} />
      )}
    </div>
  );
}
