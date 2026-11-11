import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { FEATURE_LIST, DEFAULT_PLANS } from "../../lib/platform";

// Admin: Live/Off per advertising feature, editable plan prices/limits, and manual (admin-activated) subscriptions.
// All writes go through password-verified RPCs. Turning a feature Off never deletes old data.
export default function FeatureAndPlanAdmin({ adminPassword, users = [] }) {
  const [flags, setFlags] = useState({});
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [subs, setSubs] = useState([]);
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState({ owner: "", plan: "multi_shop", months: 1 });
  const load = async () => {
    const [f, p, s] = await Promise.all([
      supabase.from("platform_settings").select("settings").eq("id", "features").maybeSingle(),
      supabase.from("platform_settings").select("settings").eq("id", "plans").maybeSingle(),
      supabase.rpc("admin_list_subscriptions", { p_password: adminPassword }),
    ]);
    if (f.data?.settings) setFlags(f.data.settings);
    if (p.data?.settings) setPlans({ ...DEFAULT_PLANS, ...p.data.settings });
    setSubs(s.data || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const save = async (id, settings) => {
    const { data, error } = await supabase.rpc("admin_update_platform_setting", { p_password: adminPassword, p_id: id, p_settings: settings });
    setMsg(error || data !== true ? "Save nahi hua. Migration 20261110 run hui? " + (error?.message || "") : "Saved ✔");
    return !error && data === true;
  };
  const toggle = async (key) => { const next = { ...flags, [key]: flags[key] === false }; if (await save("features", next)) setFlags(next); };
  const setPlan = (k, f, v) => setPlans((p) => ({ ...p, [k]: { ...p[k], [f]: Math.max(0, Number(v) || 0) } }));
  const activate = async () => {
    if (!pick.owner) return;
    const until = pick.plan === "free" ? null : new Date(Date.now() + pick.months * 30 * 86400000).toISOString();
    const { data, error } = await supabase.rpc("admin_set_subscription", { p_password: adminPassword, p_owner_id: pick.owner, p_plan: pick.plan, p_valid_until: until, p_note: "admin activated" });
    setMsg(error || data !== true ? "Activate nahi hua: " + (error?.message || "") : "Plan activate ho gaya ✔"); load();
  };
  const nameOf = (id) => users.find((u) => u.id === id)?.name || id.slice(0, 8);
  return <div className="px-5 mt-4 space-y-4">
    {msg && <div className="text-xs bg-white border rounded-xl p-2">{msg}</div>}
    <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-1">Feature Management</div><div className="text-[11px] text-gray-400 mb-2">Off karne par shopkeeper ko option nahi dikhta aur database naye broadcast/promotion reject karta hai. Purana data safe rehta hai. Prices "pricing" tab me.</div>
      {FEATURE_LIST.map(([k, label]) => { const on = flags[k] !== false; return <div key={k} className="flex items-center justify-between py-2.5 border-b border-gray-50"><span className="text-sm">{label}</span><button onClick={() => toggle(k)} className={`px-4 py-1.5 rounded-full text-xs font-bold ${on ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"}`}>{on ? "LIVE" : "OFF"}</button></div>; })}</div>
    <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-2">Plans (price & shop limit)</div>
      {["free", "multi_shop", "business_pro"].map((k) => <div key={k} className="mb-2"><div className="text-xs font-bold">{plans[k]?.label}</div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-gray-500">₹/month<input type="number" value={plans[k]?.price ?? 0} onChange={(e) => setPlan(k, "price", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm"/></label><label className="text-[10px] text-gray-500">Max shops<input type="number" value={plans[k]?.max_shops ?? 1} onChange={(e) => setPlan(k, "max_shops", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm"/></label></div></div>)}
      <button onClick={() => save("plans", plans)} className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl">Plans save karo</button></div>
    <div className="bg-white rounded-2xl p-4 border border-gray-100"><div className="font-extrabold text-sm mb-1">Activate subscription (manual)</div><div className="text-[11px] text-gray-400 mb-2">Payment gateway connected nahi hai. Payment mil jaane ke baad yahin se plan activate karein.</div>
      <select value={pick.owner} onChange={(e) => setPick({ ...pick, owner: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm mb-2"><option value="">Owner chuniye</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email || u.phone}</option>)}</select>
      <div className="grid grid-cols-2 gap-2 mb-2"><select value={pick.plan} onChange={(e) => setPick({ ...pick, plan: e.target.value })} className="border rounded-xl px-3 py-2.5 text-sm">{["free", "multi_shop", "business_pro"].map((k) => <option key={k} value={k}>{plans[k]?.label}</option>)}</select><input type="number" min="1" value={pick.months} onChange={(e) => setPick({ ...pick, months: Math.max(1, Number(e.target.value) || 1) })} className="border rounded-xl px-3 py-2.5 text-sm" placeholder="Months"/></div>
      <button disabled={!pick.owner} onClick={activate} className="w-full bg-emerald-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl">Activate</button>
      <div className="mt-3">{subs.map((s) => <div key={s.owner_id} className="text-xs flex justify-between py-1.5 border-b border-gray-50"><span>{nameOf(s.owner_id)}</span><span>{s.plan} · {s.valid_until ? new Date(s.valid_until).toLocaleDateString() : "no expiry"}</span></div>)}</div></div>
  </div>;
}
