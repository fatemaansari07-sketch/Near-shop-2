import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, X, Check, Plus } from "lucide-react";
import { formatINR } from "../../data/mockData";
import {
  getMyUsername, setUsername, findUser, createEntry, setStatus, loadShopKhata, loadCustomerKhata,
  linkCustomer, countPending, balanceOf, volumeOf, purchaseCount, countsInBalance, needsMyAction, signedAmount,
  cleanUsername, waLink, entryMessage, reminderMessage,
} from "./khataApi";

// Invite link (?inv=<shopId>) ko yaad rakho; login ke baad customer shop se link ho jata hai.
try {
  const inv = new URLSearchParams(window.location.search).get("inv");
  if (inv && /^[0-9a-f-]{36}$/i.test(inv)) localStorage.setItem("ns_inv", inv);
} catch {}

// Badge ke liye: kitni entries par meri taraf se action baaki hai. Invite link bhi yahin process hota hai.
export function useKhataBackground(user, shops) {
  const [pending, setPending] = useState(0);
  const ids = (shops || []).filter((s) => s.owner_id === user?.id).map((s) => s.id).join(",");
  useEffect(() => {
    if (!user?.id) return;
    try { const inv = localStorage.getItem("ns_inv"); if (inv) { linkCustomer(inv, user.id); localStorage.removeItem("ns_inv"); } } catch {}
    let alive = true;
    const tick = async () => { try { const n = await countPending(user.id, ids ? ids.split(",") : []); if (alive) setPending(n); } catch {} };
    tick();
    const t = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [user?.id, ids]);
  return pending;
}

const money = (n) => formatINR(Math.abs(n));
const dateStr = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const MEDAL = ["🥇", "🥈", "🥉"];

function balanceText(bal, role) {
  if (Math.abs(bal) < 0.005) return { text: "Hisaab barabar ✅", cls: "text-emerald-600" };
  const customerOwes = bal > 0;
  if (role === "shop") return customerOwes ? { text: `Aapko lena hai ${money(bal)}`, cls: "text-red-500" } : { text: `Aapko dena hai ${money(bal)}`, cls: "text-orange-500" };
  return customerOwes ? { text: `Aapko dena hai ${money(bal)}`, cls: "text-red-500" } : { text: `Aapko lena hai ${money(bal)}`, cls: "text-orange-500" };
}
function describe(e, role) {
  const other = role === "shop" ? "Customer" : "Dukaan";
  if (e.kind === "sale") return "Kharid (paid)";
  if (e.kind === "udhar") return e.party === role ? "Aapko dena hai (udhar)" : `${other} ko dena hai (udhar)`;
  return e.party === role ? "Aapne paise diye" : `${other} ne paise diye`;
}
const statsOf = (p) => ({
  bal: balanceOf(p.entries), vol: volumeOf(p.entries), n: purchaseCount(p.entries),
  last: p.entries.reduce((m, e) => Math.max(m, new Date(e.created_at).getTime()), 0),
});

// Shop dashboard me dikhne wala chhota summary card.
export function KhataSummaryCard({ shops = [], onOpen }) {
  const [info, setInfo] = useState(null);
  const key = shops.map((s) => s.id).join(",");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = new Map(); let pend = 0;
        for (const sh of shops) {
          const r = await loadShopKhata(sh.id);
          r.entries.forEach((e) => { const k = `${e.shop_id}|${e.customer_id || "L:" + e.customer_label}`; if (!m.has(k)) m.set(k, []); m.get(k).push(e); if (needsMyAction(e, "shop")) pend++; });
        }
        let due = 0, n = 0;
        m.forEach((list) => { const b = balanceOf(list); if (b > 0.005) { due += b; n++; } });
        if (alive) setInfo({ due, n, pend });
      } catch {}
    })();
    return () => { alive = false; };
  }, [key]); // eslint-disable-line
  return <button onClick={onOpen} className="w-full text-left bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
    <div><div className="font-extrabold text-sm">📒 Udhar Khata</div><div className="text-xs text-gray-500 mt-0.5">{info ? (info.n ? `${info.n} customer ka ${money(info.due)} baaki` : "Abhi koi udhar baaki nahi ✅") : "Dekhne ke liye tap kariye"}</div></div>
    <div className="flex items-center gap-2">{info?.pend > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{info.pend} new</span>}<span className="text-amber-600 font-bold text-lg">›</span></div>
  </button>;
}

