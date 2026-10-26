import { supabase } from "../../supabaseClient";

// sales_log me qty ka unit: pack -> goli, piece -> pcs, baaki (kg/L/m) -> gram/ml/cm
const logQty = (i) => (i.unit === "pack" ? Math.round(i.baseQty) : i.unit === "piece" ? i.qty : Math.round(i.baseQty * 1000));

// Ek hi database transaction: stock kam + sales_log + bill + udhar entry. Fail hua to kuch bhi nahi badalta.
export async function completeSaleRpc(shopId, items, meta = {}) {
  const payload = items.map((i) => ({ product_id: i.productId, name: i.name, sold_qty: i.baseQty, log_qty: logQty(i), line_total: i.lineTotal }));
  const { data, error } = await supabase.rpc("complete_sale", {
    p_shop_id: shopId, p_items: payload, p_payment: meta.payment || "paid",
    p_customer_id: meta.customerId || null, p_customer_label: meta.customerLabel || null, p_customer_phone: meta.customerPhone || null,
    p_subtotal: meta.subtotal || 0, p_discount_pct: meta.discountPct || 0, p_discount_amount: meta.discountAmt || 0, p_total: meta.total || 0, p_note: meta.note || null,
  });
  if (error) {
    const m = error.message || "";
    if (m.includes("STOCK_LOW:")) return { error: `${m.split("STOCK_LOW:")[1].trim()} ka stock kam hai (shayad doosre phone se bik gaya). Kuch bhi save nahi hua, dobara try kariye.`, stock: true };
    if (/complete_sale/.test(m) && /not find|does not exist|schema cache/i.test(m)) return { error: "Setup baaki hai: Supabase me 20261015_atomic_sale.sql Run kariye." };
    return { error: "Sale save nahi hui: " + m };
  }
  return { billId: data };
}

export async function undoSaleRpc(billId) {
  const { error } = await supabase.rpc("void_sale", { p_bill_id: billId });
  if (!error) return { ok: true };
  const m = error.message || "";
  if (m.includes("UNDO_EXPIRED")) return { error: "Undo sirf 15 minute ke andar ho sakta hai." };
  return { error: m.replace(/^.*?:\s*/, "") || "Undo nahi hua." };
}

export async function recentBills(shopId, limit = 10) {
  const { data } = await supabase.from("bills").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(limit);
  return data || [];
}
export const billNo = (id) => String(id || "").replace(/-/g, "").slice(-6).toUpperCase();
