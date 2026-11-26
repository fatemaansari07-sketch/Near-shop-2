import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const pill=s=>`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${s==="approved"?"bg-emerald-100 text-emerald-700":s==="rejected"||s==="suspended"?"bg-red-100 text-red-700":s==="pending_review"||s==="pending"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600"}`;

export default function AdvertiserAdmin({adminPassword,users=[]}) {
  const [tab,setTab]=useState("accounts");
  const [assist,setAssist]=useState({user_id:"",brand_name:"",contact_name:"",contact_email:"",phone:"",city:"Surat",state:"Gujarat"});
  const [assistBusy,setAssistBusy]=useState(false);
  const [accounts,setAccounts]=useState([]);
  const [campaigns,setCampaigns]=useState([]);
  const [topups,setTopups]=useState([]);
  const [payment,setPayment]=useState({upi_id:"",payee_name:"NearShop",qr_image_url:"",bank_name:"",account_name:"",account_number:"",ifsc:"",instructions:""});
  const [paymentBusy,setPaymentBusy]=useState(false);
  const [paymentMessage,setPaymentMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [note,setNote]=useState({});
  const load=useCallback(async()=>{
    setError("");
    const [a,c,t,pay]=await Promise.all([
      supabase.rpc("admin_advertiser_accounts",{p_password:adminPassword}),
      supabase.rpc("admin_advertiser_campaigns",{p_password:adminPassword}),
      supabase.rpc("admin_advertiser_topups",{p_password:adminPassword}),
      supabase.from("platform_settings").select("settings").eq("id","advertiser_payment").maybeSingle()
    ]);
    const bad=[a.error,c.error,t.error].find(Boolean);
    if(bad){setError(bad.message);return;}
    setAccounts(a.data||[]);setCampaigns(c.data||[]);setTopups(t.data||[]);if(pay.data?.settings)setPayment(p=>({...p,...pay.data.settings}));
  },[adminPassword]);
  useEffect(()=>{load();},[load]);
  const createAssisted = async e => {
    e.preventDefault();setError("");setAssistBusy(true);
    const {error:e1}=await supabase.rpc("admin_create_advertiser",{p_password:adminPassword,p_user_id:assist.user_id,p_payload:assist});
    setAssistBusy(false);
    if(e1){setError(e1.message);return;}
    setAssist({user_id:"",brand_name:"",contact_name:"",contact_email:"",phone:"",city:"Surat",state:"Gujarat"});
    await load();
  };
  const savePayment=async e=>{
    e.preventDefault();setPaymentBusy(true);setError("");setPaymentMessage("");
    const clean={...payment,upi_id:String(payment.upi_id||"").trim(),payee_name:String(payment.payee_name||"NearShop").trim(),qr_image_url:String(payment.qr_image_url||"").trim(),bank_name:String(payment.bank_name||"").trim(),account_name:String(payment.account_name||"").trim(),account_number:String(payment.account_number||"").trim(),ifsc:String(payment.ifsc||"").trim(),instructions:String(payment.instructions||"").trim()};
    if(clean.qr_image_url && !/^https:\/\//i.test(clean.qr_image_url)){setPaymentBusy(false);setError("QR image URL HTTPS hona chahiye.");return;}
    const {data,error:e1}=await supabase.rpc("admin_update_platform_setting",{p_password:adminPassword,p_id:"advertiser_payment",p_settings:clean});
    setPaymentBusy(false);if(e1||data!==true){setError(e1?.message||"Payment settings save nahi hui.");return;}
    setPaymentMessage("Advertiser payment details save ho gayi.");
  };
  const act=async(fn,args,successText)=>{
    setBusy(true);setError("");setSuccess("");
    try {
      const {data,error:e}=await supabase.rpc(fn,{p_password:adminPassword,...args});
      if(e) throw e;
      const ok = data===true || data==="true" || (Array.isArray(data) && data[0]===true);
      if(!ok) throw new Error("Database ne update confirm nahi kiya. Refresh karke status dobara check karein.");
      await load();
      setSuccess(successText || "Update successful. List refresh ho gayi.");
    } catch(err) {
      setError(err?.message || "Action complete nahi hui.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="px-5 mt-4 space-y-3">
    <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 text-white p-4">
      <div className="font-extrabold text-lg">External Advertisers</div>
      <div className="text-xs text-white/80 mt-1">Brand accounts, paid campaign review aur wallet top-ups.</div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-white/15 rounded-xl p-2"><b className="text-xl">{accounts.length}</b><div className="text-[10px]">Accounts</div></div>
        <div className="bg-white/15 rounded-xl p-2"><b className="text-xl">{campaigns.length}</b><div className="text-[10px]">Campaigns</div></div>
        <div className="bg-white/15 rounded-xl p-2"><b className="text-xl">{topups.filter(x=>x.status==="pending").length}</b><div className="text-[10px]">Top-ups pending</div></div>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto">{[["accounts","Advertisers"],["campaigns","Campaigns"],["topups","Wallet top-ups"],["payment","Payment settings"]].map(([v,t])=><button key={v} onClick={()=>setTab(v)} className={`px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap ${tab===v?"bg-violet-600 text-white":"bg-white border text-slate-600"}`}>{t}</button>)}</div>
    {error&&<div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs">{error}</div>}
    {success&&<div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs font-semibold">{success}</div>}
    {tab==="accounts"&&<div className="space-y-3">
      <form onSubmit={createAssisted} className="bg-white rounded-2xl p-4 space-y-2 border border-violet-100">
        <div className="font-bold text-sm">Admin-assisted registration</div>
        <div className="text-[10px] text-slate-500">Existing NearShop user ke behalf par advertiser profile create karein. New account pending approval hi rahega.</div>
        <select required className="w-full border rounded-lg px-3 py-2 text-xs" value={assist.user_id} onChange={e=>setAssist(p=>({...p,user_id:e.target.value}))}><option value="">Select NearShop user</option>{users.map(u=><option key={u.id} value={u.id}>{u.name||"User"} · {u.phone||u.email||u.id}</option>)}</select>
        <input required className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Brand / business name" value={assist.brand_name} onChange={e=>setAssist(p=>({...p,brand_name:e.target.value}))}/>
        <div className="grid grid-cols-2 gap-2"><input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Contact name" value={assist.contact_name} onChange={e=>setAssist(p=>({...p,contact_name:e.target.value}))}/><input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Phone" value={assist.phone} onChange={e=>setAssist(p=>({...p,phone:e.target.value}))}/></div>
        <input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Contact email" value={assist.contact_email} onChange={e=>setAssist(p=>({...p,contact_email:e.target.value}))}/>
        <button disabled={assistBusy||!users.length} className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-xs font-bold">Create pending advertiser account</button>
      </form>
      {accounts.length===0&&<div className="bg-white rounded-xl p-4 text-xs text-slate-500">No advertiser registrations yet.</div>}
      {accounts.map(a=><div key={a.id} className="bg-white rounded-2xl p-4 space-y-2 shadow-sm">
        <div className="flex justify-between gap-2"><div className="font-bold text-sm">{a.brand_name}</div><span className={pill(a.status)}>{a.status}</span></div>
        <div className="text-xs text-slate-600">{a.contact_name||"No contact"} · {a.phone||"No phone"}</div>
        <div className="text-xs text-slate-500">{a.contact_email||""} · {a.city}, {a.state}</div>
        {a.website&&<a className="text-xs text-violet-600 underline break-all" href={a.website} target="_blank" rel="noreferrer">{a.website}</a>}
        <input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Admin note (optional)" value={note[a.id]||""} onChange={e=>setNote(p=>({...p,[a.id]:e.target.value}))}/>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>act("admin_review_advertiser",{p_advertiser:a.id,p_status:"approved",p_note:note[a.id]||null},"Advertiser account approve ho gaya.")} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold">Approve</button>
          <button disabled={busy} onClick={()=>act("admin_review_advertiser",{p_advertiser:a.id,p_status:"rejected",p_note:note[a.id]||null},"Advertiser request reject ho gayi.")} className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs font-bold">Reject</button>
          <button disabled={busy} onClick={()=>act("admin_review_advertiser",{p_advertiser:a.id,p_status:"suspended",p_note:note[a.id]||null},"Advertiser account suspend ho gaya.")} className="rounded-lg bg-slate-100 text-slate-700 px-3 py-2 text-xs font-bold">Suspend</button>
        </div>
      </div>)}
    </div>}
    {tab==="campaigns"&&<div className="space-y-3">{campaigns.length===0&&<div className="bg-white rounded-xl p-4 text-xs text-slate-500">No advertiser campaigns yet.</div>}
      {campaigns.map(c=><div key={c.id} className="bg-white rounded-2xl p-4 space-y-2 shadow-sm">
        <div className="flex justify-between gap-2"><div><div className="text-[10px] text-violet-600 font-bold">{c.brand_name}</div><div className="font-bold text-sm">{c.title}</div></div><span className={pill(c.status)}>{c.status.replace("_"," ")}</span></div>
        {c.image_url&&<img src={c.image_url} alt="" className="max-h-44 w-full object-contain bg-slate-50 rounded-xl"/>}
        {c.video_url&&<video src={c.video_url} controls className="max-h-44 w-full rounded-xl"/>}
        <p className="text-xs text-slate-600">{c.body}</p>
        <div className="text-xs text-slate-500">Placement: {(c.placements||[]).join(", ")} · Target: {c.target_type==="city"?c.target_city:c.target_type==="state"?c.target_state:c.target_type==="category"?c.target_category:"All users"}</div>
        <div className="text-xs font-semibold">Budget: {money(c.budget)} · Spent: {money(c.spent)} · Remaining: {money(c.budget_remaining)}</div>
        <div className="text-xs text-slate-500">{String(c.billing_model||"cpm").toUpperCase()} · {money(c.rate)} {c.billing_model==="cpm"?"/ 1,000 views":"/ click"} · Payment: {c.payment_status}</div>
        <div className="text-xs text-slate-500">Views {c.impressions||0} · Clicks {c.clicks||0} · {new Date(c.start_at).toLocaleDateString()} – {new Date(c.end_at).toLocaleDateString()}</div>
        {c.destination_url&&<a href={c.destination_url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 underline break-all">Destination URL</a>}
        <input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Review note / rejection reason" value={note[c.id]||""} onChange={e=>setNote(p=>({...p,[c.id]:e.target.value}))}/>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>act("admin_review_advertiser_campaign",{p_campaign:c.id,p_status:"approved",p_note:note[c.id]||null})} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold">Approve & publish</button>
          <button disabled={busy} onClick={()=>act("admin_review_advertiser_campaign",{p_campaign:c.id,p_status:"rejected",p_note:note[c.id]||null})} className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs font-bold">Reject</button>
          {c.status==="approved"&&<button disabled={busy} onClick={()=>act("admin_review_advertiser_campaign",{p_campaign:c.id,p_status:"paused",p_note:note[c.id]||null})} className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-xs font-bold">Pause</button>}
        </div>
      </div>)}
    </div>}
    {tab==="payment"&&<form onSubmit={savePayment} className="bg-white rounded-2xl p-4 space-y-3">
      <div className="font-bold">Advertiser wallet payment details</div>
      <p className="text-xs text-slate-500">Ye details advertisers ko wallet top-up ke waqt dikhengi. Sirf apne verified NearShop business payment account ki details enter karein.</p>
      <label className="block text-xs font-semibold">UPI ID<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="yourname@bank" value={payment.upi_id} onChange={e=>setPayment(p=>({...p,upi_id:e.target.value}))}/></label>
      <label className="block text-xs font-semibold">Payee name<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={payment.payee_name} onChange={e=>setPayment(p=>({...p,payee_name:e.target.value}))}/></label>
      <label className="block text-xs font-semibold">Public QR image URL (HTTPS)<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://.../nearshop-qr.png" value={payment.qr_image_url} onChange={e=>setPayment(p=>({...p,qr_image_url:e.target.value}))}/></label>
      <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-semibold">Bank name<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={payment.bank_name} onChange={e=>setPayment(p=>({...p,bank_name:e.target.value}))}/></label><label className="block text-xs font-semibold">IFSC<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={payment.ifsc} onChange={e=>setPayment(p=>({...p,ifsc:e.target.value.toUpperCase()}))}/></label></div>
      <label className="block text-xs font-semibold">Account holder name<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={payment.account_name} onChange={e=>setPayment(p=>({...p,account_name:e.target.value}))}/></label>
      <label className="block text-xs font-semibold">Account number<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={payment.account_number} onChange={e=>setPayment(p=>({...p,account_number:e.target.value}))}/></label>
      <label className="block text-xs font-semibold">Payment instructions<textarea rows={3} maxLength={500} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="Payment karne ke baad UTR submit karein..." value={payment.instructions} onChange={e=>setPayment(p=>({...p,instructions:e.target.value}))}/></label>
      {payment.qr_image_url&&/^https:\/\//i.test(payment.qr_image_url)&&<img src={payment.qr_image_url} alt="Payment QR preview" className="w-40 h-40 object-contain border rounded-xl p-2"/>}
      {paymentMessage&&<div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">{paymentMessage}</div>}
      <button disabled={paymentBusy} className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-bold">{paymentBusy?"Saving...":"Save payment details"}</button>
    </form>}
    {tab==="topups"&&<div className="space-y-3">{topups.length===0&&<div className="bg-white rounded-xl p-4 text-xs text-slate-500">No wallet requests yet.</div>}
      {topups.map(t=><div key={t.id} className="bg-white rounded-2xl p-4 space-y-2">
        <div className="flex justify-between"><b className="text-sm">{t.brand_name}</b><span className={pill(t.status)}>{t.status}</span></div>
        <div className="text-xl font-extrabold">{money(t.amount)}</div>
        <div className="text-xs text-slate-500">{t.payment_method} · Ref: {t.payment_reference}</div>
        <input className="w-full border rounded-lg px-3 py-2 text-xs" placeholder="Admin verification note" value={note[t.id]||""} onChange={e=>setNote(p=>({...p,[t.id]:e.target.value}))}/>
        {t.status==="pending"&&<div className="flex gap-2"><button disabled={busy} onClick={()=>act("admin_review_advertiser_topup",{p_request:t.id,p_approve:true,p_note:note[t.id]||null})} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold">Verify & credit wallet</button><button disabled={busy} onClick={()=>act("admin_review_advertiser_topup",{p_request:t.id,p_approve:false,p_note:note[t.id]||null})} className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs font-bold">Reject</button></div>}
      </div>)}
    </div>}
    <button onClick={load} className="w-full bg-white border rounded-xl py-2 text-xs font-bold text-slate-600">Refresh data</button>
  </div>;
}
