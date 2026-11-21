import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { timeAgo } from "../../data/mockData";
import { SERVICE_CATEGORIES, iconOf, isProperty, safeImg, telHref, waHref, isFeatured, toDataUrl } from "./serviceData";

const LIST_COLS = "id,owner_id,category,name,about,experience_years,city,area,phone,whatsapp,rate_note,photo_url,status,featured_until,created_at";
const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none";
const STATUS = { pending: ["Approval baaki", "bg-amber-100 text-amber-700"], approved: ["Live ✅", "bg-emerald-100 text-emerald-700"], rejected: ["Reject hua", "bg-red-100 text-red-600"], blocked: ["Band", "bg-gray-200 text-gray-600"] };
const Stars = ({ v }) => <span className="text-amber-500 text-xs font-bold">★ {v ? Number(v).toFixed(1) : "New"}</span>;

function Avatar({ p, size = 48 }) {
  const img = safeImg(p.photo_url);
  return img ? <img src={img} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    : <div style={{ width: size, height: size }} className="rounded-full bg-violet-100 flex items-center justify-center text-xl shrink-0">{iconOf(p.category)}</div>;
}

function Detail({ p, me, rating, onClose, onChanged }) {
  const [full, setFull] = useState(p);
  const [reviews, setReviews] = useState(null);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const mine = p.owner_id === me;
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("service_profiles").select("work_photos").eq("id", p.id).maybeSingle(),
      supabase.from("service_reviews").select("*").eq("profile_id", p.id).order("created_at", { ascending: false }),
    ]);
    if (a.data) setFull((f) => ({ ...f, ...a.data }));
    setReviews(b.data || []);
  }, [p.id]);
  useEffect(() => { load(); }, [load]);
  const submit = async () => {
    setMsg("");
    const { error } = await supabase.from("service_reviews").upsert({ profile_id: p.id, user_id: me, rating: stars, comment: text.trim() || null }, { onConflict: "profile_id,user_id" });
    if (error) return setMsg(error.message);
    setText(""); await load(); onChanged?.();
  };
  const report = async () => {
    const reason = window.prompt("Kya dikkat hai? (jaise: fake profile, galat number, dhokha)");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.from("service_reports").insert({ profile_id: p.id, user_id: me, reason: reason.trim().slice(0, 300) });
    setMsg(error ? (error.code === "23505" ? "Aap pehle hi report kar chuke hain." : error.message) : "Report bhej di gayi. Admin dekhega. Dhanyavaad.");
  };
  const photos = (full.work_photos || []).map(safeImg).filter(Boolean);
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between"><div className="flex gap-3 min-w-0"><Avatar p={p} size={56} /><div className="min-w-0">
        <div className="font-extrabold text-lg truncate">{p.name}</div>
        <div className="text-xs text-gray-500">{iconOf(p.category)} {p.category}</div>
        <div className="mt-0.5"><Stars v={rating?.avg_rating} /> <span className="text-[11px] text-gray-400">({rating?.reviews || 0} review)</span></div></div></div>
        <button onClick={onClose} className="text-xl leading-none self-start">×</button></div>
      <div className="mt-3 text-xs text-gray-500">📍 {[p.area, p.city].filter(Boolean).join(", ")}{p.experience_years != null ? ` · ${p.experience_years} saal ka experience` : ""}</div>
      {p.rate_note && <div className="mt-1 text-xs font-semibold text-emerald-700">💰 {p.rate_note}</div>}
      {p.about && <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap break-words">{p.about}</div>}
      {photos.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{photos.map((u, i) => <img key={i} src={u} alt="" className="h-32 rounded-xl object-cover shrink-0" />)}</div>}
      {!mine && <div className="grid grid-cols-2 gap-2 mt-4">
        <a href={telHref(p.phone)} className="text-center bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm">📞 Call karein</a>
        <a href={waHref(p.whatsapp || p.phone, `Namaste ${p.name}, NearShop par aapki ${p.category} service dekhi. Mujhe aapse kaam karwana hai.`)} target="_blank" rel="noopener noreferrer" className="text-center bg-green-500 text-white font-bold py-3 rounded-xl text-sm">💬 WhatsApp</a></div>}
      {isProperty(p.category) && <div className="mt-3 text-[11px] bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-2.5">⚠️ Property/zameen ke sauda me kisi ko paise dene se pehle papers, malik aur jagah khud jaanch lein. NearShop sirf contact karwata hai, sauda ya paise ki zimmedari nahi leta.</div>}
      <div className="mt-4 font-bold text-sm">Reviews</div>
      {!reviews && <div className="text-xs text-gray-400">Loading…</div>}
      {reviews && !reviews.length && <div className="text-xs text-gray-400">Abhi koi review nahi.</div>}
      {(reviews || []).map((r) => <div key={r.user_id} className="border-t border-gray-50 py-2"><div className="flex justify-between text-[11px]"><b>{r.author_name || "User"}</b><span className="text-gray-400">{timeAgo(new Date(r.created_at).getTime())}</span></div><div className="text-amber-500 text-xs">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>{r.comment && <div className="text-xs text-gray-600">{r.comment}</div>}</div>)}
      {!mine && <div className="mt-3 border border-gray-100 rounded-xl p-3">
        <div className="flex gap-1 mb-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} className={`text-2xl ${n <= stars ? "text-amber-400" : "text-gray-300"}`}>★</button>)}</div>
        <input className={inp} placeholder="Kaam kaisa laga? (optional)" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
        <button onClick={submit} className="w-full mt-2 bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm">Review do</button></div>}
      {msg && <div className="mt-2 text-xs text-gray-600">{msg}</div>}
      {!mine && <button onClick={report} className="mt-3 text-[11px] text-red-500 font-semibold">🚩 Report karein</button>}
    </div></div>;
}

