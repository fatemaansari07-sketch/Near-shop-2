import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function DealInterestInbox({ shops }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const ids = shops.map(s => s.id).filter(Boolean);
  useEffect(() => {
    let live = true;
    if (!ids.length) return () => { live = false; };
    supabase.from("deal_interests").select("id,shop_id,product_id,offer_price,created_at").in("shop_id", ids).order("created_at", { ascending: false }).limit(30)
      .then(({ data, error: e }) => { if (!live) return; if (e) setError("Interest leads load nahi hue. SQL migration/RLS check karein."); else setItems(data || []); });
    return () => { live = false; };
  }, [ids.join("|")]);
  if (!ids.length) return null;
  return <section className="bg-white border border-amber-200 rounded-2xl p-4">
    <div className="font-extrabold text-sm">🔔 Deal Interested Customers</div>
    <div className="text-[10px] text-gray-500 mt-1 mb-2">Jin customers ne aapke active deal par “I'm Interested” dabaya hai.</div>
    {error ? <div className="text-xs text-gray-400">{error}</div> : items.length ? items.map(x => {
      const shop = shops.find(s => s.id === x.shop_id);
      const product = shop?.products.find(p => p.id === x.product_id);
      return <div key={x.id} className="border-t py-2 text-xs flex justify-between gap-2"><span><b>{product?.name || "Product"}</b><span className="block text-gray-400">{shop?.name} · {new Date(x.created_at).toLocaleString("en-IN")}</span></span><b className="text-amber-700">Interested</b></div>;
    }) : <div className="text-xs text-gray-400">Abhi koi interest nahi aaya.</div>}
  </section>;
}
