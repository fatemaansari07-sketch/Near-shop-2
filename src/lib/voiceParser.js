const nums = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, five: 5, chhe: 6, chhah: 6, six: 6, saat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
};
const norm = s => String(s || '').toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

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

const unitFromText = (s) => {
  const n = norm(s);
  if (/\b(patta|patte|strip|strips)\b/.test(n)) return 'strip';
  if (/\b(goli|goliyan|tablet|tablets|tab)\b/.test(n)) return 'tablet';
  if (/\b(syrup|syrup ki bottle|bottle)\b/.test(n)) return 'piece';
  if (/\b(piece|pieces|pcs|pc)\b/.test(n)) return 'piece';
  return null;
};

// Smart POS voice parser. It deliberately returns multiple matches, including multiple
// quantities of the same product in one sentence, e.g. "1 patta paracetamol aur 5 goli
// bhi" -> strip x1 + tablet x5 for the same product. The billing layer merges those lines.
export function parseSaleVoice(text, products = []) {
  const s = norm(text);
  if (!s || !products.length) return [];

  const numberWords = Object.keys(nums).join('|');
  const unitWords = 'patta|patte|strip|strips|goli|goliyan|tablet|tablets|tab|syrup|bottle|piece|pieces|pcs|pc';
  // Capture phrases such as "1 patta", "5 goli", "ek cough syrup", "2 bottles".
  const phraseRe = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${numberWords})(?:\\s+[a-z0-9-]+){0,2}?\\s+(${unitWords})\\b`, 'gi');
  const phrases = [];
  let m;
  while ((m = phraseRe.exec(s))) {
    const phrase = m[0];
    const sn = spokenNumber(phrase);
    if (!sn) continue;
    phrases.push({ start: m.index, end: m.index + phrase.length, qty: sn.value, subUnit: unitFromText(phrase), text: phrase });
  }

  const productWords = p => norm(p.name).split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
  const findBestProduct = (phrase) => {
    const exactInside = products.find(p => {
      const n = norm(p.name);
      return phrase.text.includes(n) || productWords(p).filter(w => phrase.text.includes(w)).length >= Math.max(1, Math.ceil(productWords(p).length * 0.7));
    });
    if (exactInside) return exactInside;

    const beforeCandidates = [];
    const afterCandidates = [];
    products.forEach(product => {
      const words = productWords(product);
      if (!words.length) return;
      const positions = [];
      words.forEach(word => {
        let from = 0;
        while (from < s.length) {
          const idx = s.indexOf(word, from);
          if (idx < 0) break;
          positions.push(idx);
          from = idx + word.length;
        }
      });
      const before = positions.filter(pos => pos < phrase.start);
      const after = positions.filter(pos => pos >= phrase.end);
      // Natural speech usually says quantity before the product or quantity after a product.
      // Prefer the nearest product that has already been spoken; only use a following product
      // when there is no preceding candidate.
      if (before.length) {
        const pos = Math.max(...before);
        beforeCandidates.push({ product, score: -(phrase.start - pos), pos });
      } else if (after.length) {
        const pos = Math.min(...after);
        afterCandidates.push({ product, score: -(pos - phrase.end), pos });
      }
    });
    const candidates = beforeCandidates.length ? beforeCandidates : afterCandidates;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.product || null;
  };

  const out = [];
  const used = new Set();
  const push = (product, qty, subUnit) => {
    if (!product) return;
    const key = `${product.id}:${qty}:${subUnit || 'default'}`;
    // Same product + same unit + same quantity appearing twice is almost always duplicate
    // speech recognition. Different units (strip + tablet) are intentionally both kept.
    if (used.has(key)) return;
    used.add(key);
    out.push({ product, qty: Number(qty) || 1, subUnit: subUnit || null });
  };

  // First pass: each explicit quantity/unit phrase is attached to the nearest matching product.
  phrases.forEach(phrase => {
    let product = findBestProduct(phrase);
    if (!product) {
      // Exact product-name-in-phrase, e.g. "ek cough syrup".
      product = products.find(p => {
        const n = norm(p.name);
        return phrase.text.includes(n) || n.split(/\s+/).filter(w => w.length > 2).every(w => phrase.text.includes(w));
      });
    }
    push(product, phrase.qty, phrase.subUnit);
  });

  // Second pass: products mentioned without a quantity/unit default to one piece/pack.
  products.forEach(product => {
    const words = productWords(product);
    if (!words.length) return;
    const hits = words.filter(w => s.includes(w)).length;
    if (hits < Math.max(1, Math.ceil(words.length * 0.6))) return;
    if (!out.some(x => x.product.id === product.id)) {
      push(product, 1, null);
    }
  });

  // Last fallback for very short/fuzzy speech: use each sentence/connector segment.
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