function AddCustomer({ shopId, onClose, onPick }) {
  const [q, setQ] = useState(""), [name, setName] = useState(""), [phone, setPhone] = useState(""), [found, setFound] = useState(null), [msg, setMsg] = useState("");
  const search = async () => { setMsg(""); const u = await findUser(q); setFound(u); if (!u) setMsg("Is username ka koi user nahi mila."); };
  const copyInvite = async () => {
    const link = `${window.location.origin}/?inv=${shopId}`;
    try { await navigator.clipboard.writeText(link); alert("Invite link copy ho gaya:\n" + link); } catch { prompt("Ye link copy karein:", link); }
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5">
    <div className="flex justify-between mb-3"><b>Naya customer</b><button onClick={onClose}><X size={18}/></button></div>
    <div className="text-xs text-gray-500 mb-1">App wale customer ka username</div>
    <div className="flex gap-2 mb-2"><input value={q} onChange={(e) => setQ(cleanUsername(e.target.value))} placeholder="@username" className="flex-1 border rounded-xl px-3 py-2 text-sm"/><button onClick={search} className="bg-violet-600 text-white px-4 rounded-xl text-sm font-bold">Dhundo</button></div>
    {found && <button onClick={() => { linkCustomer(shopId, found.id); onPick({ customerId: found.id, name: found.name, username: found.username, phone: found.phone }); }} className="w-full text-left bg-emerald-50 rounded-xl p-3 mb-2 text-sm"><b>{found.name}</b> @{found.username} — chuniye</button>}
    {msg && <div className="text-xs text-red-500 mb-2">{msg}</div>}
    <div className="text-xs text-gray-500 mt-3 mb-1">Ya app ke bina customer: naam + WhatsApp number (sirf aapko dikhega)</div>
    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer ka naam" className="w-full border rounded-xl px-3 py-2 text-sm mb-2"/>
    <div className="flex gap-2"><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="Mobile number (optional)" className="flex-1 border rounded-xl px-3 py-2 text-sm"/><button disabled={!name.trim()} onClick={() => onPick({ customerId: null, label: name.trim(), name: name.trim(), phone: phone || null })} className="bg-gray-800 disabled:opacity-40 text-white px-4 rounded-xl text-sm font-bold">Add</button></div>
    <button onClick={copyInvite} className="w-full mt-4 bg-violet-50 text-violet-700 py-2.5 rounded-xl text-sm font-bold">🔗 Invite link copy karo (customer khud judega)</button>
  </div></div>;
}

export default function KhataScreen({ user, myShops = [], onBack }) {
  const hasShop = myShops.length > 0;
  const [mode, setMode] = useState(hasShop ? "shop" : "me");
  const role = mode === "shop" ? "shop" : "customer";
  const [shopId, setShopId] = useState(myShops[0]?.id || null);
  const shopName = myShops.find((s) => s.id === shopId)?.name || "Dukaan";
  const [entries, setEntries] = useState([]);
  const [links, setLinks] = useState([]);
  const [sel, setSel] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [adding, setAdding] = useState(false);
  const [uname, setUname] = useState("");
  const [unameInput, setUnameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sortMode, setSortMode] = useState("baaki");
  const [saved, setSaved] = useState(null); // {href}

  const reload = useCallback(async () => {
    if (mode === "shop" && shopId) { const r = await loadShopKhata(shopId); setEntries(r.entries); setLinks(r.links); }
    else if (mode === "me") { setEntries(await loadCustomerKhata(user.id)); setLinks([]); }
  }, [mode, shopId, user.id]);
  useEffect(() => { reload(); const t = setInterval(reload, 20000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { getMyUsername(user.id).then(setUname); }, [user.id]);
  useEffect(() => { setSel(null); setSaved(null); }, [mode, shopId]);

  // ---- parties ----
  const parties = (() => {
    const m = new Map();
    const get = (key, init) => { if (!m.has(key)) m.set(key, { key, ...init, entries: [] }); return m.get(key); };
    if (mode === "shop") {
      links.forEach((l) => get(l.customer_id, { customerId: l.customer_id, shopId, name: l.users?.name, username: l.users?.username, phone: l.users?.phone }));
      entries.forEach((e) => {
        const p = get(e.customer_id || `L:${(e.customer_label || "").toLowerCase()}`, { customerId: e.customer_id, label: e.customer_label, shopId, name: e.users?.name || e.customer_label, username: e.users?.username, phone: e.users?.phone || e.customer_phone });
        if (!p.phone && (e.users?.phone || e.customer_phone)) p.phone = e.users?.phone || e.customer_phone;
        p.entries.push(e);
      });
    } else {
      entries.forEach((e) => get(e.shop_id, { customerId: user.id, shopId: e.shop_id, name: e.shops?.name || "Dukaan", phone: e.shops?.phone }).entries.push(e));
    }
    return [...m.values()].map((p) => ({ ...p, ...statsOf(p) }));
  })();
  const current = sel ? parties.find((p) => p.key === sel.key) || { ...sel, entries: [], bal: 0, vol: 0, n: 0 } : null;
  const pendingFor = (p) => p.entries.filter((e) => needsMyAction(e, role)).length;
  const topKeys = [...parties].filter((p) => p.vol > 0).sort((a, b) => b.vol - a.vol).slice(0, 3).map((p) => p.key);

  // ---- grouping for the list ----
  const dues = parties.filter((p) => p.bal > 0.005).sort((a, b) => b.bal - a.bal);
  const owes = parties.filter((p) => p.bal < -0.005).sort((a, b) => a.bal - b.bal);
  const settled = parties.filter((p) => Math.abs(p.bal) <= 0.005).sort((a, b) => b.last - a.last);
  const totalDue = dues.reduce((s, p) => s + p.bal, 0);
  const groups = sortMode === "loyal"
    ? [{ title: "🏆 Loyal customers (kul len-den ke hisaab se)", list: [...parties].sort((a, b) => b.vol - a.vol) }]
    : role === "shop"
      ? [{ title: `⏳ Baaki — aapko lena hai (${dues.length})`, list: dues }, { title: `↩️ Aapko dena hai (${owes.length})`, list: owes }, { title: `✅ Settled — hisaab barabar (${settled.length})`, list: settled }]
      : [{ title: `⏳ Aapko dena hai (${dues.length})`, list: dues }, { title: `↩️ Aapko lena hai (${owes.length})`, list: owes }, { title: `✅ Settled (${settled.length})`, list: settled }];

  // ---- actions ----
  const saveUsername = async () => {
    const r = await setUsername(user.id, unameInput);
    if (r.error) { alert(r.error); return; }
    setUname(r.username); setUnameInput("");
  };
  const submitSheet = async () => {
    if (!current || !sheet) return;
    setBusy(true);
    const r = await createEntry({
      shopId: current.shopId, customerId: current.customerId || null, customerLabel: current.label || current.name, customerPhone: current.phone || null,
      kind: sheet.kind, party: sheet.party, amount: sheet.amount, note: sheet.note, createdBy: role,
    });
    setBusy(false);
    if (r.error) { alert(r.error); return; }
    if (role === "shop" && current.phone) {
      const newBal = balanceOf([...current.entries, { ...r.data, status: r.data.status }]);
      setSaved({ href: waLink(current.phone, entryMessage(r.data, shopName, current.name || "Customer", newBal)) });
    }
    setSheet(null); reload();
  };
  const act = async (id, status) => { const r = await setStatus(id, status); if (r.error) alert(r.error); reload(); };

  const Row = ({ p }) => {
    const bt = balanceText(p.bal, role), pc = pendingFor(p);
    const rank = topKeys.indexOf(p.key);
    const wa = role === "shop" && p.bal > 0.005 && p.phone ? waLink(p.phone, reminderMessage(shopName, p.name || "Customer", p.bal)) : "";
    return <div onClick={() => { setSel(p); setSaved(null); }} className="w-full text-left bg-white rounded-2xl border p-3 flex justify-between items-center cursor-pointer active:bg-gray-50">
      <span className="min-w-0">
        <b className="text-sm block truncate">{rank >= 0 && sortMode === "loyal" ? MEDAL[rank] + " " : ""}{p.name || "Customer"}{p.username ? <span className="text-gray-400 font-normal"> @{p.username}</span> : null}</b>
        <small className={`${bt.cls} font-semibold`}>{bt.text}</small>
        <small className="block text-gray-400 text-[11px] mt-0.5">{p.vol > 0 ? `Kul len-den ${money(p.vol)} · ${p.n} baar` : "Abhi koi kharid nahi"}{p.last ? ` · ${dateStr(p.last)}` : ""}</small>
      </span>
      <span className="flex items-center gap-2 flex-shrink-0">
        {pc > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{pc} new</span>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg">📲 Yaad dilao</a>}
      </span>
    </div>;
  };

  const bal = current ? current.bal : 0;
  const mine = role, other = role === "shop" ? "customer" : "shop";
  const detailWa = current?.phone ? waLink(current.phone, role === "shop"
    ? (bal > 0.005 ? reminderMessage(shopName, current.name || "Customer", bal) : `Namaste ${current.name || ""} ji, ${shopName} se hisaab barabar hai ✅ Dhanyavaad 🙏 (NearShop)`)
    : `Namaste, ${current.name || "dukaan"} — NearShop pe mera hisaab: ${bal > 0.005 ? `${money(bal)} baaki hai.` : "barabar hai."}`) : "";

  return <div className="min-h-screen bg-gray-50 pb-10">
    <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-5 pt-6 pb-5 rounded-b-3xl text-white">
      <button onClick={current ? () => setSel(null) : onBack} className="mb-3"><ArrowLeft size={20}/></button>
      <div className="text-2xl font-extrabold">📒 Udhar Khata</div>
      <div className="text-white/80 text-xs mt-0.5">{uname ? `Aapka username: @${uname}` : "Username set karo taaki dukaan aapko dhundh sake"}</div>
      {hasShop && !current && <div className="flex gap-2 mt-3">{[["shop", "Meri Dukaan"], ["me", "Mera Khata"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === k ? "bg-white text-violet-700" : "bg-white/20"}`}>{l}</button>)}</div>}
      {!current && parties.length > 0 && <div className="grid grid-cols-2 gap-2 mt-3"><div className="bg-white/15 rounded-xl p-2.5"><div className="text-[10px] text-white/70">{role === "shop" ? "Kul baaki (lena hai)" : "Kul dena hai"}</div><div className="font-extrabold text-lg">{money(totalDue)}</div></div><div className="bg-white/15 rounded-xl p-2.5"><div className="text-[10px] text-white/70">Customers / baaki wale</div><div className="font-extrabold text-lg">{parties.length} / {dues.length}</div></div></div>}
    </div>

    <div className="px-5 mt-4 space-y-2">
      {!uname && !current && <div className="bg-white rounded-2xl border p-3"><div className="text-xs text-gray-500 mb-2">Apna username banao (a-z, 0-9, _ ; 3-20 akshar)</div><div className="flex gap-2"><input value={unameInput} onChange={(e) => setUnameInput(cleanUsername(e.target.value))} placeholder="@username" className="flex-1 border rounded-xl px-3 py-2 text-sm"/><button onClick={saveUsername} className="bg-violet-600 text-white px-4 rounded-xl text-sm font-bold">Save</button></div></div>}

      {!current && <>
        {mode === "shop" && myShops.length > 1 && <select value={shopId || ""} onChange={(e) => setShopId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm bg-white">{myShops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        {mode === "shop" && <button onClick={() => setAdding(true)} className="w-full bg-white border rounded-2xl p-3 flex items-center justify-center gap-2 text-sm font-bold text-violet-700"><Plus size={16}/> Naya customer / Invite link</button>}
        {parties.length > 1 && <div className="flex gap-2">{[["baaki", "⏳ Baaki pehle"], ["loyal", "🏆 Loyal pehle"]].map(([k, l]) => <button key={k} onClick={() => setSortMode(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${sortMode === k ? "bg-violet-600 text-white" : "bg-white border text-gray-600"}`}>{l}</button>)}</div>}
        {parties.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">{mode === "shop" ? "Abhi koi customer nahi. Sale me customer jodo ya upar se add karo." : "Abhi kisi dukaan ke saath koi hisaab nahi."}</div>}
        {groups.map((g) => g.list.length > 0 && <div key={g.title}><div className="text-[11px] font-bold text-gray-500 mt-3 mb-1.5">{g.title}</div><div className="space-y-2">{g.list.map((p) => <Row key={p.key} p={p}/>)}</div></div>)}
      </>}

      {current && <>
        {saved?.href && <a href={saved.href} target="_blank" rel="noreferrer" className="block bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-3 text-sm font-bold text-center">✅ Entry save ho gayi — 📲 WhatsApp pe bhi bhejo</a>}
        <div className="bg-white rounded-2xl border p-4 text-center"><div className="font-bold">{current.name || "Customer"}{current.username ? <span className="text-gray-400 font-normal text-sm"> @{current.username}</span> : null}</div><div className={`text-xl font-extrabold mt-1 ${balanceText(bal, role).cls}`}>{balanceText(bal, role).text}</div><div className="text-[11px] text-gray-400 mt-1">Kul len-den {money(current.vol || 0)} · {current.n || 0} baar{topKeys.indexOf(current.key) >= 0 ? ` · ${MEDAL[topKeys.indexOf(current.key)]} Top customer` : ""}</div></div>
        <div className="flex gap-2"><button onClick={() => setSheet({ kind: "udhar", party: other, amount: "", note: "" })} className="flex-1 bg-white border rounded-2xl py-3 text-sm font-bold text-orange-600">➕ Udhar likho</button><button onClick={() => setSheet({ kind: "payment", party: mine, amount: "", note: "" })} className="flex-1 bg-emerald-600 text-white rounded-2xl py-3 text-sm font-bold">💵 Pay / Paise</button></div>
        {detailWa ? <a href={detailWa} target="_blank" rel="noreferrer" className="block text-center bg-white border border-emerald-300 text-emerald-700 rounded-2xl py-2.5 text-sm font-bold">📲 WhatsApp pe {role === "shop" && bal > 0.005 ? "yaad dilao" : "message bhejo"}</a> : (role === "shop" && <div className="text-[11px] text-gray-400 text-center">WhatsApp ke liye is customer ka number nahi hai (naya customer add karte waqt number daalo).</div>)}
        {current.entries.length === 0 && <div className="text-center text-gray-400 text-sm mt-6">Abhi koi entry nahi.</div>}
        {current.entries.map((e) => { const sa = signedAmount(e) * (role === "shop" ? 1 : -1); return <div key={e.id} className="bg-white rounded-2xl border p-3"><div className="flex justify-between items-start"><div className="min-w-0"><div className="text-sm font-semibold">{describe(e, role)}</div><div className="text-[11px] text-gray-400">{dateStr(e.created_at)}{e.note ? ` · ${e.note}` : ""}</div></div><b className={e.kind === "sale" ? "text-gray-700" : sa > 0 ? "text-red-500" : "text-emerald-600"}>{formatINR(e.amount)}</b></div>
          {e.kind !== "sale" && <div className="mt-2 flex items-center justify-between">
            <span className={`text-[11px] font-bold ${e.status === "confirmed" ? "text-emerald-600" : e.status === "disputed" ? "text-red-500" : "text-amber-600"}`}>{e.status === "confirmed" ? "✅ Confirmed" : e.status === "disputed" ? "❌ Dispute" : countsInBalance(e) ? "⏳ Confirm baaki (hisaab me ginti hai)" : needsMyAction(e, role) ? "⏳ Aapka confirm chahiye" : "⏳ Samne wale ke confirm ka intezar"}</span>
            {needsMyAction(e, role) && <div className="flex gap-2"><button onClick={() => act(e.id, "confirmed")} className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Check size={12}/> Sahi hai</button><button onClick={() => act(e.id, "disputed")} className="bg-red-50 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg">Galat hai</button></div>}
          </div>}</div>; })}
      </>}
    </div>

    {adding && <AddCustomer shopId={shopId} onClose={() => setAdding(false)} onPick={(p) => { setAdding(false); setSel({ key: p.customerId || `L:${p.label.toLowerCase()}`, ...p, shopId }); }} />}
    {sheet && <div className="fixed inset-0 z-50 bg-black/50 flex items-end"><div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5">
      <div className="flex justify-between mb-3"><b>{sheet.kind === "udhar" ? "Udhar likho" : "Payment (Pay)"}</b><button onClick={() => setSheet(null)}><X size={18}/></button></div>
      <div className="flex gap-2 mb-3">{(sheet.kind === "udhar" ? [[mine, "Mujhe dena hai"], [other, "Unhe dena hai"]] : [[mine, "Maine paise diye"], [other, "Mujhe paise mile"]]).map(([p, l]) => <button key={p} onClick={() => setSheet({ ...sheet, party: p })} className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${sheet.party === p ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}>{l}</button>)}</div>
      <input type="number" min="0" value={sheet.amount} onChange={(e) => setSheet({ ...sheet, amount: e.target.value })} placeholder="Amount ₹" className="w-full border rounded-xl px-3 py-3 text-xl font-extrabold text-center mb-2"/>
      <input value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} placeholder="Note (optional)" className="w-full border rounded-xl px-3 py-2 text-sm mb-3"/>
      <div className="text-[11px] text-gray-400 mb-3">{current?.customerId ? "Samne wale ko notification jayega; wo 'Sahi hai' dabayega tab hisaab pakka hoga." : "Ye customer app me nahi hai, isliye entry seedha pakki hogi."}</div>
      <button disabled={busy || !(Number(sheet.amount) > 0)} onClick={submitSheet} className="w-full bg-emerald-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl">{busy ? "Saving…" : "Save"}</button>
    </div></div>}
  </div>;
}
