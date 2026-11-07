const nums = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, chhah: 6, chha: 6, chah: 6, six: 6, saat: 7, sat: 7, seven: 7,
  aath: 8, ath: 8, aat: 8, eight: 8, nau: 9, nav: 9, nine: 9, das: 10, dus: 10, ten: 10,
  aadha: 0.5, adha: 0.5, half: 0.5, dedh: 1.5, dhai: 2.5,
};

// Android Chrome returns Hindi speech in Devanagari (hi-IN). Convert it to simple Latin so the
// same parser handles "एक पत्ता डालो" and "ek patta dolo".
const DEV_VOW = { 'अ':'a','आ':'a','इ':'i','ई':'i','उ':'u','ऊ':'u','ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऑ':'o','ऋ':'ri' };
const DEV_MAT = { 'ा':'a','ि':'i','ी':'i','ु':'u','ू':'u','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ृ':'ri','ॅ':'e' };
const DEV_CON = {
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'n','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'n',
  'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
  'प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
};
const DEV_DIGIT = '०१२३४५६७८९';
const isDev = ch => ch !== undefined && ch >= '\u0900' && ch <= '\u097F';

export function translitDevanagari(str) {
  str = String(str || '');
  if (!/[\u0900-\u097F]/.test(str)) return str;
  const c = [...str];
  let out = '';
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (DEV_CON[ch] !== undefined) {
      out += DEV_CON[ch];
      let j = i + 1;
      if (c[j] === '़') j++; // nukta
      const nx = c[j];
      if (nx === '्') { i = j; continue; }            // virama: no vowel
      if (DEV_MAT[nx] !== undefined) { out += DEV_MAT[nx]; i = j; continue; }
      i = j - 1;
      if (isDev(nx) && nx !== '।') out += 'a';          // inherent "a" (dropped at word end)
    } else if (DEV_VOW[ch] !== undefined) out += DEV_VOW[ch];
    else if (ch === 'ं' || ch === 'ँ') out += 'n';
    else if (ch === 'ः') out += 'h';
    else if (ch === '़' || ch === '्') continue;
    else if (ch === '।') out += ' ';
    else if (DEV_DIGIT.includes(ch)) out += String(DEV_DIGIT.indexOf(ch));
    else out += ch;
  }
  return out;
}

const norm = s => translitDevanagari(String(s || '')).toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

const numberFrom = s => {
  const m = norm(s).match(/\b\d+(?:\.\d+)?\b/);
  if (m) return Number(m[0]);
  for (const [k, v] of Object.entries(nums)) if (new RegExp(`\\b${k}\\b`).test(norm(s))) return v;
  return null;
};

const allNumbers = s => {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  const n = norm(s);
  while ((m = re.exec(n))) out.push(Number(m[0]));
  return out;
};

const spokenNumber = (s) => {
  const n = norm(s);
  const digit = n.match(/\b\d+(?:\.\d+)?\b/);
  if (digit) return { value: Number(digit[0]), index: digit.index, length: digit[0].length };
  for (const [word, value] of Object.entries(nums)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    const m = re.exec(n);
    if (m) return { value, index: m.index, length: m[0].length };
  }
  return null;
};

const fuzzy = (q, name) => {
  q = norm(q); name = norm(name);
  if (!q) return false;
  const words = q.split(' ').filter(x => x.length > 2);
  return words.every(w => name.includes(w)) || name.includes(q) || q.includes(name);
};

