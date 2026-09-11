const nums = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, paanch: 5, five: 5, chhe: 6, chhah: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10 };
const norm = s => String(s || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();

// First number found in the string (digits, else a spoken Hindi/English number word)
const numberFrom = s => {
  const m = norm(s).match(/\b\d+(?:\.\d+)?\b/);
  if (m) return Number(m[0]);
  for (const [k, v] of Object.entries(nums)) if (new RegExp(`\\b${k}\\b`).test(norm(s))) return v;
  return null;
};

// All digit-numbers found in the string, in order (used to tell "first" apart from "second"
// number, e.g. price vs stock, without reusing the same match twice)
const allNumbers = s => {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  const n = norm(s);
  while ((m = re.exec(n))) out.push(Number(m[0]));
  return out;
};

const fuzzy = (q, name) => {
  q = norm(q); name = norm(name);
  if (!q) return false;
  const words = q.split(' ').filter(x => x.length > 2);
  return words.every(w => name.includes(w)) || name.includes(q) || q.includes(name);
};

// BUG FIX: previously this called numberFrom(text) twice, so "price 66 stock 40" set BOTH
// price and stock to 66 (the first number in the whole sentence). Now: prefer a number that
// sits right after the "price"/"stock" keyword; if the keywords weren't spoken, fall back to
// taking numbers in the order they were said (1st -> price, 2nd -> stock) instead of reusing
// the same one twice.
export function parseProductVoice(text) {
  const s = norm(text);
  const priceMatch = s.match(/(?:price|rupaye|rupees|\brs\b)\D{0,12}(\d+(?:\.\d+)?)/);
  const stockMatch = s.match(/\bstock\D{0,12}(\d+(?:\.\d+)?)/);
  const seq = allNumbers(s);

  const price = priceMatch ? Number(priceMatch[1]) : (seq[0] ?? null);
  let stock;
  if (stockMatch) stock = Number(stockMatch[1]);
  else {
    const priceVal = price;
    stock = seq.find(n => n !== priceVal) ?? (seq.length > 1 ? seq[1] : null);
  }

  const name = s
    .replace(/\b(add|product|price|stock|rupaye|rupees|rs|ka|ki|ke|hai)\b/g, ' ')
    .replace(/\d+(?:\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { name, price, stock };
}

export function splitProductUtterances(text) {
  return norm(text).split(/\s*(?:aur|and|,| phir | then )\s*/i).filter(Boolean);
}

export function parseSearchVoice(text) {
  const q = norm(text).replace(/\b(price|rate|kitne ka|kitne ki|batao|chahiye)\b/g, ' ').trim();
  return { query: q, compare: /price|rate|kitne/.test(norm(text)) };
}

// BUG FIX (two bugs):
// 1) The old code matched every product against the FULL utterance. As soon as two different
//    products were mentioned in one sentence ("2 amul milk aur 3 tata salt"), fuzzy() required
//    ALL words of the whole sentence to appear in a single product's name, which is basically
//    never true for a second item -- it silently returned zero matches.
// 2) Even for a single item, quantity was found by searching for the FULL stored product name
//    (e.g. "Amul Milk 1L") inside the spoken text and taking the number before that exact
//    substring. Real speech almost never includes the exact stored name/size, so indexOf()
//    returned -1, the "before" text became empty, and quantity silently defaulted to 1 no
//    matter what number was actually spoken.
// Fix: split the utterance into per-item segments first (reusing splitProductUtterances, which
// existed but was never wired in), then match + extract quantity independently within each
// segment so numbers and products from different items don't bleed into each other.
export function parseSaleVoice(text, products = []) {
  const wholeSegments = splitProductUtterances(text);
  const segments = wholeSegments.length ? wholeSegments : [norm(text)];
  const out = [];

  const matchInSegment = (seg) => {
    let best = null, bestScore = 0;
    products.forEach((p) => {
      if (!fuzzy(seg, p.name)) return;
      const nameWords = norm(p.name).split(' ').filter((w) => w.length > 2);
      const score = nameWords.filter((w) => seg.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return best;
  };

  segments.forEach((seg) => {
    if (!seg) return;
    const product = matchInSegment(seg);
    if (!product) return;
    const qty = numberFrom(seg) || 1;
    const subUnit = /\b(goli|tablet|tab|tablets)\b/.test(seg) ? 'tablet' : /\b(patta|strip|strips)\b/.test(seg) ? 'strip' : null;
    out.push({ product, qty, subUnit });
  });

  if (!out.length) {
    const s = norm(text);
    for (const p of products) {
      const nameWords = norm(p.name).split(' ').filter((w) => w.length > 3);
      if (nameWords.some((w) => s.includes(w))) {
        out.push({ product: p, qty: numberFrom(s) || 1, subUnit: /goli|tablet|tab/.test(s) ? 'tablet' : null });
      }
    }
  }

  return out;
}
