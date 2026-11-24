import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const blank = {
  title: "", body: "", campaign_type: "announcement", seller_type: "platform",
  image_url: "", video_url: "", primary_url: "", button_text: "Abhi Dekhein",
  audience_type: "all", audience_category: "all", audience_city: "", audience_state: "",
  start_at: "", end_at: "", push_enabled: true, in_app_enabled: true,
  product_name: "", product_price: "", compare_at_price: "", stock_quantity: "",
  discount_type: "percent", discount_value: "", coupon_code: "",
  offer_feature: "", offer_note: ""
};
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500";
const label = "mb-1 block text-xs font-semibold text-slate-600";
const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const safeUrl = v => !v || /^https:\/\//i.test(v.trim());

export default function CampaignAdmin({ adminPassword, shops = [] }) {
  const [form, setForm] = useState(blank);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(true);
  const [stats, setStats] = useState({});
  const [targetsText, setTargetsText] = useState("");
  const [pickShop, setPickShop] = useState("");
  const [pickProduct, setPickProduct] = useState("");
  const [pushBusy, setPushBusy] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_campaigns", { p_password: adminPassword });
    if (error) setMessage("Campaign list load nahi hui: " + error.message);
    else setRows(data || []);
    const a = await supabase.rpc("admin_campaign_analytics", { p_password: adminPassword });
    if (!a.error) setStats(Object.fromEntries((a.data || []).map(x => [x.campaign_id, x])));
  }, [adminPassword]);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(blank); setEditing(null); setTargetsText(""); setPickShop(""); setPickProduct(""); };
  const edit = r => {
    setEditing(r.id);
    setForm({
      ...blank, ...r,
      start_at: r.start_at ? new Date(r.start_at).toISOString().slice(0,16) : "",
      end_at: r.end_at ? new Date(r.end_at).toISOString().slice(0,16) : "",
      product_price: r.product_price ?? "", compare_at_price: r.compare_at_price ?? "",
      stock_quantity: r.stock_quantity ?? "", discount_value: r.discount_value ?? ""
    });
    setPickShop(r.shop_id || ""); setPickProduct(r.product_id || "");
    setTargetsText("");
    if (r.audience_type === "selected") supabase.rpc("admin_get_campaign_targets", { p_password: adminPassword, p_campaign: r.id }).then(({ data }) => setTargetsText((data || []).join("\n")));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const save = async (status = "scheduled") => {
    setMessage("");
    if (!form.title.trim() || !form.body.trim()) return setMessage("Title aur message zaroori hain.");
    for (const k of ["image_url","video_url","primary_url"]) if (!safeUrl(form[k])) return setMessage("Har link https:// se shuru hona chahiye.");
    if (!form.in_app_enabled && !form.push_enabled) return setMessage("In-app ya push mein se kam se kam ek delivery chuniye.");
    if (form.campaign_type === "store_product" && (!form.product_name.trim() || Number(form.product_price) <= 0)) return setMessage("Store product ke liye naam aur valid selling price zaroori hai.");
    if (form.compare_at_price && Number(form.compare_at_price) <= Number(form.product_price)) return setMessage("Compare-at price selling price se zyada honi chahiye.");
    if (form.campaign_type === "feature_offer" && (!form.offer_feature || Number(form.discount_value) <= 0)) return setMessage("Paid feature aur discount value select karein.");
    if (form.audience_type === "selected" && !targetsText.trim()) return setMessage("Selected users ke liye phone number ya @username likhein.");
    if (form.audience_type === "city" && !form.audience_city.trim()) return setMessage("City ka naam likhein.");
    if (form.audience_type === "state" && !form.audience_state.trim()) return setMessage("State ka naam likhein.");
    const payload = {
      ...form, id: editing, status,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : new Date().toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      product_price: form.product_price === "" ? null : Number(form.product_price),
      compare_at_price: form.compare_at_price === "" ? null : Number(form.compare_at_price),
      stock_quantity: form.stock_quantity === "" ? null : Math.max(0, Number(form.stock_quantity)),
      discount_value: form.discount_value === "" ? null : Number(form.discount_value)
    };
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_save_campaign", { p_password: adminPassword, p_campaign: payload });
    if (error || !data) { setBusy(false); return setMessage("Save fail hua: " + (error?.message || "Admin verification fail.")); }
    const extra = [];
    const pr = await supabase.rpc("admin_set_campaign_product", { p_password: adminPassword, p_campaign: data, p_shop: pickProduct ? pickShop : null, p_product: pickProduct || null });
    if (pr.error) extra.push("Product link: " + pr.error.message);
    const tg = await supabase.rpc("admin_set_campaign_targets", { p_password: adminPassword, p_campaign: data, p_identifiers: form.audience_type === "selected" ? targetsText.split(/[\n,]+/).map(x => x.trim()).filter(Boolean) : [] });
    if (tg.error) extra.push("Selected users: " + tg.error.message);
    else if (form.audience_type === "selected") extra.push(`${tg.data?.matched || 0} user mile` + (tg.data?.missing?.length ? `, nahi mile: ${tg.data.missing.join(", ")}` : ""));
    setBusy(false);
    setMessage((status === "published" ? "Campaign publish ho gayi. Push bhejne ke liye history me 'Push bhejein' dabayein." : "Campaign save ho gayi.") + (extra.length ? " " + extra.join(" | ") : ""));
    reset(); await load();
  };
  const action = async (r, status) => {
    const { data, error } = await supabase.rpc("admin_save_campaign", { p_password: adminPassword, p_campaign: { id:r.id, status } });
    setMessage(error || !data ? "Update nahi hua: " + (error?.message || "") : "Campaign update ho gayi.");
    await load();
  };
  const sendPush = async (r, resend = false) => {
    if (!window.confirm(resend ? "Push dobara bhejein?" : `"${r.title}" ka push abhi bhejein?`)) return;
    setPushBusy(r.id); setMessage("");
    const { data, error } = await supabase.functions.invoke("send-campaign-push", { body: { campaign_id: r.id, admin_password: adminPassword, resend } });
    setPushBusy("");
    const msg = data?.error || error?.message;
    setMessage(msg ? "Push nahi gaya: " + msg : `Push: ${data.sent || 0} bheja, ${data.failed || 0} fail, audience ${data.targeted || 0}.` + (data.note ? " " + data.note : ""));
    await load();
  };
  const shopProducts = (shops.find(x => x.id === pickShop)?.products || []).filter(p => !p.archived_at);
  const remove = async r => {
    if (!window.confirm(`"${r.title}" delete karein?`)) return;
    const { error } = await supabase.rpc("admin_delete_campaign", { p_password: adminPassword, p_id:r.id });
    setMessage(error ? error.message : "Campaign delete ho gayi."); await load();
  };
  const f = (k, v) => set(k, v);
  const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  return <div className="space-y-4 px-4 py-4">
    <div className="rounded-2xl bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-900 p-5 text-white">
      <div className="text-xs font-bold uppercase tracking-widest text-violet-200">NearShop Admin Studio</div>
      <h2 className="mt-1 text-xl font-extrabold">Campaign & Announcement Center</h2>
      <p className="mt-1 text-xs text-white/75">Announcements, official store products, affiliate links aur paid-feature offers — ek hi campaign se.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/10 p-2"><div className="text-lg font-extrabold">{rows.length}</div><div className="text-[10px] text-white/70">Campaigns</div></div>
        <div className="rounded-xl bg-white/10 p-2"><div className="text-lg font-extrabold">{rows.filter(x=>x.status==="published").length}</div><div className="text-[10px] text-white/70">Published</div></div>
        <div className="rounded-xl bg-white/10 p-2"><div className="text-lg font-extrabold">{rows.reduce((a,x)=>a+Number(x.clicks||0),0)}</div><div className="text-[10px] text-white/70">Clicks</div></div>
      </div>
    </div>

    <section className={card+" space-y-3"}>
      <div className="flex items-center justify-between"><h3 className="font-extrabold text-slate-900">{editing ? "Campaign edit karein" : "Nayi campaign banayein"}</h3>{editing && <button onClick={reset} className="text-xs font-bold text-violet-700">Cancel edit</button>}</div>
      <div><label className={label}>Campaign type</label><select className={input} value={form.campaign_type} onChange={e=>f("campaign_type",e.target.value)}><option value="announcement">Announcement / Message</option><option value="store_product">NearShop Official Store — Product sale</option><option value="affiliate">Affiliate product / website</option><option value="app_promo">App promotion</option><option value="feature_offer">Paid feature special offer</option><option value="flash_sale">Flash sale</option></select></div>
      <div><label className={label}>Seller / source identity</label><select className={input} value={form.seller_type} onChange={e=>f("seller_type",e.target.value)}><option value="platform">NearShop Official</option><option value="registered_shop">Registered shop</option><option value="affiliate_partner">Affiliate partner</option><option value="external_advertiser">External advertiser</option></select></div>
      <div><label className={label}>Title</label><input className={input} maxLength={120} value={form.title} onChange={e=>f("title",e.target.value)} placeholder="Jaise: NearShop Special Cricket Sale"/></div>
      <div><label className={label}>Message / description</label><textarea className={input} rows={4} maxLength={1500} value={form.body} onChange={e=>f("body",e.target.value)} placeholder="Offer ya announcement ki details likhein..."/></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={label}>Image URL (optional)</label><input className={input} value={form.image_url} onChange={e=>f("image_url",e.target.value)} placeholder="https://..."/></div>
        <div><label className={label}>Video / Reels URL (optional)</label><input className={input} value={form.video_url} onChange={e=>f("video_url",e.target.value)} placeholder="YouTube / Instagram https://..."/></div>
      </div>
      <div><label className={label}>Primary destination link (optional)</label><input className={input} value={form.primary_url} onChange={e=>f("primary_url",e.target.value)} placeholder="Product, affiliate, Play Store ya app deep link"/></div>
      <div><label className={label}>Button text</label><input className={input} maxLength={32} value={form.button_text} onChange={e=>f("button_text",e.target.value)} placeholder="Shop Now / Abhi Dekhein"/></div>

      {form.campaign_type === "store_product" && <div className="rounded-xl bg-emerald-50 p-3 space-y-2">
        <div className="text-xs font-extrabold text-emerald-800">Official Store product details</div>
        <input className={input} value={form.product_name} onChange={e=>f("product_name",e.target.value)} placeholder="Product name"/>
        <div className="grid grid-cols-3 gap-2"><input className={input} type="number" min="0" value={form.product_price} onChange={e=>f("product_price",e.target.value)} placeholder="Sale ₹"/><input className={input} type="number" min="0" value={form.compare_at_price} onChange={e=>f("compare_at_price",e.target.value)} placeholder="MRP ₹"/><input className={input} type="number" min="0" value={form.stock_quantity} onChange={e=>f("stock_quantity",e.target.value)} placeholder="Stock"/></div>
        <p className="text-[10px] text-emerald-800">Ye sirf campaign display details hain. Real order aur live stock ke liye neeche "Real NearShop product jodein" mein actual product select karein. Stock shop ke order confirm karne par hi deduct hota hai.</p>
      </div>}

      {form.campaign_type === "feature_offer" && <div className="rounded-xl bg-amber-50 p-3 space-y-2">
        <div className="text-xs font-extrabold text-amber-900">Paid feature discount</div>
        <input className={input} value={form.offer_feature} onChange={e=>f("offer_feature",e.target.value)} placeholder="Feature key/name (e.g. top_shop)"/>
        <div className="grid grid-cols-2 gap-2"><select className={input} value={form.discount_type} onChange={e=>f("discount_type",e.target.value)}><option value="percent">Percentage %</option><option value="fixed">Fixed ₹</option></select><input className={input} type="number" min="0" value={form.discount_value} onChange={e=>f("discount_value",e.target.value)} placeholder="Discount value"/></div>
        <input className={input} value={form.coupon_code} onChange={e=>f("coupon_code",e.target.value.toUpperCase())} placeholder="Coupon code (optional)"/>
        <input className={input} value={form.offer_note} onChange={e=>f("offer_note",e.target.value)} placeholder="Offer conditions / usage limit note"/>
        <p className="text-[10px] text-amber-900">Ye paid-feature discount metadata hai. Product order coupons alag se server-side validate hote hain; paid-feature plan checkout par ye discount abhi apply nahi hota.</p>
      </div>}

      <div className="rounded-xl bg-sky-50 p-3 space-y-2">
        <div className="text-xs font-extrabold text-sky-900">Real NearShop product jodein (optional)</div>
        <select className={input} value={pickShop} onChange={e=>{setPickShop(e.target.value);setPickProduct("");}}><option value="">— Koi shop nahi —</option>{shops.map(sh=><option key={sh.id} value={sh.id}>{sh.name} ({sh.city||"-"})</option>)}</select>
        {pickShop && <select className={input} value={pickProduct} onChange={e=>setPickProduct(e.target.value)}><option value="">— Product chuno —</option>{shopProducts.map(p=><option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}</select>}
        <p className="text-[10px] text-sky-900">Product jodne par customer "Product dekhein" dabate hi wahi asli product khulega aur live price/stock dikhega. Naya product record nahi banta.</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 space-y-2">
        <div className="text-xs font-extrabold text-slate-800">Audience targeting</div>
        <select className={input} value={form.audience_type} onChange={e=>f("audience_type",e.target.value)}><option value="all">All users</option><option value="customers">Customers only</option><option value="shopkeepers">Shopkeepers only</option><option value="city">Selected city</option><option value="state">Selected state</option><option value="category">Shop category</option><option value="selected">Selected users (phone / @username)</option></select>
        {form.audience_type==="category" && <input className={input} value={form.audience_category} onChange={e=>f("audience_category",e.target.value)} placeholder="Category key/name (medical, clothing...)"/>}
        {form.audience_type==="city" && <input className={input} value={form.audience_city} onChange={e=>f("audience_city",e.target.value)} placeholder="City name"/>}
        {form.audience_type==="state" && <input className={input} value={form.audience_state} onChange={e=>f("audience_state",e.target.value)} placeholder="State name"/>}
        {form.audience_type==="selected" && <textarea className={input} rows={3} value={targetsText} onChange={e=>setTargetsText(e.target.value)} placeholder={"Har line me ek: phone number ya @username\n9876543210\n@rahul"}/>}
        {["city","state"].includes(form.audience_type) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900">City/State: shopkeeper ki shop ki city/state, ya customer ka app me detect hua nearest city/state se match hota hai. Jisne app me location/shops page kabhi nahi kholi, use ye campaign nahi dikhega.</div>}
      </div>

      <div className="grid grid-cols-2 gap-2"><div><label className={label}>Start time</label><input className={input} type="datetime-local" value={form.start_at} onChange={e=>f("start_at",e.target.value)}/></div><div><label className={label}>End time (optional)</label><input className={input} type="datetime-local" value={form.end_at} onChange={e=>f("end_at",e.target.value)}/></div></div>
      <div className="rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="text-xs font-extrabold">Delivery channels</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.in_app_enabled} onChange={e=>f("in_app_enabled",e.target.checked)}/> In-app announcement / notification center</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.push_enabled} onChange={e=>f("push_enabled",e.target.checked)}/> Push notification</label>
        <p className="text-[10px] text-slate-500">In-app campaign feed is supported by this package. Push: Firebase setup ke baad history me "Push bhejein" se audience ko jata hai; never put server keys in frontend code.</p>
      </div>
      <button type="button" onClick={()=>setPreview(v=>!v)} className="w-full rounded-xl border border-violet-200 py-2 text-sm font-bold text-violet-700">{preview?"Preview chhupayein":"Customer preview dekhein"}</button>
      {preview && <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Customer preview</div>
        <div className="mt-1 font-extrabold text-slate-900">{form.title || "Campaign title"}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{form.body || "Yahan campaign ka message dikhega."}</p>
        {form.campaign_type==="store_product" && <div className="mt-2 font-bold text-emerald-700">{money(form.product_price)} {form.compare_at_price && <del className="ml-2 text-xs text-slate-400">{money(form.compare_at_price)}</del>}</div>}
        {form.image_url && <img src={form.image_url} alt="" className="mt-2 max-h-48 w-full rounded-xl object-cover"/>}
        {form.video_url && <div className="mt-2 break-all text-xs text-blue-700">Video: {form.video_url}</div>}
        {form.primary_url && <div className="mt-2 text-xs font-bold text-violet-700">{form.button_text || "Abhi Dekhein"} ↗</div>}
      </div>}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={()=>save("draft")} className="rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">{busy?"Saving...":"Save Draft"}</button>
        <button disabled={busy} onClick={()=>save("published")} className="rounded-xl bg-violet-700 py-3 text-sm font-extrabold text-white disabled:opacity-50">{busy?"Publishing...":"Publish Campaign"}</button>
      </div>
      {message && <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-700">{message}</div>}
    </section>

    <section className={card}>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold text-slate-900">Campaign history</h3><button onClick={load} className="text-xs font-bold text-violet-700">Refresh</button></div>
      {!rows.length && <p className="py-5 text-center text-xs text-slate-400">Abhi campaign nahi bani.</p>}
      <div className="space-y-3">{rows.map(r=><article key={r.id} className="rounded-xl border border-slate-100 p-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-extrabold text-slate-900">{r.title}</div><div className="mt-0.5 text-[10px] text-slate-500">{r.campaign_type} · {r.seller_type} · {r.audience_type}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${r.status==="published"?"bg-emerald-100 text-emerald-700":r.status==="paused"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600"}`}>{r.status}</span></div>
        {(()=>{const a=stats[r.id]||{};return <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-slate-500"><span>Views: {a.views??r.impressions??0}</span><span>Unique: {a.unique_viewers??0}</span><span>Clicks: {a.clicks??0}</span><span>Product open: {a.product_opens??0}</span><span>Orders: {a.orders??0}</span><span>Revenue: {money(a.revenue)}</span><span>CTR: {a.ctr??0}%</span><span>Conv: {a.conversion_rate??0}%</span>{r.push_sent_at&&<span className="col-span-3 text-emerald-700">Push bheja gaya: {new Date(r.push_sent_at).toLocaleString("en-IN")}</span>}</div>;})()}
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold"><button onClick={()=>edit(r)} className="text-violet-700">Edit</button>{r.status==="published"?<button onClick={()=>action(r,"paused")} className="text-amber-700">Pause</button>:<button onClick={()=>action(r,"published")} className="text-emerald-700">Publish / Resume</button>}{r.status==="published"&&r.push_enabled&&<button disabled={pushBusy===r.id} onClick={()=>sendPush(r,!!r.push_sent_at)} className="text-indigo-700 disabled:opacity-50">{pushBusy===r.id?"Bhej raha...":r.push_sent_at?"Push dobara":"Push bhejein"}</button>}<button onClick={()=>remove(r)} className="text-red-600">Delete</button></div>
      </article>)}</div>
    </section>
  </div>;
}
