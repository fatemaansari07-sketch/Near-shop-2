const KEY = "shopnear_inventory_meta_v1";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
export const getInventoryMeta = (productId) => read()[productId] || {};
export const setInventoryMeta = (productId, meta) => { const all = read(); all[productId] = { ...(all[productId] || {}), ...meta }; write(all); };
export const clearInventoryMeta = (productId) => { const all = read(); delete all[productId]; write(all); };
export function displayPackStock(stock, packSize = 10, packLabel = "strip", subLabel = "tab") {
  const s = Number(stock || 0);
  const size = Number(packSize || 0);
  if (!size || s < 0) return `${s} ${packLabel}`;
  const whole = Math.floor(s + 1e-9);
  const fraction = Math.round((s - whole) * size);
  if (!fraction) return `${whole} ${packLabel}${whole === 1 ? "" : "s"}`;
  if (!whole) return `${fraction} ${subLabel}${fraction === 1 ? "" : "s"}`;
  return `${whole} ${packLabel}${whole === 1 ? "" : "s"} + ${fraction} ${subLabel}${fraction === 1 ? "" : "s"}`;
}
export function saleToBaseUnits(product, qty, subUnit) {
  const n = Number(qty || 0);
  if (product.unit === "pack") {
    const size = Number(product.packSize || 10);
    if (/^(tablet|tablets|tab|tabs|goli|goliyan)$/i.test(subUnit || "")) return n / size;
    return n;
  }
  if (product.unit === "weight" && /^(g|gram|grams)$/i.test(subUnit || "")) return n / 1000;
  if (product.unit === "volume" && /^ml$/i.test(subUnit || "")) return n / 1000;
  if (product.unit === "length" && /^(cm)$/i.test(subUnit || "")) return n / 100;
  return n;
}
