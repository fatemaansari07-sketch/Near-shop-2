import React, { useMemo, useState } from 'react';
import { Download, Upload, FileSpreadsheet, Check, X } from 'lucide-react';

const normalize = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quoted=!quoted; continue; }
    if (c === ',' && !quoted) { row.push(cell); cell=''; continue; }
    if ((c === '\n' || c === '\r') && !quoted) { if (c==='\r' && n==='\n') i++; row.push(cell); cell=''; if (row.some(x=>String(x).trim())) rows.push(row); row=[]; continue; }
    cell += c;
  }
  row.push(cell); if (row.some(x=>String(x).trim())) rows.push(row);
  if (!rows.length) return [];
  const headers=rows[0].map(h=>normalize(h));
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h, String(values[i]||'').trim()]))).filter(r=>r.name);
};

const normalizeUnit = (v, category) => { const u=normalize(v); if(['strip','strips','packet','pack','box'].includes(u)) return 'pack'; if(['kg','kilo','kilogram'].includes(u)) return 'weight'; if(['l','litre','liter','bottle'].includes(u)) return 'volume'; if(['m','meter','metre'].includes(u)) return 'length'; return 'piece'; };
const num = v => { const n=Number(String(v||'').replace(/[^0-9.]/g,'')); return Number.isFinite(n)?n:null; };

export default function CsvImportPanel({ shops, onImportProducts }) {
  const [shopId,setShopId]=useState(shops[0]?.id||'');
  const [rows,setRows]=useState([]);
  const [fileName,setFileName]=useState('');
  const [busy,setBusy]=useState(false);
  const shop=shops.find(s=>s.id===shopId);
  const mapped=useMemo(()=>rows.map(r=>({
    name:r.name || r.product || r.product_name,
    price:num(r.price || r.selling_price || r.sale_price),
    stock:num(r.stock || r.qty || r.quantity),
    unit:normalizeUnit(r.unit, shop?.category),
    packSize:num(r.pack_size || r.packsize || r.units_per_pack) || (shop?.category==='Pharmacy'?10:null),
    expiryDate:r.expiry || r.expiry_date || '',
    barcode:r.barcode || r.ean || r.upc || '',
    categoryData:{
      brand:r.brand||'', model:r.model||'', variant:r.variant||'', size:r.size||'', color:r.color||'',
      shade:r.shade||'', shadeCode:r.shade_code||'', mrp:r.mrp||'', warranty:r.warranty||'',
      manufacturer:r.manufacturer||'', batchNo:r.batch_no||r.batch||'', unitsPerPack:r.units_per_pack||r.pack_size||'',
    },
    source:'pc_import'
  })),[rows,shop]);

  const loadFile=e=>{const f=e.target.files?.[0];if(!f)return;setFileName(f.name);const reader=new FileReader();reader.onload=()=>setRows(parseCsv(String(reader.result||'')));reader.readAsText(f);};
  const importNow=async()=>{if(!shop||!mapped.length)return;const bad=mapped.findIndex(r=>!r.name||r.price==null||r.stock==null);if(bad>=0){alert(`Row ${bad+2} me name, price ya stock missing hai.`);return;}setBusy(true);try{await onImportProducts(shop.id,mapped);}finally{setBusy(false);}};

  return <div className="bg-white rounded-2xl p-4 border border-gray-100">
    <div className="flex items-center gap-2"><FileSpreadsheet size={17} className="text-emerald-600"/><div className="font-bold text-sm">PC / Existing Software Import</div></div>
    <div className="text-xs text-gray-500 mt-1">Shop ke PC software se CSV export karke yahan import karein. Imported price ko NearShop ki purani price history nahi maana jayega.</div>
    <select value={shopId} onChange={e=>setShopId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm mt-3">{shops.map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}</select>
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-3 text-[10px] text-emerald-700"><b>CSV columns:</b> name, price, stock, unit, pack_size, expiry, barcode + optional brand/model/size/color/shade/mrp/warranty.</div>
    <label className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm cursor-pointer"><Upload size={15}/> {fileName||'CSV file choose karein'}<input type="file" accept=".csv,text/csv" onChange={loadFile} className="hidden"/></label>
    {mapped.length>0&&<div className="mt-3"><div className="flex justify-between text-xs font-bold mb-2"><span>Preview: {mapped.length} products</span><button onClick={()=>{setRows([]);setFileName('')}} className="text-red-500"><X size={14}/></button></div><div className="max-h-48 overflow-auto space-y-1">{mapped.slice(0,20).map((r,i)=><div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-xs flex justify-between"><span className="truncate pr-2">{r.name}</span><b>₹{r.price} · {r.stock}</b></div>)}</div>{mapped.length>20&&<div className="text-[10px] text-gray-400 mt-1">+ {mapped.length-20} aur rows</div>}<button disabled={busy} onClick={importNow} className="w-full mt-3 bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Check size={15}/>{busy?'Importing…':`Import ${mapped.length} Products`}</button></div>}
    <div className="text-[10px] text-gray-400 mt-3">Tip: Excel me Save As → CSV UTF-8 karke import kar sakte hain.</div>
  </div>;
}