const blank = { category: SERVICE_CATEGORIES[0][0], name: "", about: "", experience_years: "", city: "", area: "", phone: "", whatsapp: "", rate_note: "", photo_url: "", work_photos: [] };
function ProfileForm({ me, userName, defaultCity, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...blank, ...initial, experience_years: initial.experience_years ?? "", whatsapp: initial.whatsapp || "", work_photos: initial.work_photos || [] } : { ...blank, name: userName || "", city: defaultCity || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (initial?.id && !initial.work_photos) supabase.from("service_profiles").select("work_photos").eq("id", initial.id).maybeSingle().then(({ data }) => data && setF((x) => ({ ...x, work_photos: data.work_photos || [] }))); }, [initial]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickAvatar = async (e) => { const file = e.target.files?.[0]; if (file) try { setF((x) => ({ ...x })); const u = await toDataUrl(file, 300, 0.75, 40000); setF((x) => ({ ...x, photo_url: u })); } catch { setErr("Photo padhi nahi gayi."); } };
  const pickWork = async (e) => { const files = [...(e.target.files || [])].slice(0, 4 - f.work_photos.length); const out = []; for (const file of files) try { out.push(await toDataUrl(file)); } catch {} setF((x) => ({ ...x, work_photos: [...x.work_photos, ...out].slice(0, 4) })); };
  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Naam likhiye.");
    if (f.city.trim().length < 2) return setErr("Sheher likhiye.");
    if (!/^\+?[0-9]{8,15}$/.test(f.phone.replace(/[^0-9+]/g, ""))) return setErr("Phone number sahi daaliye.");
    setBusy(true);
    const row = { category: f.category, name: f.name.trim(), about: f.about.trim() || null, experience_years: f.experience_years === "" ? null : Math.max(0, Math.min(70, Number(f.experience_years))), city: f.city.trim(), area: f.area.trim() || null, phone: f.phone, whatsapp: f.whatsapp.trim() || null, rate_note: f.rate_note.trim() || null, photo_url: f.photo_url || null, work_photos: f.work_photos };
    const { error } = initial?.id ? await supabase.from("service_profiles").update(row).eq("id", initial.id) : await supabase.from("service_profiles").insert({ ...row, owner_id: me });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?exception:?\s*/i, ""));
    onSaved(!initial?.id);
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[94vh] overflow-y-auto space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center"><div className="font-bold">{initial?.id ? "Profile badlo" : "Meri Service Profile"}</div><button onClick={onClose} className="text-xl leading-none">×</button></div>
      <select className={inp} value={f.category} onChange={set("category")}>{SERVICE_CATEGORIES.map(([c, i]) => <option key={c} value={c}>{i} {c}</option>)}</select>
      <input className={inp} placeholder="Aapka / business ka naam" value={f.name} maxLength={80} onChange={set("name")} />
      <textarea className={inp} rows={3} placeholder="Apne kaam ke baare me likhiye (kya kya karte hain)" value={f.about} maxLength={600} onChange={set("about")} />
      <div className="grid grid-cols-2 gap-2"><input className={inp} type="number" min="0" max="70" placeholder="Experience (saal)" value={f.experience_years} onChange={set("experience_years")} /><input className={inp} placeholder="Rate (jaise ₹500/din)" value={f.rate_note} maxLength={80} onChange={set("rate_note")} /></div>
      <div className="grid grid-cols-2 gap-2"><input className={inp} placeholder="Sheher" value={f.city} onChange={set("city")} /><input className={inp} placeholder="Area / mohalla" value={f.area} onChange={set("area")} /></div>
      <div className="grid grid-cols-2 gap-2"><input className={inp} inputMode="tel" placeholder="Phone number" value={f.phone} onChange={set("phone")} /><input className={inp} inputMode="tel" placeholder="WhatsApp (agar alag ho)" value={f.whatsapp} onChange={set("whatsapp")} /></div>
      <div className="text-[11px] text-gray-500 font-semibold">Aapki photo / logo</div>
      <div className="flex items-center gap-3">{f.photo_url ? <img src={f.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full bg-gray-100" />}<input type="file" accept="image/*" onChange={pickAvatar} className="text-sm" /></div>
      <div className="text-[11px] text-gray-500 font-semibold">Kaam ki photos (4 tak)</div>
      <div className="flex gap-2 flex-wrap">{f.work_photos.map((u, i) => <div key={i} className="relative"><img src={u} alt="" className="w-20 h-20 rounded-xl object-cover" /><button onClick={() => setF({ ...f, work_photos: f.work_photos.filter((_, j) => j !== i) })} className="absolute -top-1 -right-1 bg-black/70 text-white text-[10px] rounded-full w-5 h-5">×</button></div>)}</div>
      {f.work_photos.length < 4 && <input type="file" accept="image/*" multiple onChange={pickWork} className="text-sm" />}
      <div className="text-[10px] text-gray-400">Profile pehle admin approve karega, phir sabko dikhegi. Phone number sirf login kiye hue users ko dikhta hai.</div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <button onClick={save} disabled={busy} className="w-full bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">{busy ? "Save ho raha hai…" : "Save karo"}</button>
    </div></div>;
}

export default function ServicesScreen({ user, defaultCity = "" }) {
  const me = user?.id || null;
  const [rows, setRows] = useState(null);
  const [ratings, setRatings] = useState({});
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [city, setCity] = useState("All");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null); // null | {} (new) | profile (edit)
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([supabase.from("service_profiles").select(LIST_COLS).order("created_at", { ascending: false }).limit(300), supabase.rpc("service_ratings")]);
    if (a.error) { setErr(/does not exist|schema cache/i.test(a.error.message) ? "Services ka database setup baaki hai (SQL 20261120 chalayein)." : a.error.message); setRows([]); return; }
    setRows(a.data || []); setRatings(Object.fromEntries((b.data || []).map((r) => [r.profile_id, r])));
  }, []);
  useEffect(() => { load(); }, [load]);
  const mine = (rows || []).filter((r) => r.owner_id === me);
  const live = (rows || []).filter((r) => r.status === "approved");
  const cities = useMemo(() => [...new Set(live.map((r) => r.city.trim()).filter(Boolean))].sort(), [rows]); // eslint-disable-line
  const term = q.trim().toLowerCase();
  const list = live.filter((r) => (cat === "All" || r.category === cat) && (city === "All" || r.city.trim().toLowerCase() === city.toLowerCase()) && (!term || `${r.name} ${r.category} ${r.area || ""} ${r.city} ${r.about || ""}`.toLowerCase().includes(term)))
    .sort((a, b) => (isFeatured(b) - isFeatured(a)) || ((ratings[b.id]?.avg_rating || 0) - (ratings[a.id]?.avg_rating || 0)) || (new Date(b.created_at) - new Date(a.created_at)));
  const del = async (p) => { if (!window.confirm(`"${p.name}" profile delete karein?`)) return; await supabase.from("service_profiles").delete().eq("id", p.id); load(); };
  return <div className="pb-28">
    <div className="bg-gradient-to-br from-orange-500 to-rose-500 px-5 pt-6 pb-5 rounded-b-3xl text-white">
      <div className="flex items-start justify-between gap-2"><div><div className="text-2xl font-extrabold">🛠️ Services</div><div className="text-white/85 text-sm mt-1">Painter, electrician, plumber, tutor… apne paas ke kaarigar dhundo</div></div>
        <button onClick={() => setForm({})} className="bg-white text-rose-600 font-bold text-xs px-3 py-2 rounded-full shrink-0">+ Meri profile</button></div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kaam ya naam dhundo (jaise: painter)" className="w-full mt-4 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none" />
    </div>
    <div className="px-5 mt-3 flex gap-2 overflow-x-auto pb-1">{["All", ...SERVICE_CATEGORIES.map((c) => c[0])].map((c) => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cat === c ? "bg-rose-500 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>{c === "All" ? "Sab" : `${iconOf(c)} ${c.split(" / ")[0]}`}</button>)}</div>
    {cities.length > 1 && <div className="px-5 mt-2"><select value={city} onChange={(e) => setCity(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"><option value="All">Sab sheher</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>}
    {note && <div className="mx-5 mt-3 text-xs bg-emerald-50 text-emerald-700 rounded-xl p-3">{note}</div>}
    {err && <div className="mx-5 mt-3 text-xs bg-red-50 text-red-700 rounded-xl p-3">{err}</div>}
    {mine.length > 0 && <div className="px-5 mt-4"><div className="font-extrabold text-sm mb-2">Meri profiles</div>
      {mine.map((p) => { const [lab, cls] = STATUS[p.status] || STATUS.pending; return <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 mb-2 flex items-center gap-3"><Avatar p={p} size={40} />
        <div className="min-w-0 flex-1"><div className="font-bold text-sm truncate">{p.name}</div><div className="text-[10px] text-gray-400 truncate">{p.category} · {p.city}</div></div>
        <div className="text-right shrink-0"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{lab}</span><div className="text-[11px] font-bold mt-1"><button onClick={() => setForm(p)} className="text-violet-700">Badlo</button> <button onClick={() => del(p)} className="text-red-500 ml-2">Delete</button></div></div></div>; })}</div>}
    <div className="px-5 mt-4 space-y-3">
      {rows === null && <div className="text-sm text-gray-400 text-center py-8">Loading…</div>}
      {rows && !list.length && !err && <div className="text-sm text-gray-400 text-center py-10">Abhi is category me koi profile nahi. Aap pehle ban sakte hain! 👆</div>}
      {list.map((p) => <button key={p.id} onClick={() => setOpen(p)} className="w-full text-left bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 active:scale-[.99]">
        <Avatar p={p} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><div className="font-bold text-sm truncate">{p.name}</div>{isFeatured(p) && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">FEATURED</span>}</div>
          <div className="text-[11px] text-gray-500 truncate">{iconOf(p.category)} {p.category}{p.experience_years != null ? ` · ${p.experience_years} saal` : ""}</div>
          <div className="text-[11px] text-gray-400 truncate">📍 {[p.area, p.city].filter(Boolean).join(", ")}</div></div>
        <div className="text-right shrink-0"><Stars v={ratings[p.id]?.avg_rating} />{p.rate_note && <div className="text-[10px] text-emerald-700 font-semibold mt-1 max-w-[90px] truncate">{p.rate_note}</div>}</div></button>)}
    </div>
    {open && <Detail p={open} me={me} rating={ratings[open.id]} onClose={() => setOpen(null)} onChanged={load} />}
    {form && <ProfileForm me={me} userName={user?.name} defaultCity={defaultCity} initial={form.id ? form : null} onClose={() => setForm(null)} onSaved={(isNew) => { setForm(null); setNote(isNew ? "Profile bhej di gayi ✔ Admin approve karega, phir sabko dikhegi." : "Profile update ho gayi ✔"); load(); }} />}
  </div>;
}
