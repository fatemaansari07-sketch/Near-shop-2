import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500";
const label = "mb-1 block text-xs font-semibold text-slate-600";
const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const localDate = d => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
const blank = () => ({
  title:"", body:"", image_url:"", video_url:"", destination_url:"", whatsapp_number:"",
  button_text:"Abhi Dekhein", placements:["feed"], target_type:"city", target_city:"Surat",
  target_state:"Gujarat", target_category:"", budget:"500", billing_model:"cpm", rate:"100",
  start_at:localDate(new Date()), end_at:localDate(Date.now()+7*86400000)
});
const safeExternal = v => { try { const u = new URL(v); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };

export default function AdvertiserPortal({ user, onBack }) {
  const [account,setAccount] = useState(null);
  const [rows,setRows] = useState([]);
  const [stats,setStats] = useState({});
  const [wallet,setWallet] = useState({balance:0,transactions:[],topups:[]});
  const [rates,setRates] = useState({cpm:100,cpc:3});
  const [form,setForm] = useState(blank());
  const [editing,setEditing] = useState(null);
  const [tab,setTab] = useState("overview");
  const [profile,setProfile] = useState({brand_name:"",contact_name:user?.name||"",contact_email:user?.email||"",phone:user?.phone||"",website:"",business_type:"",city:"Surat",state:"Gujarat",about:""});
  const [topup,setTopup] = useState({amount:"500",method:"upi",reference:""});
  const [busy,setBusy] = useState(false);
  const [uploading,setUploading] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [{data:a,error:ae},{data:c,error:ce},{data:w,error:we},{data:s,error:se},{data:pr}] = await Promise.all([
      supabase.rpc("my_advertiser_account"),
      supabase.from("advertiser_campaigns").select("*").order("created_at",{ascending:false}),
      supabase.rpc("advertiser_wallet_summary"),
      supabase.rpc("advertiser_campaign_stats"),
      supabase.from("platform_settings").select("settings").eq("id","pricing").maybeSingle()
    ]);
    if (ae) { setError(ae.message); return; }
    if (ce && !/permission|advertiser_campaigns/i.test(ce.message)) setError(ce.message);
    const acc = Array.isArray(a) ? a[0] : a;
    setAccount(acc || null);
    if (pr?.settings?.externalAds) setRates(p=>({...p,...pr.settings.externalAds}));
    if (acc) {
      setProfile({brand_name:acc.brand_name||"",contact_name:acc.contact_name||"",contact_email:acc.contact_email||"",phone:acc.phone||"",website:acc.website||"",business_type:acc.business_type||"",city:acc.city||"Surat",state:acc.state||"Gujarat",about:acc.about||""});
      setRows(ce ? [] : c||[]);
      const ww = Array.isArray(w) ? w[0] : w;
      if (ww) setWallet({balance:Number(ww.balance)||0,transactions:ww.transactions||[],topups:ww.topups||[]});
      setStats(Object.fromEntries((s||[]).map(x=>[x.campaign_id,x])));
    }
  },[]);
  useEffect(()=>{load();},[load]);

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const saveProfile = async e => {
    e?.preventDefault(); setBusy(true); setError(""); setMessage("");
    const {data,error:e1}=await supabase.rpc("save_advertiser_profile",{p_payload:profile});
    setBusy(false);
    if(e1){setError(e1.message);return;}
    setMessage("Advertiser profile submit ho gaya. Admin approval ka wait karein.");
    await load();
  };
  const uploadCreative = async (file,kind) => {
    if(!file)return;
    const max = kind==="image" ? 8*1024*1024 : 10*1024*1024;
    if(file.size>max){setError(`File size ${kind==="image"?"8 MB":"10 MB"} se kam rakhein.`);return;}
    const allowed = kind==="image" ? ["image/jpeg","image/png","image/webp"] : ["video/mp4","video/webm"];
    if(!allowed.includes(file.type)){setError(kind==="image"?"JPG, PNG ya WebP image upload karein.":"MP4 ya WebM video upload karein.");return;}
    setUploading(kind);setError("");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-80);
    const path = `${user.authId}/${Date.now()}-${safe}`;
    const {error:upErr}=await supabase.storage.from("advertiser-creatives").upload(path,file,{upsert:false,contentType:file.type});
    setUploading("");
    if(upErr){setError("Upload nahi hua: "+upErr.message+" (Migration aur Storage policy check karein.)");return;}
    const {data}=supabase.storage.from("advertiser-creatives").getPublicUrl(path);
    set(kind==="image"?"image_url":"video_url",data.publicUrl);
    setMessage(kind==="image"?"Image upload ho gayi.":"Video upload ho gaya.");
  };
  const saveCampaign = async e => {
    e.preventDefault(); setError("");setMessage("");
    if(!String(form.destination_url||"").trim()&&!String(form.whatsapp_number||"").replace(/[^0-9]/g,"")){setError("Destination HTTPS URL ya WhatsApp number dena zaroori hai.");return;}
    if(form.destination_url && !safeExternal(form.destination_url)){setError("Destination URL HTTPS hona chahiye.");return;}
    setBusy(true);
    const payload={...form,budget:Number(form.budget)||0,rate:Number(form.rate)||0};
    const {data,error:e1}=await supabase.rpc("save_advertiser_campaign",{p_id:editing||null,p_payload:payload});
    setBusy(false);
    if(e1){setError(e1.message);return;}
    setMessage("Campaign draft save ho gaya. Submit karne se pehle wallet budget reserve hoga.");
    setEditing(null);setForm(blank());setTab("overview");await load();
  };
  const submitCampaign = async id => {
    if(!window.confirm("Is campaign ka poora budget wallet se reserve karke admin approval ke liye bhejna hai?"))return;
    setBusy(true);setError("");setMessage("");
    const {error:e1}=await supabase.rpc("submit_advertiser_campaign",{p_campaign:id});
    setBusy(false);if(e1){setError(e1.message);return;}
    setMessage("Campaign admin approval ke liye bhej diya gaya.");await load();
  };
  const requestTopup = async e => {
    e.preventDefault();setBusy(true);setError("");setMessage("");
    const {error:e1}=await supabase.rpc("request_advertiser_topup",{p_amount:Number(topup.amount),p_method:topup.method,p_reference:topup.reference});
    setBusy(false);if(e1){setError(e1.message);return;}
    setMessage("Top-up request submit ho gayi. Payment reference admin verify karega.");setTopup({amount:"500",method:"upi",reference:""});await load();
  };
  const claimRefund = async id => {
    if(!window.confirm("Is campaign ka unused budget wallet mein wapas lena hai?"))return;
    setBusy(true);setError("");setMessage("");
    const {data,error:e1}=await supabase.rpc("claim_advertiser_campaign_refund",{p_campaign:id});
    setBusy(false);if(e1){setError(e1.message);return;}
    setMessage(`${money(data)} unused budget wallet mein return ho gaya.`);await load();
  };
  const editCampaign = c => {
    setEditing(c.id);setForm({title:c.title,body:c.body,image_url:c.image_url||"",video_url:c.video_url||"",destination_url:c.destination_url||"",whatsapp_number:c.whatsapp_number||"",button_text:c.button_text||"Abhi Dekhein",placements:c.placements||["feed"],target_type:c.target_type||"city",target_city:c.target_city||"Surat",target_state:c.target_state||"Gujarat",target_category:c.target_category||"",budget:String(c.budget||500),billing_model:c.billing_model||"cpm",rate:String(c.rate||100),start_at:localDate(c.start_at),end_at:localDate(c.end_at)});setTab("create");
  };
  const shareCampaign = c => {
    const wa = c.whatsapp_number ? `https://wa.me/${String(c.whatsapp_number).replace(/[^0-9]/g,"")}` : "";
    const url = safeExternal(c.destination_url) || wa || window.location.origin;
    const text = `${account?.brand_name||"Sponsored"}: ${c.title}\n${c.body||""}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
  };
  const togglePlacement = p => setForm(f=>({...f,placements:f.placements.includes(p)?f.placements.filter(x=>x!==p):[...f.placements,p]}));
  const statsFor = id => stats[id] || {};
  const isApproved = account?.status==="approved";

  return <div className="min-h-screen bg-slate-50 pb-24">
    <div className="bg-gradient-to-br from-violet-700 to-indigo-800 text-white px-5 pt-6 pb-6 rounded-b-3xl">
      <button onClick={onBack} className="text-xs bg-white/15 rounded-full px-3 py-1.5 mb-3">← NearShop par wapas</button>
      <div className="text-2xl font-extrabold">Advertiser Studio</div>
      <div className="text-xs text-white/75 mt-1">Apne brand ke ads create karein aur performance dekhein.</div>
      {account && <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{account.status==="approved"?"✓ Advertiser approved":account.status==="rejected"?"Approval rejected":account.status==="suspended"?"Account suspended":"Approval pending"}</div>}
    </div>
    <div className="px-4 mt-4 flex gap-2 overflow-x-auto">
      {["overview","create","wallet"].map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap ${tab===t?"bg-violet-600 text-white":"bg-white border text-slate-600"}`}>{t==="create"?"Create Ad":t}</button>)}
    </div>
    <div className="px-4 mt-4 space-y-3">
      {error&&<div className="rounded-xl bg-red-50 text-red-700 p-3 text-xs">{error}</div>}
      {message&&<div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs">{message}</div>}
      {!account && <form onSubmit={saveProfile} className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="font-extrabold text-lg">Advertiser registration</div>
        <p className="text-xs text-slate-500">Brand, business, coaching, hospital, real-estate ya kisi eligible organization ka account banayein. Approval ke baad campaigns submit kar sakenge.</p>
        {[
          ["brand_name","Brand / Business name",true],["contact_name","Contact person"],["contact_email","Email"],["phone","Mobile number"],["website","Website (HTTPS)"],["business_type","Business category"],["city","City"],["state","State"]
        ].map(([k,t,req])=><label key={k} className="block"><span className={label}>{t}</span><input required={!!req} className={input} value={profile[k]||""} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))}/></label>)}
        <label className="block"><span className={label}>About brand</span><textarea className={input} rows={3} value={profile.about} onChange={e=>setProfile(p=>({...p,about:e.target.value}))}/></label>
        <button disabled={busy} className="w-full rounded-xl bg-violet-600 text-white py-3 font-bold">{busy?"Saving...":"Register advertiser account"}</button>
      </form>}
      {account && <form onSubmit={saveProfile} className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex justify-between items-center"><div className="font-bold">Brand profile</div><span className="text-[10px] text-slate-400">Account details</span></div>
        {[
          ["brand_name","Brand / Business name",true],["contact_name","Contact person"],["contact_email","Email"],["phone","Mobile number"],["website","Website (HTTPS)"],["business_type","Business category"],["city","City"],["state","State"]
        ].map(([k,t,req])=><label key={k} className="block"><span className={label}>{t}</span><input required={!!req} className={input} value={profile[k]||""} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))}/></label>)}
        <label className="block"><span className={label}>About brand</span><textarea className={input} rows={2} value={profile.about} onChange={e=>setProfile(p=>({...p,about:e.target.value}))}/></label>
        {account.admin_note&&<div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">Admin note: {account.admin_note}</div>}
        <button disabled={busy} className="rounded-xl border border-violet-200 text-violet-700 px-4 py-2 text-xs font-bold">Update profile</button>
      </form>}
      {account && tab==="overview" && <>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4"><div className="text-xs text-slate-500">Wallet balance</div><div className="text-2xl font-extrabold text-violet-700">{money(wallet.balance)}</div></div>
          <div className="bg-white rounded-2xl p-4"><div className="text-xs text-slate-500">Campaigns</div><div className="text-2xl font-extrabold">{rows.length}</div></div>
        </div>
        {!isApproved&&<div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl p-3 text-xs">Advertiser account approval pending hai. Profile review ke baad campaign submit kar sakenge. Aap draft prepare kar sakte hain.</div>}
        <div className="flex items-center justify-between"><div className="font-extrabold">My campaigns</div><button onClick={()=>{setEditing(null);setForm(blank());setTab("create");}} className="bg-violet-600 text-white rounded-lg px-3 py-2 text-xs font-bold">+ Create Ad</button></div>
        {!rows.length&&<div className="bg-white rounded-2xl p-5 text-center text-sm text-slate-500">Abhi campaign nahi hai.</div>}
        {rows.map(c=><div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between gap-2"><div className="font-bold text-sm">{c.title}</div><span className="text-[10px] font-bold rounded-full bg-slate-100 px-2 py-1 h-fit">{c.status.replace("_"," ")}</span></div>
          <div className="text-xs text-slate-500">{(c.placements||[]).join(" · ")} · {c.target_type==="city"?c.target_city:c.target_type==="state"?c.target_state:c.target_type}</div>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="bg-slate-50 rounded-lg p-2"><b className="text-sm">{statsFor(c.id).views||0}</b><div className="text-[10px] text-slate-500">Views</div></div><div className="bg-slate-50 rounded-lg p-2"><b className="text-sm">{statsFor(c.id).clicks||0}</b><div className="text-[10px] text-slate-500">Clicks</div></div><div className="bg-slate-50 rounded-lg p-2"><b className="text-sm">{statsFor(c.id).ctr||0}%</b><div className="text-[10px] text-slate-500">CTR</div></div></div>
          <div className="text-xs text-slate-600">Budget: <b>{money(c.budget)}</b> · Spent {money(c.spent)} · Remaining {money(c.budget_remaining)} · {c.billing_model?.toUpperCase()} {money(c.rate)}{c.billing_model==="cpm"?"/1000 views":"/click"}</div>
          {c.admin_note&&<div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">Admin: {c.admin_note}</div>}
          <div className="flex gap-2 flex-wrap">
            {["draft","rejected"].includes(c.status)&&<button onClick={()=>editCampaign(c)} className="rounded-lg border px-3 py-2 text-xs font-bold">Edit</button>}
            {["draft","rejected"].includes(c.status)&&<button disabled={busy} onClick={()=>submitCampaign(c.id)} className="rounded-lg bg-violet-600 text-white px-3 py-2 text-xs font-bold">Budget reserve & submit</button>}
            {(["expired","paused","rejected"].includes(c.status)||new Date(c.end_at)<=new Date())&&Number(c.budget_remaining)>0&&<button disabled={busy} onClick={()=>claimRefund(c.id)} className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-xs font-bold">Claim unused budget</button>}
            <button onClick={()=>shareCampaign(c)} className="rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-bold">WhatsApp share</button>
          </div>
        </div>)}
      </>}
      {account && tab==="create" && <form onSubmit={saveCampaign} className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="font-extrabold text-lg">{editing?"Edit campaign":"Create new campaign"}</div>
        <label className="block"><span className={label}>Ad headline</span><input required maxLength={100} className={input} value={form.title} onChange={e=>set("title",e.target.value)}/></label>
        <label className="block"><span className={label}>Ad description</span><textarea rows={3} maxLength={1000} className={input} value={form.body} onChange={e=>set("body",e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className={label}>Image creative</span><input type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-xs" onChange={e=>uploadCreative(e.target.files?.[0],"image")}/>{uploading==="image"&&<span className="text-[10px]">Uploading...</span>}</label>
          <label className="block"><span className={label}>Video creative</span><input type="file" accept="video/mp4,video/webm" className="w-full text-xs" onChange={e=>uploadCreative(e.target.files?.[0],"video")}/>{uploading==="video"&&<span className="text-[10px]">Uploading...</span>}</label>
        </div>
        {(form.image_url||form.video_url)&&<div className="rounded-xl overflow-hidden bg-slate-100">{form.image_url&&<img src={form.image_url} className="max-h-48 w-full object-contain" alt="Ad creative"/>}{form.video_url&&<video src={form.video_url} controls className="max-h-48 w-full"/>}</div>}
        <label className="block"><span className={label}>Destination URL (HTTPS)</span><input className={input} placeholder="https://yourbrand.com" value={form.destination_url} onChange={e=>set("destination_url",e.target.value)}/></label>
        <label className="block"><span className={label}>WhatsApp number (optional)</span><input className={input} placeholder="91XXXXXXXXXX" value={form.whatsapp_number} onChange={e=>set("whatsapp_number",e.target.value)}/></label>
        <label className="block"><span className={label}>Button text</span><input className={input} maxLength={40} value={form.button_text} onChange={e=>set("button_text",e.target.value)}/></label>
        <div><div className={label}>Ad placements</div><div className="grid grid-cols-2 gap-2">{[["feed","Feed sponsored card"],["deals","Deals page"],["banner","Banner / strip"],["popup","Full-screen / popup"]].map(([v,t])=><label key={v} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-xs"><input type="checkbox" checked={form.placements.includes(v)} onChange={()=>togglePlacement(v)}/>{t}</label>)}</div></div>
        <div><div className={label}>Audience targeting</div><select className={input} value={form.target_type} onChange={e=>set("target_type",e.target.value)}><option value="city">City</option><option value="state">State</option><option value="category">Business category</option><option value="all">All users</option></select></div>
        {form.target_type==="city"&&<label className="block"><span className={label}>City</span><input className={input} value={form.target_city} onChange={e=>set("target_city",e.target.value)}/></label>}
        {form.target_type==="state"&&<label className="block"><span className={label}>State</span><input className={input} value={form.target_state} onChange={e=>set("target_state",e.target.value)}/></label>}
        {form.target_type==="category"&&<label className="block"><span className={label}>Category (e.g. Medical, Clothing)</span><input className={input} value={form.target_category} onChange={e=>set("target_category",e.target.value)}/></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className={label}>Billing model</span><select className={input} value={form.billing_model} onChange={e=>set("billing_model",e.target.value)}><option value="cpm">CPM · per 1,000 views</option><option value="cpc">CPC · per click</option></select></label>
          <div className="rounded-xl bg-violet-50 p-3"><div className={label}>Current NearShop rate</div><div className="font-extrabold text-violet-700">{`₹${Number(rates[form.billing_model] || (form.billing_model==="cpm"?100:3)).toLocaleString("en-IN")} ${form.billing_model==="cpm"?"/ 1,000 views":"/ click"}`}</div></div>
        </div>
        <div className="text-[11px] text-slate-500">V1 launch rates. Rates server-side set hain; advertiser unhe change nahi kar sakta.</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className={label}>Start</span><input type="datetime-local" className={input} value={form.start_at} onChange={e=>set("start_at",e.target.value)}/></label>
          <label className="block"><span className={label}>End</span><input type="datetime-local" className={input} value={form.end_at} onChange={e=>set("end_at",e.target.value)}/></label>
        </div>
        <label className="block"><span className={label}>Campaign budget (₹, minimum ₹100)</span><input type="number" min="100" step="1" required className={input} value={form.budget} onChange={e=>set("budget",e.target.value)}/></label>
        <div className="rounded-xl bg-amber-50 text-amber-800 p-3 text-xs">Budget campaign submit karte waqt wallet se reserve hoga. Approved campaign par selected CPM/CPC rate ke mutabiq views/clicks charge honge; budget khatam hone par campaign automatically rukega. Unused amount claim karke wallet mein wapas le sakte hain.</div>
        <button disabled={busy||!!uploading} className="w-full rounded-xl bg-violet-600 text-white py-3 font-bold">{busy?"Saving...":"Save campaign draft"}</button>
        <button type="button" onClick={()=>{setEditing(null);setForm(blank());setTab("overview");}} className="w-full py-2 text-xs text-slate-500">Cancel</button>
      </form>}
      {account && tab==="wallet" && <>
        <div className="bg-white rounded-2xl p-4"><div className="text-xs text-slate-500">Available wallet balance</div><div className="text-3xl font-extrabold text-violet-700">{money(wallet.balance)}</div></div>
        <form onSubmit={requestTopup} className="bg-white rounded-2xl p-4 space-y-3">
          <div className="font-bold">Request wallet top-up</div>
          <p className="text-xs text-slate-500">UPI/bank payment ka reference submit karein. Admin manual verification ke baad wallet credit hoga. App abhi payment gateway se paise collect nahi karta.</p>
          {!isApproved&&<p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">Wallet top-up ke liye advertiser account approval zaroori hai.</p>}
          <label className="block"><span className={label}>Amount (minimum ₹100)</span><input type="number" min="100" className={input} value={topup.amount} onChange={e=>setTopup(p=>({...p,amount:e.target.value}))}/></label>
          <label className="block"><span className={label}>Payment method</span><select className={input} value={topup.method} onChange={e=>setTopup(p=>({...p,method:e.target.value}))}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash / Admin assisted</option></select></label>
          <label className="block"><span className={label}>UTR / transaction reference</span><input required className={input} value={topup.reference} onChange={e=>setTopup(p=>({...p,reference:e.target.value}))}/></label>
          <button disabled={busy||!isApproved} className="w-full rounded-xl bg-violet-600 text-white py-3 font-bold disabled:opacity-50">Submit top-up request</button>
        </form>
        <div className="bg-white rounded-2xl p-4"><div className="font-bold mb-2">Top-up requests</div>{wallet.topups.length?wallet.topups.map(t=><div key={t.id} className="py-2 border-b last:border-0 text-xs flex justify-between"><span>{money(t.amount)} · {t.payment_reference}</span><b>{t.status}</b></div>):<div className="text-xs text-slate-400">No requests yet.</div>}</div>
        <div className="bg-white rounded-2xl p-4"><div className="font-bold mb-2">Wallet ledger</div>{wallet.transactions.length?wallet.transactions.map((t,i)=><div key={i} className="py-2 border-b last:border-0 flex justify-between text-xs"><span>{t.note||t.transaction_type}</span><b className={Number(t.amount)<0?"text-red-600":"text-emerald-600"}>{Number(t.amount)<0?"−":"+"}{money(Math.abs(Number(t.amount)))}</b></div>):<div className="text-xs text-slate-400">No transactions yet.</div>}</div>
      </>}
    </div>
  </div>;
}