export function parseProductVoice(text) {
  const s = norm(text);
  const priceMatch = s.match(/(?:price|rupaye|rupees|\brs\b)\D{0,12}(\d+(?:\.\d+)?)/);
  const stockMatch = s.match(/\bstock\D{0,12}(\d+(?:\.\d+)?)/);
  const seq = allNumbers(s);
  const price = priceMatch ? Number(priceMatch[1]) : (seq[0] ?? null);
  let stock;
  if (stockMatch) stock = Number(stockMatch[1]);
  else stock = seq.find(n => n !== price) ?? (seq.length > 1 ? seq[1] : null);
  const name = s
    .replace(/\b(add|product|price|stock|rupaye|rupees|rs|ka|ki|ke|hai)\b/g, ' ')
    .replace(/\d+(?:\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, price, stock };
}

export function splitProductUtterances(text) {
  return norm(text).split(/\s*(?:aur|and|,| phir | then | saath me | sath me )\s*/i).filter(Boolean);
}

export function parseSearchVoice(text) {
  const q = norm(text).replace(/\b(price|rate|kitne ka|kitne ki|batao|chahiye)\b/g, ' ').trim();
  return { query: q, compare: /price|rate|kitne/.test(norm(text)) };
}

const UNIT_PATTERNS = [
  ['strip', 'patta|patte|pattey|strip|strips'],
  ['tablet', 'goli|goliyan|goliya|tablet|tablets|tab|taibalet|taiblet|capsule|capsules'],
  ['kg', 'kg|kgs|kilo|kilos|kilogram|kilograms'],
  ['g', 'gram|grams|gm|gms|graam'],
  ['ml', 'ml|millilitre|milliliter|mililitar'],
  ['l', 'litre|litres|liter|liters|ltr|litar'],
  ['cm', 'cm|centimeter|centimetre|santimitar'],
  ['m', 'meter|metre|meters|metres|mitar'],
  ['piece', 'piece|pieces|pcs|pc|bottle|bottles|botal|syrup|sirap|packet|packets|paket'],
];
const UNIT_WORDS = UNIT_PATTERNS.map(x => x[1]).join('|');
const unitFromText = (s) => {
  const n = norm(s);
  for (const [unit, words] of UNIT_PATTERNS) if (new RegExp(`\\b(${words})\\b`).test(n)) return unit;
  return null;
};

// Phonetic skeleton so a Hindi-heard word ("perasitamol", "dalo") can match a product name
// ("paracetamol", "dolo"): drop vowels, unify c/k/s, ph/f, w/v and double letters.
const phon = (w) => String(w || '').toLowerCase().replace(/[^a-z]/g, '')
  .replace(/chh|ch/g, 'C').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
  .replace(/q/g, 'k').replace(/w/g, 'v').replace(/z/g, 'j').replace(/x/g, 'ks')
  .replace(/sh/g, 's').replace(/[kgtdbj]h/g, m => m[0]).replace(/h/g, '')
  .replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1');
const editDistance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[a.length][b.length];
};
const soundsLike = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1);
};

const CONNECTORS = 'aur|and|ya|or|plus|phir|then';
const KNOWN_WORDS = new Set([
  ...Object.keys(nums), ...UNIT_WORDS.split('|'), ...CONNECTORS.split('|'),
  'bhi', 'chahiye', 'dena', 'de', 'dijiye', 'diye', 'ka', 'ki', 'ke', 'hai', 'mujhe', 'mera', 'bill', 'total', 'add', 'karo', 'kar',
]);

