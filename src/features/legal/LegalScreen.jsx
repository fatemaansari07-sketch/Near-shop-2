import React from "react";
import { ArrowLeft } from "lucide-react";

// TODO: apna support email yahan likho (Play Store ke liye zaroori). Khali rakha to contact line nahi dikhegi.
const CONTACT_EMAIL = "";
const UPDATED = "29 October 2026";

const PRIVACY = [
  ["ShopNear kya hai", ["ShopNear ek local shopping app hai jo aas-paas ki dukaanon ko customers se jodta hai: dukaan dhundhna, deals, bid, udhar khata aur billing."]],
  ["Hum kaunsi jaankari lete hain", [
    "• Account: aapka naam, mobile number, referral code, points.",
    "• Location: aapki location, sirf doori dikhane ke liye aur sirf jab aap phone me allow karein.",
    "• Dukaan wale: dukaan ka naam, address, phone, category, products, price, stock aur photos.",
    "• Bikri aur bill: kya bika, kitna, kitne ka. Customer ka naam tabhi jab dukaan wala use bill ke saath jode.",
    "• Udhar khata: entry ki rakam, tareekh, note aur dono taraf ke naam/username.",
    "• Aapki posts: bid, Need It requests, reviews, feed aur broadcast messages.",
    "• Voice: aapki awaaz ko aapke phone/browser ki speech service (jaise Google) text me badalti hai. ShopNear awaaz record ya save nahi karta, sirf wo text use karta hai.",
    "• Phone ki storage: login session, voice ki bhasha, kaunsi deals dekh li gayi.",
  ]],
  ["Kyun use karte hain", ["Dukaan aur deals dikhane, doori batane, bill/khata chalane, notification dikhane, galat istemaal rokne aur app behtar banane ke liye."]],
  ["Kisko kya dikhta hai", [
    "• Dukaan ki jaankari, products, deals aur broadcast sabhi users ko dikhte hain.",
    "• Bid me aapka naam dukaan wale ko dikhta hai. Aapka mobile number dukaan wale ko tabhi dikhta hai jab aap uska offer chunte hain.",
    "• Udhar khata sirf us dukaan aur us customer ko dikhta hai jinke beech entry hai.",
    "• Bikri ke aankde area aur product ke hisaab se jodkar (bina naam aur mobile number ke) trends ke roop me dikhaye ja sakte hain.",
    "• Hum aapka naam ya mobile number kisi third party ko nahi bechte.",
  ]],
  ["Data kahan rakha jata hai", ["Database aur photos Supabase par, aur app Vercel par chalta hai. In services ke server India ke bahar bhi ho sakte hain."]],
  ["Kitne din rakha jata hai", [
    "• Account, bill aur khata entries tab tak rahti hain jab tak aap ya dukaan wala unhe delete na kare ya aap delete maange.",
    "• Dukaan wala apne bill app me se delete kar sakta hai. Galti hone par 15 minute ke andar sale undo ho sakti hai.",
    "• Bid aur Need It requests purani hone par hat sakti hain.",
  ]],
  ["Aapke adhikaar", [
    "Aap apna data dekhne, sudharne ya delete karwane ke liye kah sakte hain. Location aur mic ki permission aap phone ki settings se kabhi bhi band kar sakte hain.",
  ]],
  ["Bachche", ["Ye app 13 saal se chhote bachchon ke liye nahi hai."]],
  ["Suraksha", ["Hum data surakshit rakhne ki koshish karte hain, par koi bhi online system 100% surakshit nahi hota."]],
  ["Badlav", ["Ye policy badal sakti hai. Naya version yahin dikhega aur upar ki tareekh badal jayegi."]],
];

const TERMS = [
  ["Service ke baare me", ["ShopNear jaankari aur sampark ka madhyam hai. Kharid-bikri customer aur dukaan ke beech hoti hai. ShopNear dukaan ke saaman, price ya service ki guarantee nahi deta."]],
  ["Dukaan walon ki zimmedari", [
    "• Price, stock, expiry aur product ki jaankari sahi rakhein.",
    "• Nakli, galat, kanooni roop se pratibandhit ya nasheele padarth na bechein/dikhayein.",
    "• Deals, coupon aur broadcast me jo likhein wo sach hona chahiye aur dukaan par maanya hona chahiye.",
  ]],
  ["Dawai aur health", ["App koi medical salah nahi deta. Dawai doctor ya pharmacist ki salah se hi lein. Expiry aur batch dukaan se confirm karein."]],
  ["Bill aur udhar khata", ["Ye dono taraf ki suvidha ke liye ek record hai, kanooni saboot nahi. Kisi bhi aapsi vivad ko dono pakshon ko khud sulajhana hoga."]],
  ["Paid features", ["Kuch paid features abhi muft ya test mode me ho sakte hain. Baad me shulk lagne se pehle batayenge."]],
  ["Galat istemaal", ["Spam, jhooti reviews, doosron ke naam se login ya app ko nuksan pahunchane par account block kiya ja sakta hai."]],
  ["Zimmedari ki seema", ["App jaisa hai waisa (as is) diya ja raha hai. Kisi dukaan ya user ki galti se hue nuksan ke liye ShopNear zimmedar nahi hoga."]],
  ["Badlav aur kanoon", ["Ye shartein badal sakti hain. Is par Bharat ke kanoon lagu honge."]],
];

export default function LegalScreen({ doc = "privacy", onBack, onSwitch }) {
  const items = doc === "terms" ? TERMS : PRIVACY;
  return <div className="min-h-screen bg-gray-50">
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 text-white px-5 pt-6 pb-5 rounded-b-3xl">
        <button onClick={onBack} className="mb-3"><ArrowLeft size={20}/></button>
        <div className="text-2xl font-extrabold">{doc === "terms" ? "Terms of Use" : "Privacy Policy"}</div>
        <div className="text-white/70 text-xs mt-1">Last updated: {UPDATED}</div>
        <div className="flex gap-2 mt-3">{[["privacy", "Privacy Policy"], ["terms", "Terms"]].map(([k, l]) => <button key={k} onClick={() => onSwitch?.(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${doc === k ? "bg-white text-violet-700" : "bg-white/20"}`}>{l}</button>)}</div>
      </div>
      <div className="px-5 py-4 space-y-4 pb-16">
        {items.map(([h, lines], i) => <div key={h} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="font-extrabold text-sm mb-1.5">{i + 1}. {h}</div>
          {lines.map((l, j) => <p key={j} className="text-[13px] text-gray-600 leading-relaxed">{l}</p>)}
        </div>)}
        {CONTACT_EMAIL && <div className="text-center text-xs text-gray-500">Sawal ya data delete karwane ke liye: <a className="text-violet-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>}
      </div>
    </div>
  </div>;
}
