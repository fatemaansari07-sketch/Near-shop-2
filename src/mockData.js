import { getInventoryMeta } from "../lib/inventory";

export const AREAS = ["Ring Road", "Adajan", "Varachha", "Vesu", "Katargam", "Piplod"];
export const CATEGORIES = ["Pharmacy", "Paint", "Clothing", "Footwear", "Electronics"];

// Mock barcode database — in a real backend this would call an external barcode/product API
export const BARCODE_DB = [
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
export const SPONSORED_ADS = [
  { id: "ad1", brand: "Amul", tagline: "Taaza Amul Milk — abhi order karo apne najdiki store se", emoji: "🥛", color: "from-blue-500 to-blue-600" },
  { id: "ad2", brand: "Colgate", tagline: "Colgate Strong Teeth — 20% off is hafte", emoji: "🦷", color: "from-red-500 to-rose-600" },
  { id: "ad3", brand: "Patel Electronics", tagline: "Power banks pe best price — Adajan me abhi available", emoji: "🔋", color: "from-slate-600 to-slate-700" },
  { id: "ad4", brand: "Krishna General Store", tagline: "Fresh vegetables aaj subah aayi — Ring Road", emoji: "🥦", color: "from-emerald-500 to-teal-600" },
];

// Self-serve "Search Ad" pricing — distinct from Flash Deal. Price scales with
// reach: a shop can only target the geography it actually sits in (its own
// area/city/state/country), so wider reach costs more. All run for 24 hours.
export const SEARCH_AD_PRICING = { area: 10, city: 25, state: 75, country: 150 };
export const SEARCH_AD_LEVEL_LABEL = { area: "Area (najdik mohalla)", city: "Poora City", state: "Poora State", country: "Poora Country" };

export const INITIAL_SHOPS = [
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

export const INITIAL_BIDS = [
  {
    id: "b1", customer: "You", item: "iPhone charger 20W (original)", budget: 900, area: "Ring Road",
    status: "open", createdAt: Date.now() - 1000 * 60 * 30,
    offers: [{ shopId: "s2", shopName: "Patel Electronics", price: 850, message: "Stock available, aa jaiye!" }],
  },
];

export const INITIAL_FEED = [
  { id: "f1", shopName: "Krishna General Store", text: "Fresh vegetables aa gayi hain aaj subah! 🥦🥕", likes: 12, time: Date.now() - 1000 * 60 * 60 * 2 },
  { id: "f2", shopName: "Sundaram Bakery", text: "Weekend special: Buy 2 pastry get 1 free 🎂", likes: 27, time: Date.now() - 1000 * 60 * 60 * 5 },
];

export const CURRENT_USER_SEED = {
  id: "u1", name: "Khan Saheb", phone: "9998887770", role: "customer",
  points: 340, streak: 4, lastCheckIn: null, isBlocked: false,
  referralCode: "KHAN340", myShopIds: ["s1", "s2"],
};

// Every completed POS sale gets logged here — this is the raw feed the
// enterprise "Market Intelligence" data-licensing layer is built on top of.
export const daysAgo = (n) => Date.now() - n * 24 * 60 * 60 * 1000;
export const INITIAL_SALES_LOG = [
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

export const formatINR = (n) => `₹${n.toLocaleString("en-IN")}`;
export const timeAgo = (ts) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
export const genId = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

// Haversine distance in km between two lat/lng points
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lat2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
export const formatKm = (km) => (km == null ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// ---- Enterprise data-licensing helpers ----
// Filters the raw sales log down to whatever scope a data license grants access to.
export const filterSalesLog = (salesLog, scope) =>
  salesLog.filter((l) => {
    if (scope.category && scope.category !== "All" && l.category !== scope.category) return false;
    if (scope.level === "shop") return l.shopId === scope.value;
    if (scope.level === "area") return l.area === scope.value;
    if (scope.level === "city") return l.city === scope.value;
    if (scope.level === "state") return l.state === scope.value;
    if (scope.level === "country") return l.country === scope.value;
    return true;
  });

export const aggregateByProduct = (logs) => {
  const map = {};
  logs.forEach((l) => {
    if (!map[l.productName]) map[l.productName] = { productName: l.productName, qty: 0, revenue: 0 };
    map[l.productName].qty += l.qty;
    map[l.productName].revenue += l.revenue;
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty);
};

export const scopeLabel = (scope) => {
  const levelLabel = { shop: "Shop", area: "Area", city: "City", state: "State", country: "Country" }[scope.level];
  const catLabel = scope.category && scope.category !== "All" ? ` · ${scope.category}` : "";
  return `${levelLabel}: ${scope.valueLabel || scope.value}${catLabel}`;
};

// ---- Supabase row <-> app-shape mappers ----
// DB columns are snake_case; the rest of the app (all the components below)
// expects the camelCase shape that used to come from the mock data. These
// keep that boundary in one place so nothing else has to change.
export const shopFromRow = (row, products, reviews) => ({
  ...row,
  isBlocked: row.is_blocked,
  isClaimed: row.is_claimed,
  premiumReviews: row.premium_reviews,
  flashDeal: row.flash_deal,
  products: (products || []).filter((p) => p.shop_id === row.id).map(productFromRow),
  reviews: (reviews || []).filter((r) => r.shop_id === row.id).map(reviewFromRow),
});
export const productFromRow = (row) => ({ ...row, packSize: getInventoryMeta(row.id).packSize || row.pack_size || null, lastUpdated: new Date(row.last_updated).getTime(), imageUrl: row.image_url, expiryDate: row.expiry_date, barcode: row.barcode });
export const daysToExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};
// Loose-quantity units: how the owner enters quantity at POS vs. how stock is stored
export const UNIT_META = {
  pack: { enteredLabel: "tablets ya strips", enteredShort: "tab/strip", divisor: 1, stockUnit: "strip" },
  weight: { enteredLabel: "grams", enteredShort: "g", divisor: 1000, stockUnit: "kg" },
  volume: { enteredLabel: "ml", enteredShort: "ml", divisor: 1000, stockUnit: "L" },
  length: { enteredLabel: "cm", enteredShort: "cm", divisor: 100, stockUnit: "m" },
};
export const reviewFromRow = (row) => ({ id: row.id, user: row.user_name, rating: row.rating, text: row.text, reply: row.reply });
export const bidFromRow = (row, offers, shopsById) => ({
  id: row.id, customer: row.customer_name, item: row.item, budget: Number(row.budget),
  area: row.area, status: row.status, createdAt: new Date(row.created_at).getTime(),
  offers: (offers || []).filter((o) => o.bid_id === row.id).map((o) => ({
    shopId: o.shop_id, shopName: shopsById[o.shop_id]?.name || "Shop", price: Number(o.price), message: o.message,
  })),
});

/* ============================================================================
   FILE: components/InterstitialAd.jsx
============================================================================ */


export const PIE_COLORS = ["#7C3AED", "#F97316", "#10B981", "#3B82F6", "#EC4899", "#F59E0B"];