// Smart POS voice parser. Works with Hinglish (Latin) and Hindi (Devanagari) speech and returns
// one match per "quantity + unit" phrase, e.g. "5 goli paracetamol aur ek patta dolo" ->
// [paracetamol 5 tablet, dolo 1 strip]. Quantity can come before or after the product name.
export function parseSaleVoice(text, products = []) {
  const raw = norm(text);
  if (!raw || !products.length) return [];

  const productWords = p => norm(p.name).split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
  const pw = products.map(p => ({ p, words: productWords(p) })).filter(x => x.words.length);

  // Replace words that merely *sound like* a product word with the real product word.
  const productVocab = [...new Set(pw.flatMap(x => x.words))].map(w => ({ w, ph: phon(w) }));
  const s = raw.split(' ').map(tok => {
    if (!tok || /\d/.test(tok) || KNOWN_WORDS.has(tok) || productVocab.some(v => v.w === tok)) return tok;
    const tp = phon(tok);
    const hit = productVocab.find(v => soundsLike(tp, v.ph) || (tp.length === 2 && tp === v.ph && tok.length >= 4));
    return hit ? hit.w : tok;
  }).join(' ');

  const numberWords = Object.keys(nums).join('|');
  const phraseRe = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${numberWords})(?:\\s+[a-z0-9-]+){0,2}?\\s+(${UNIT_WORDS})\\b`, 'gi');
  const phrases = [];
  let m;
  while ((m = phraseRe.exec(s))) {
    const phrase = m[0];
    const sn = spokenNumber(phrase);
    if (!sn) continue;
    phrases.push({ start: m.index, end: m.index + phrase.length, qty: sn.value, subUnit: unitFromText(phrase), text: phrase });
  }

  // First / last product mentioned inside s[from, to).
  const productIn = (from, to, which) => {
    if (to <= from) return null;
    const seg = s.slice(from, to);
    let best = null;
    for (const { p, words } of pw) {
      const hits = words.map(w => seg.indexOf(w)).filter(i => i >= 0);
      if (hits.length < Math.max(1, Math.ceil(words.length * 0.6))) continue;
      const pos = which === 'first' ? Math.min(...hits) : Math.max(...hits);
      if (!best || (which === 'first' ? pos < best.pos : pos > best.pos)) best = { p, pos };
    }
    return best ? best.p : null;
  };
  const connRe = () => new RegExp(`\\b(${CONNECTORS})\\b`, 'g');
  const afterLastConnector = (a, b) => { let end = a, x; const re = connRe(); const seg = s.slice(a, b); while ((x = re.exec(seg))) end = a + x.index + x[0].length; return end; };
  const beforeFirstConnector = (a, b) => { const x = connRe().exec(s.slice(a, b)); return x ? a + x.index : b; };

  const out = [];
  const used = new Set();
  const push = (product, qty, subUnit) => {
    if (!product) return;
    const key = `${product.id}:${qty}:${subUnit || 'default'}`;
    if (used.has(key)) return;
    used.add(key);
    out.push({ product, qty: Number(qty) || 1, subUnit: subUnit || null });
  };

  // Quantity-first ("5 goli paracetamol") unless a product is spoken before the first quantity.
  const qtyFirst = phrases.length ? !productIn(0, phrases[0].start, 'last') : true;
  let last = null;
  phrases.forEach((ph, i) => {
    const prevEnd = i ? phrases[i - 1].end : 0;
    const nextStart = i < phrases.length - 1 ? phrases[i + 1].start : s.length;
    const inside = productIn(ph.start, ph.end, 'first');
    const before = productIn(afterLastConnector(prevEnd, ph.start), ph.start, 'last');
    const after = productIn(ph.end, beforeFirstConnector(ph.end, nextStart), 'first');
    const product = inside || (qtyFirst ? (after || before) : (before || after)) || last;
    if (product) last = product;
    push(product, ph.qty, ph.subUnit);
  });

  // Quantity without an explicit unit: "do dolo", "2 paracetamol".
  // Match only against known product names so numbers in unrelated speech are ignored.
  pw.forEach(({ p, words }) => {
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const productPattern = escaped.join("\\s+");
    const qtyPattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${numberWords})\\s+${productPattern}\\b`, "i");
    const match = qtyPattern.exec(s);
    if (match) { const qty = spokenNumber(match[1])?.value; if (qty != null) push(p, qty, null); }
  });

  // Products named without any quantity default to one.
  pw.forEach(({ p, words }) => {
    const hits = words.filter(w => s.includes(w)).length;
    if (hits < Math.max(1, Math.ceil(words.length * 0.6))) return;
    if (!out.some(x => x.product.id === p.id)) push(p, 1, null);
  });

  if (!out.length) {
    splitProductUtterances(s).forEach(seg => {
      const product = products.find(p => fuzzy(seg, p.name));
      if (product) push(product, numberFrom(seg) || 1, unitFromText(seg));
    });
  }
  return out;
}

export function parseExpiry(text) {
  const s = norm(text);
  const iso = s.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
  const dmy = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
  return null;
}

/* ======================================================================
   Poora product ek hi baar bolkar: parseProductForm(text, category)
   "Dolo 650 tablet strength 650 mg 15 goli ka patta price 30 mrp 33 stock 100 patta
    expiry december 2027 company micro labs" -> naam, price, stock, unit, expiry, strength...
   Hindi (Devanagari), Hinglish aur English teeno chalte hain.
   ====================================================================== */
