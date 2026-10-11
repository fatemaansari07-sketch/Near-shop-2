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
