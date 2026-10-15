import { supabase } from "../../supabaseClient";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const cleanUsername = (u) => String(u || "").trim().toLowerCase().replace(/^@/, "");

// + means customer owes the shop.
export const signedAmount = (e) => {
  const a = Number(e.amount) || 0;
  if (e.kind === "sale") return 0; // cash/UPI sale: sirf loyalty record, hisaab par asar nahi
  if (e.kind === "udhar") return e.party === "customer" ? a : -a;
  return e.party === "customer" ? -a : a;
};
// Counts once the other side confirms; a shop's own udhar entry counts immediately (until disputed).
export const countsInBalance = (e) =>
  e.status === "confirmed" || (e.status === "pending" && e.kind === "udhar" && e.created_by === "shop" && e.party === "customer");
export const balanceOf = (entries) => +entries.filter(countsInBalance).reduce((s, e) => s + signedAmount(e), 0).toFixed(2);
// Kul len-den (loyalty): udhar diya hua + counter pe paid sales. Payment dobara "kharid" nahi gina jata.
const isPurchase = (e) => e.status !== "disputed" && (e.kind === "sale" || (e.kind === "udhar" && e.party === "customer"));
export const volumeOf = (entries) => +entries.filter(isPurchase).reduce((s, e) => s + (Number(e.amount) || 0), 0).toFixed(2);
export const purchaseCount = (entries) => entries.filter(isPurchase).length;

export const phoneDigits = (p) => { const d = String(p || "").replace(/\D/g, ""); if (d.length === 10) return "91" + d; if (d.length === 12 && d.startsWith("91")) return d; return d.length >= 11 ? d : ""; };
export const waLink = (phone, text) => { const n = phoneDigits(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : ""; };
const inr = (n) => "₹" + Math.abs(Math.round(Number(n) * 100) / 100).toLocaleString("en-IN");
export function entryMessage(e, shopName, name, bal) {
  const tail = Math.abs(bal) < 0.005 ? "Hisaab barabar ✅" : bal > 0 ? `Kul baaki: ${inr(bal)}` : `Hum aapko ${inr(bal)} denge`;
  if (e.kind === "udhar" && e.party === "customer") return `Namaste ${name} ji, ${shopName} me aapke naam ${inr(e.amount)} udhar likha gaya hai. ${tail}. Dhanyavaad 🙏 (NearShop)`;
  if (e.kind === "udhar") return `Namaste ${name} ji, ${shopName} ko aapko ${inr(e.amount)} dene hain (hisaab me likha gaya). ${tail}. (NearShop)`;
  if (e.party === "customer") return `Namaste ${name} ji, ${inr(e.amount)} ka payment mil gaya, dhanyavaad! ${tail} — ${shopName} (NearShop)`;
  return `Namaste ${name} ji, ${shopName} ne aapko ${inr(e.amount)} diye (hisaab me likha gaya). ${tail}. (NearShop)`;
}
export const reminderMessage = (shopName, name, bal) => `Namaste ${name} ji, ${shopName} me aapka ${inr(bal)} baaki hai. Jab suvidha ho tab de dijiye. Dhanyavaad 🙏 (NearShop)`;

export const needsMyAction = (e, role) => e.status === "pending" && e.created_by !== role;

export async function getMyUsername(userId) {
  const { data } = await supabase.from("users").select("username").eq("id", userId).maybeSingle();
  return data?.username || "";
}
export async function setUsername(userId, raw) {
  const u = cleanUsername(raw);
  if (!USERNAME_RE.test(u)) return { error: "3 se 20 chhote letters/numbers/_ hi chalenge." };
  const { error } = await supabase.from("users").update({ username: u }).eq("id", userId);
  if (error) return { error: error.code === "23505" ? "Ye username pehle se kisi ka hai." : error.message };
  return { username: u };
}
export async function findUser(raw) {
  const u = cleanUsername(raw);
  if (!u) return null;
  const { data } = await supabase.from("users").select("id,name,username,phone").eq("username", u).maybeSingle();
  return data || null;
}

export async function createEntry({ shopId, customerId = null, customerLabel = null, customerPhone = null, kind, party, amount, note = "", createdBy }) {
  const amt = +Number(amount).toFixed(2);
  if (!(amt > 0)) return { error: "Amount sahi daaliye." };
  const row = {
    shop_id: shopId, customer_id: customerId, customer_label: customerId ? null : customerLabel,
    kind, party, amount: amt, note, created_by: createdBy,
    status: kind === "sale" || !customerId ? "confirmed" : "pending", // sale/app ke bina customer: confirm ki zarurat nahi
  };
  if (customerPhone) row.customer_phone = customerPhone;
  const { data, error } = await supabase.from("khata_entries").insert(row).select().single();
  return error ? { error: error.message } : { data };
}
export async function setStatus(id, status) {
  const { error } = await supabase.from("khata_entries").update({ status, confirmed_at: status === "confirmed" ? new Date().toISOString() : null }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
export async function loadShopKhata(shopId) {
  const [e, l] = await Promise.all([
    supabase.from("khata_entries").select("*, users:customer_id(name,username,phone)").eq("shop_id", shopId).order("created_at", { ascending: false }),
    supabase.from("khata_links").select("customer_id, users:customer_id(name,username,phone)").eq("shop_id", shopId),
  ]);
  return { entries: e.data || [], links: l.data || [] };
}
export async function loadCustomerKhata(userId) {
  const { data } = await supabase.from("khata_entries").select("*, shops:shop_id(name,phone)").eq("customer_id", userId).order("created_at", { ascending: false });
  return data || [];
}
export async function linkCustomer(shopId, customerId) {
  await supabase.from("khata_links").upsert({ shop_id: shopId, customer_id: customerId }, { onConflict: "shop_id,customer_id" });
}
export async function countPending(userId, shopIds = []) {
  const head = { count: "exact", head: true };
  const q1 = supabase.from("khata_entries").select("id", head).eq("customer_id", userId).eq("status", "pending").eq("created_by", "shop");
  const q2 = shopIds.length ? supabase.from("khata_entries").select("id", head).in("shop_id", shopIds).eq("status", "pending").eq("created_by", "customer") : null;
  const [a, b] = await Promise.all([q1, q2 || Promise.resolve({ count: 0 })]);
  return (a.count || 0) + (b.count || 0);
}
export async function listLinks(shopId) {
  const { data } = await supabase.from("khata_links").select("customer_id, users:customer_id(name,username,phone)").eq("shop_id", shopId);
  return (data || []).map((x) => ({ id: x.customer_id, name: x.users?.name, username: x.users?.username, phone: x.users?.phone }));
}

export async function customerBalance(shopId, cust) {
  let q = supabase.from("khata_entries").select("*").eq("shop_id", shopId);
  q = cust.id ? q.eq("customer_id", cust.id) : q.eq("customer_label", cust.name);
  const { data } = await q;
  return balanceOf(data || []);
}
