import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const PERMS = [["sell", "Sell"], ["inventory", "Stock / Products"], ["reports", "Reports"], ["khata", "Udhar Khata"]];

// Owner-only. Every write goes through owner_set_staff / owner_revoke_staff RPCs which re-check ownership + Business Pro on the server.
export default function StaffManager({ shop, rank }) {
  const [rows, setRows] = useState([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("employee");
  const [perms, setPerms] = useState(["sell"]);
  const [msg, setMsg] = useState("");
  const load = async () => { const { data } = await supabase.rpc("owner_list_staff", { p_shop_id: shop.id }); setRows(data || []); };
  useEffect(() => { if (rank >= 2) load(); }, [shop.id, rank]); // eslint-disable-line
  if (rank < 2) return <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm"><div className="font-extrabold mb-1">Staff & Manager access</div><div className="text-xs text-gray-500">Ye feature Business Pro plan me hai. Plan activate karwane ke liye NearShop admin se sampark karein.</div></div>;
  const add = async () => {
    setMsg("");
    const { error } = await supabase.rpc("owner_set_staff", { p_shop_id: shop.id, p_username: username, p_role: role, p_permissions: role === "manager" ? [] : perms });
    if (error) return setMsg(error.message.includes("USER_NOT_FOUND") ? "Is username ka NearShop user nahi mila." : error.message.replace(/^.*?:\s*/, ""));
    setUsername(""); load();
  };
  const revoke = async (id) => { if (!window.confirm("Access hata dein?")) return; const { error } = await supabase.rpc("owner_revoke_staff", { p_staff_id: id }); if (error) setMsg(error.message); load(); };
  return <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
    <div className="font-extrabold text-sm">Staff & Manager — {shop.name}</div>
    {rows.filter((r) => !r.revoked_at).map((r) => <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-2.5"><div className="min-w-0"><div className="text-sm font-bold truncate">{r.name || r.username} <span className="text-[10px] text-gray-400">@{r.username}</span></div><div className="text-[10px] text-gray-500">{r.role} · {(r.permissions || []).join(", ")}</div></div><button onClick={() => revoke(r.id)} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg">Revoke</button></div>)}
    <div className="border-t pt-3 space-y-2">
      <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="Staff ka @username (NearShop user)" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
      <div className="grid grid-cols-2 gap-1">{["employee", "manager"].map((r) => <button key={r} onClick={() => setRole(r)} className={`rounded-lg py-2 text-xs font-bold ${role === r ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{r === "manager" ? "Manager (sab access)" : "Employee"}</button>)}</div>
      {role === "employee" && <div className="flex flex-wrap gap-1">{PERMS.map(([k, l]) => <button key={k} onClick={() => setPerms((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])} className={`rounded-full px-3 py-1.5 text-xs font-bold ${perms.includes(k) ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>)}</div>}
      <button disabled={!username || (role === "employee" && !perms.length)} onClick={add} className="w-full bg-violet-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl">Access do</button>
      {msg && <div className="text-xs text-red-600">{msg}</div>}
    </div>
  </div>;
}
