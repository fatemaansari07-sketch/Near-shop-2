import React from 'react';

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none bg-white';
const select = `${input}`;

export const CATEGORY_META = {
  Pharmacy: {
    label: 'Medical / Pharmacy',
    hint: 'Medicine ka form, pack size aur batch/expiry pehle se capture hoga.',
  },
  Paint: { label: 'Paint / Color', hint: 'Brand, shade aur pack size se product search better hoga.' },
  Clothing: { label: 'Clothing', hint: 'Size, color aur piece type product ko clearly define karte hain.' },
  Footwear: { label: 'Footwear', hint: 'Brand, size, color aur pair type important hain.' },
  Electronics: { label: 'Electronics / Mobile', hint: 'Brand, model, variant aur warranty details save hongi.' },
};

export const emptyCategoryData = (category) => {
  if (category === 'Pharmacy') return { dosageForm: 'Tablet', packType: 'Strip', unitsPerPack: '10', manufacturer: '', batchNo: '', mrp: '' };
  if (category === 'Paint') return { brand: '', shade: '', shadeCode: '', paintType: '', packSizeLabel: '', finish: '' };
  if (category === 'Clothing') return { brand: '', garmentType: '', size: '', color: '', gender: '', pieceType: 'Single Piece' };
  if (category === 'Footwear') return { brand: '', footwearType: '', size: '', color: '', gender: '', pairType: 'Pair' };
  if (category === 'Electronics') return { brand: '', model: '', variant: '', ram: '', storage: '', color: '', warranty: '', serialImei: '' };
  return {};
};

export default function ProductCategoryFields({ category, value = {}, onChange }) {
  const set = (key, val) => onChange({ ...value, [key]: val });
  if (!category) return null;

  if (category === 'Pharmacy') return <div className="space-y-2">
    <div className="text-[11px] font-bold text-emerald-700">💊 {CATEGORY_META.Pharmacy.label}</div>
    <div className="grid grid-cols-2 gap-2">
      <select className={select} value={value.dosageForm || 'Tablet'} onChange={e=>set('dosageForm',e.target.value)}>
        {['Tablet','Capsule','Syrup','Injection','Cream','Ointment','Drops','Powder','Inhaler','Other'].map(x=><option key={x}>{x}</option>)}
      </select>
      <select className={select} value={value.packType || 'Strip'} onChange={e=>set('packType',e.target.value)}>
        {['Strip','Bottle','Box','Tube','Vial','Packet','Other'].map(x=><option key={x}>{x}</option>)}
      </select>
    </div>
    {['Tablet','Capsule'].includes(value.dosageForm || 'Tablet') && <input className={input} value={value.unitsPerPack || ''} onChange={e=>set('unitsPerPack',e.target.value.replace(/\D/g,''))} placeholder="1 strip/pack me kitni goli? e.g. 10" />}
    <div className="grid grid-cols-2 gap-2">
      <input className={input} value={value.manufacturer || ''} onChange={e=>set('manufacturer',e.target.value)} placeholder="Manufacturer" />
      <input className={input} value={value.batchNo || ''} onChange={e=>set('batchNo',e.target.value)} placeholder="Batch No." />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <input className={input} value={value.mrp || ''} onChange={e=>set('mrp',e.target.value.replace(/[^0-9.]/g,''))} placeholder="MRP (optional)" />
      <div className="text-[10px] text-gray-500 bg-gray-50 rounded-lg p-2">Expiry neeche common field me aayegi.</div>
    </div>
  </div>;

  if (category === 'Paint') return <div className="space-y-2">
    <div className="text-[11px] font-bold text-amber-700">🎨 {CATEGORY_META.Paint.label}</div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.brand||''} onChange={e=>set('brand',e.target.value)} placeholder="Brand"/><input className={input} value={value.paintType||''} onChange={e=>set('paintType',e.target.value)} placeholder="Paint type"/></div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.shade||''} onChange={e=>set('shade',e.target.value)} placeholder="Color / Shade"/><input className={input} value={value.shadeCode||''} onChange={e=>set('shadeCode',e.target.value)} placeholder="Shade code"/></div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.packSizeLabel||''} onChange={e=>set('packSizeLabel',e.target.value)} placeholder="Pack size e.g. 1L / 20L"/><input className={input} value={value.finish||''} onChange={e=>set('finish',e.target.value)} placeholder="Finish e.g. Matt"/></div>
  </div>;

  if (category === 'Clothing') return <div className="space-y-2">
    <div className="text-[11px] font-bold text-pink-700">👕 {CATEGORY_META.Clothing.label}</div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.brand||''} onChange={e=>set('brand',e.target.value)} placeholder="Brand"/><input className={input} value={value.garmentType||''} onChange={e=>set('garmentType',e.target.value)} placeholder="Type e.g. Shirt"/></div>
    <div className="grid grid-cols-3 gap-2"><input className={input} value={value.size||''} onChange={e=>set('size',e.target.value)} placeholder="Size"/><input className={input} value={value.color||''} onChange={e=>set('color',e.target.value)} placeholder="Color"/><input className={input} value={value.gender||''} onChange={e=>set('gender',e.target.value)} placeholder="Men/Women/Kids"/></div>
    <select className={select} value={value.pieceType||'Single Piece'} onChange={e=>set('pieceType',e.target.value)}><option>Single Piece</option><option>Pair</option><option>Set</option></select>
  </div>;

  if (category === 'Footwear') return <div className="space-y-2">
    <div className="text-[11px] font-bold text-orange-700">👟 {CATEGORY_META.Footwear.label}</div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.brand||''} onChange={e=>set('brand',e.target.value)} placeholder="Brand"/><input className={input} value={value.footwearType||''} onChange={e=>set('footwearType',e.target.value)} placeholder="Type e.g. Sports"/></div>
    <div className="grid grid-cols-3 gap-2"><input className={input} value={value.size||''} onChange={e=>set('size',e.target.value)} placeholder="Size"/><input className={input} value={value.color||''} onChange={e=>set('color',e.target.value)} placeholder="Color"/><input className={input} value={value.gender||''} onChange={e=>set('gender',e.target.value)} placeholder="Men/Women/Kids"/></div>
    <select className={select} value={value.pairType||'Pair'} onChange={e=>set('pairType',e.target.value)}><option>Pair</option><option>Single</option></select>
  </div>;

  return <div className="space-y-2">
    <div className="text-[11px] font-bold text-blue-700">📱 {CATEGORY_META.Electronics.label}</div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.brand||''} onChange={e=>set('brand',e.target.value)} placeholder="Brand"/><input className={input} value={value.model||''} onChange={e=>set('model',e.target.value)} placeholder="Model"/></div>
    <div className="grid grid-cols-2 gap-2"><input className={input} value={value.variant||''} onChange={e=>set('variant',e.target.value)} placeholder="Variant"/><input className={input} value={value.color||''} onChange={e=>set('color',e.target.value)} placeholder="Color"/></div>
    <div className="grid grid-cols-3 gap-2"><input className={input} value={value.ram||''} onChange={e=>set('ram',e.target.value)} placeholder="RAM"/><input className={input} value={value.storage||''} onChange={e=>set('storage',e.target.value)} placeholder="Storage"/><input className={input} value={value.warranty||''} onChange={e=>set('warranty',e.target.value)} placeholder="Warranty"/></div>
    <input className={input} value={value.serialImei||''} onChange={e=>set('serialImei',e.target.value)} placeholder="Serial / IMEI (optional)" />
  </div>;
}
