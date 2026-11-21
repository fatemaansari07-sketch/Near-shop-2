export const SERVICE_CATEGORIES = [
  ["Painter / Rang-Rogan", "🎨"], ["Electrician", "💡"], ["Plumber", "🚿"], ["Carpenter", "🪚"], ["Mistri / Construction", "🧱"],
  ["AC / Fridge Repair", "❄️"], ["Mobile / Laptop Repair", "📱"], ["Tutor / Teacher", "📚"], ["Driver", "🚗"], ["Photographer", "📷"],
  ["Tailor", "🧵"], ["Cleaning / Pest Control", "🧹"], ["Beautician / Salon", "💇"], ["Property / Land Dealer", "🏡"], ["Other", "🛠️"],
];
export const iconOf = (cat) => (SERVICE_CATEGORIES.find((c) => c[0] === cat) || ["", "🛠️"])[1];
export const isProperty = (cat) => /property|land/i.test(cat || "");
// only render images from https or our own compressed data URLs
export const safeImg = (u) => (/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(u || "") ? u : null);
export const telHref = (p) => `tel:${String(p || "").replace(/[^0-9+]/g, "")}`;
export const waHref = (p, text) => { const d = String(p || "").replace(/[^0-9]/g, ""); const n = d.length === 10 ? "91" + d : d; return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`; };
export const isFeatured = (p) => !!p.featured_until && new Date(p.featured_until) > new Date();

// Phone photo -> small JPEG data URL (kept inside the row, no storage setup needed)
export async function toDataUrl(file, max = 800, quality = 0.72, cap = 200000) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  for (const q of [quality, 0.6, 0.48, 0.38]) { const u = c.toDataURL("image/jpeg", q); if (u.length <= cap) return u; }
  return c.toDataURL("image/jpeg", 0.3);
}
