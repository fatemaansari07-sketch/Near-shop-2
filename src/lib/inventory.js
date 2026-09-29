const KEY='shopnear_inventory_meta_v3';
export function getInventoryMeta(id){try{return JSON.parse(localStorage.getItem(KEY)||'{}')[id]||{}}catch{return {}}}
export function setInventoryMeta(id,meta){try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');all[id]={...(all[id]||{}),...meta};localStorage.setItem(KEY,JSON.stringify(all))}catch{}}
export function displayPackStock(stock,packSize=10){const units=Number(stock)||0;const size=Math.max(1,Number(packSize)||10);return `${Math.floor(units/size)} strips · ${Math.round(units%size)} loose tablets · ${Math.round(units)} tablets total`}
export function saleToBaseUnits(product,qty,subUnit){const q=Math.max(0,Number(qty)||0);if(product?.unit==='pack'){const size=Math.max(1,Number(product.packSize)||10);return /strip/i.test(subUnit||'')?q*size:q}return q}
export function saleLineTotal(product,baseUnits){if(product?.unit==='pack'){const size=Math.max(1,Number(product.packSize)||10);return +((Number(baseUnits)||0)*(Number(product.price)||0)/size).toFixed(2)}return +((Number(baseUnits)||0)*(Number(product.price)||0)).toFixed(2)}