const MONTHS = { jan: 1, january: 1, janvari: 1, feb: 2, february: 2, farvari: 2, mar: 3, march: 3, maarch: 3, apr: 4, april: 4, aprail: 4, may: 5, mai: 5, jun: 6, june: 6, joon: 6, jul: 7, july: 7, julai: 7, aug: 8, august: 8, agast: 8, sep: 9, sept: 9, september: 9, sitambar: 9, oct: 10, october: 10, aktubar: 10, nov: 11, november: 11, navambar: 11, dec: 12, december: 12, disambar: 12, disanbar: 12, navanbar: 11, sitanbar: 9 };
const lastDayISO = (y, m) => `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
function looseExpiry(s) {
  const full = parseExpiry(s);
  if (full) return full;
  const mon = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  let m = s.match(new RegExp(`\\b(${mon})\\b\\W{0,3}(20\\d{2}|\\d{2})\\b`));
  if (m) return lastDayISO(m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), MONTHS[m[1]]);
  m = s.match(/\b(\d{1,2})\s*[\/\-]\s*(20\d{2}|\d{2})\b/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return lastDayISO(m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), Number(m[1]));
  return null;
}

const COMMON_KEYS = [
  ['name', 'naam|name|product|prodakt'],
  ['mrp', 'mrp|emarpi|emaarapi|maximum retail price'],
  ['price', 'selling price|price|prais|rate|kimat|keemat|daam|dam'],
  ['stock', 'stock|stok|quantity|qty|maal|mal'],
  ['expiry', 'expiry date|expiry|expire|eksapayri|eksapayari|exp'],
  ['barcode', 'barcode|bar code|barkod'],
];
const CAT_KEYS = {
  Pharmacy: [['strength', 'strength|strenth|power|taakat'], ['composition', 'composition|salt|content'], ['manufacturer', 'manufacturer|company|kampani|kanpani|made by'], ['batchNo', 'batch number|batch no|batch|baich|bech']],
  Electronics: [['brand', 'brand|company|kampani|kanpani'], ['model', 'model'], ['variant', 'variant'], ['ram', 'ram'], ['storage', 'storage|rom'], ['color', 'colour|color|kalar|rang'], ['warranty', 'warranty|guarantee|warenti|varanti']],
  Clothing: [['brand', 'brand|company|kampani|kanpani'], ['size', 'size|saij|saiz'], ['color', 'colour|color|kalar|rang'], ['gender', 'gender|jenta'], ['garmentType', 'garment type|type']],
  Footwear: [['brand', 'brand|company|kampani|kanpani'], ['size', 'size|saij|saiz'], ['color', 'colour|color|kalar|rang'], ['gender', 'gender'], ['footwearType', 'footwear type|type']],
  Paint: [['brand', 'brand|company|kampani|kanpani'], ['shade', 'shade|colour|color|kalar|rang'], ['shadeCode', 'shade code'], ['finish', 'finish'], ['paintType', 'paint type|type'], ['packSizeLabel', 'pack size|pack']],
};
const COLOR_WORDS = { red: 'Red', laal: 'Red', lal: 'Red', blue: 'Blue', neela: 'Blue', nila: 'Blue', black: 'Black', kala: 'Black', white: 'White', safed: 'White', green: 'Green', hara: 'Green', yellow: 'Yellow', peela: 'Yellow', pila: 'Yellow', pink: 'Pink', gulabi: 'Pink', grey: 'Grey', gray: 'Grey', orange: 'Orange', purple: 'Purple', brown: 'Brown', golden: 'Golden', silver: 'Silver', maroon: 'Maroon' };
const FILLER = new Set(['add', 'new', 'naya', 'nayi', 'product', 'item', 'ka', 'ki', 'ke', 'hai', 'aur', 'and', 'mera', 'ek', 'wala', 'wali']);
const tc = (t) => String(t || '').trim().replace(/\b([a-z])/g, (c) => c.toUpperCase());
const stripTail = (t) => String(t || '').replace(/\b(aur|and|hai|ka|ki|ke|bhi|dena)\b\s*$/g, '').trim();

export function parseProductForm(text, category = 'Pharmacy') {
  const s = norm(text);
  const out = { name: '', price: null, stock: null, unit: null, expiryDate: null, barcode: '', cat: {}, filled: [] };
  if (!s) return out;
  const mask = new Array(s.length).fill(false);
  const mark = (a, b) => { for (let i = a; i < b && i < mask.length; i++) mask[i] = true; };
  const setCat = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') out.cat[k] = String(v).trim(); };

  // ---- 1) number-with-unit patterns (before keyword split) ----
  if (category === 'Pharmacy') {
    let m = s.match(/(\d+)\s*(?:goli|goliyan|tablet|taibalet|tablets|capsule|capsules)\s*(?:ka|ki|ke)?\s*(?:patta|strip|pack)\b/) || s.match(/\b(?:patta|strip|pack)\s*(?:of|me|mein)\s*(\d+)/);
    if (m) { setCat('unitsPerPack', m[1]); mark(m.index, m.index + m[0].length); }
    const df = s.match(/\b(tablet|tablets|taibalet|taiblet|goli|goliyan|capsule|capsules|syrup|sirap|injection|cream|ointment|drops|powder|inhaler)\b/);
    if (df) {
      const w = df[1];
      setCat('dosageForm', /^(tablet|tablets|taibalet|taiblet|goli|goliyan)$/.test(w) ? 'Tablet' : /^capsule/.test(w) ? 'Capsule' : /^(syrup|sirap)$/.test(w) ? 'Syrup' : tc(w));
      if (/^(tablet|tablets|taibalet|taiblet|goli|goliyan|capsule|capsules)$/.test(w)) mark(df.index, df.index + w.length);
    }
    const sm = s.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|ml|gm|g|iu)\b/);
    if (sm && !/(strength|power)/.test(s)) { setCat('strength', `${sm[1]} ${sm[2]}`); mark(sm.index, sm.index + sm[0].length); }
  }
  if (category === 'Electronics') {
    let m = s.match(/(\d+)\s*gb\s*ram\b/) || s.match(/\bram\s*(\d+)\s*(?:gb)?/);
    if (m) { setCat('ram', `${m[1]} GB`); mark(m.index, m.index + m[0].length); }
    m = s.match(/(\d+)\s*(gb|tb)\s*(?:storage|rom)\b/) || s.match(/\b(?:storage|rom)\s*(\d+)\s*(gb|tb)?/);
    if (m) { setCat('storage', `${m[1]} ${(m[2] || 'gb').toUpperCase()}`); mark(m.index, m.index + m[0].length); }
    m = s.match(/(\d+|ek|do|teen)\s*(?:saal|sal|year|years)\s*(?:ki|ka)?\s*(?:warranty|guarantee|warenti)?/);
    if (m) { const n = /^\d+$/.test(m[1]) ? m[1] : nums[m[1]]; setCat('warranty', `${n} Year`); mark(m.index, m.index + m[0].length); }
  }

  // ---- 2) keyword segments ----
  const s2 = s.split('').map((ch, i) => (mask[i] ? ' ' : ch)).join(''); // pattern se pehle hi mil chuke hisse hata do
  const keys = [...COMMON_KEYS, ...(CAT_KEYS[category] || [])];
  const alias = [];
  keys.forEach(([field, src]) => src.split('|').forEach((a) => alias.push([a, field])));
  alias.sort((a, b) => b[0].length - a[0].length);
  const re = new RegExp(`\\b(${alias.map((a) => a[0].replace(/ /g, '\\s+')).join('|')})\\b`, 'g');
  const hits = [];
  let m;
  while ((m = re.exec(s2))) {
    const field = (alias.find((a) => new RegExp(`^${a[0].replace(/ /g, '\\s+')}$`).test(m[1])) || [])[1];
    if (field && !mask[m.index]) hits.push({ field, start: m.index, kwEnd: m.index + m[0].length });
  }
  const seg = {};
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : s.length;
    const raw = s2.slice(h.kwEnd, end).replace(/\s+/g, ' ').trim();
    if (!(h.field in seg)) seg[h.field] = raw;
    mark(h.start, end);
  });

  const num = (v) => { const n = numberFrom(v || ''); return n === null || n === undefined || Number.isNaN(n) ? null : n; };
  if ('price' in seg) out.price = num(seg.price);
  if ('mrp' in seg) setCat('mrp', num(seg.mrp));
  if ('stock' in seg) {
    out.stock = num(seg.stock);
    const u = (seg.stock.match(/\b(patta|patte|strip|strips|piece|pieces|pcs|nag|kg|kilo|litre|liter|meter|metre|dabba|box|bottle|botal|pair)\b/) || [])[1];
    if (u) out.unit = /^(patta|patte|strip|strips)$/.test(u) ? 'pack' : /^(kg|kilo)$/.test(u) ? 'weight' : /^(litre|liter)$/.test(u) ? 'volume' : /^(meter|metre)$/.test(u) ? 'length' : 'piece';
  }
  if ('expiry' in seg) out.expiryDate = looseExpiry(seg.expiry);
  if ('barcode' in seg) out.barcode = (seg.barcode.match(/[\d\s]+/) || [''])[0].replace(/\s+/g, '');
  Object.keys(seg).forEach((k) => {
    if (['name', 'price', 'mrp', 'stock', 'expiry', 'barcode'].includes(k)) return;
    let v = stripTail(seg[k]);
    if (!v) return;
    if (k === 'size') v = v.split(/\s+/).filter((t) => /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d+(?:\.\d+)?)$/.test(t)).map((t) => t.toUpperCase()).join(', ');
    else if (k === 'color' || k === 'shade') v = v.split(/\s+/).map((t) => COLOR_WORDS[t] || tc(t)).filter((t, i, a) => a.indexOf(t) === i).join(', ');
    else if (k === 'gender') v = /women|ladies|female|mahila|ladki/.test(v) ? 'Women' : /kid|bachch|boy|girl/.test(v) ? 'Kids' : /men|male|gents|mard/.test(v) ? 'Men' : tc(v);
    else if (!['strength', 'ram', 'storage', 'warranty', 'batchNo', 'shadeCode'].includes(k)) v = tc(v);
    else v = v.toUpperCase().replace(/\bMG\b/, 'mg').replace(/\bML\b/, 'ml');
    setCat(k, v);
  });

  // ---- 3) loose fallbacks (bina keyword ke) ----
  if (out.price === null) {
    const p = s.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees|rupiya|rs)\b/) || s.match(/(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)/);
    if (p) { out.price = Number(p[1]); mark(p.index, p.index + p[0].length); }
  }
  if (out.stock === null) {
    const st = s.match(/(\d+(?:\.\d+)?)\s*(patta|patte|strip|strips|piece|pieces|pcs|nag|kg|kilo|litre|liter|meter|metre|dabba|box|bottle|botal|pair)\b/);
    if (st && !mask[st.index]) {
      out.stock = Number(st[1]);
      const u = st[2];
      out.unit = /^(patta|patte|strip|strips)$/.test(u) ? 'pack' : /^(kg|kilo)$/.test(u) ? 'weight' : /^(litre|liter)$/.test(u) ? 'volume' : /^(meter|metre)$/.test(u) ? 'length' : 'piece';
      mark(st.index, st.index + st[0].length);
    }
  }
  if (!out.expiryDate && /expiry|expire|exp\b|eksapayri/.test(s)) out.expiryDate = looseExpiry(s);
  if (['Clothing', 'Footwear', 'Electronics', 'Paint'].includes(category)) {
    const field = category === 'Paint' ? 'shade' : 'color';
    if (!out.cat[field]) {
      const found = s.split(/\s+/).map((t) => COLOR_WORDS[t]).filter((t, i, a) => t && a.indexOf(t) === i);
      if (found.length) out.cat[field] = found.join(', ');
    }
  }
  if (['Clothing', 'Footwear'].includes(category) && !out.cat.gender) {
    const g = s.match(/\b(women|ladies|female|men|mens|male|gents|kids|boys|girls)\b/);
    if (g) out.cat.gender = /women|ladies|female/.test(g[1]) ? 'Women' : /kids|boys|girls/.test(g[1]) ? 'Kids' : 'Men';
  }
  if (category === 'Pharmacy' && !out.unit && /\b(patta|strip)\b/.test(s)) out.unit = 'pack';
  if (category === 'Pharmacy' && !out.cat.packType) { const pt = s.match(/\b(patta|strip|bottle|botal|box|dabba|tube|vial|packet)\b/); if (pt) out.cat.packType = /^(patta|strip)$/.test(pt[1]) ? 'Strip' : /^(bottle|botal)$/.test(pt[1]) ? 'Bottle' : /^(box|dabba)$/.test(pt[1]) ? 'Box' : tc(pt[1]); }

  // ---- 4) naam: bacha hua text (ya "naam ___") ----
  if (seg.name) out.name = tc(stripTail(seg.name));
  else {
    let rest = '';
    for (let i = 0; i < s.length; i++) rest += mask[i] ? ' ' : s[i];
    out.name = tc(rest.split(/\s+/).filter((t) => t && !FILLER.has(t) && !/^(rupaye|rupees|rs)$/.test(t)).join(' '));
  }

  const L = { name: 'Naam', price: 'Price', stock: 'Stock', expiryDate: 'Expiry', barcode: 'Barcode' };
  out.filled = [out.name && L.name, out.price != null && L.price, out.stock != null && L.stock, out.expiryDate && L.expiryDate, out.barcode && L.barcode, ...Object.keys(out.cat)].filter(Boolean);
  return out;
}
