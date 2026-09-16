import React, { useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { formatINR, scopeLabel, aggregateByProduct } from "../../data/mockData";
import { Search, MapPin, ScanLine, Flame, Megaphone, Trophy, HomeIcon, User, Plus, Store, Phone, MessageCircle, Navigation, Star, TrendingUp, Gavel, Gift, UsersIcon, ShieldCheck, X, ChevronRight, Check, Ban, Unlock, Zap, Calendar, Award, Share2, ArrowLeft, Camera, IndianRupee, BarChart3, PieIcon, Package, Clock, Send, Lock, Trash2, Printer, Receipt, ShoppingCart, History, Key, Database, Download, LogOut, Minus, Mic, Wifi, Bell, Timer, CircleDollarSign, BadgePercent } from "../../shared/icons";

const PIE_COLORS = ["#7C3AED", "#F97316", "#10B981", "#3B82F6", "#EC4899", "#F59E0B"];

export function AdminPanel({ shops, users, bids, salesLog, dataLicenses, blockedList, onBlockShop, onUnblockShop, onBlockUser, onUnblockUser, onGenerateLicense, onRevokeLicense, onLogout }) {
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

export function EnterpriseTab({ shops, salesLog, dataLicenses, onGenerateLicense, onRevokeLicense }) {
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

export function DataPortal({ license, salesLog, onBack }) {
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

