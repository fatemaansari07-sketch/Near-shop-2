const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

const NUMBER_WORDS = {
  ek: 1, one: 1, a: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, six: 6, saat: 7, sat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10, gyarah: 11, barah: 12,
};

export const normalizeVoiceText = (text = "") => text.toLowerCase().replace(/[₹,]/g, " ").replace(/\s+/g, " ").trim();

const numberFrom = (value) => {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (NUMBER_WORDS[raw] != null) return NUMBER_WORDS[raw];
  const m = raw.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const numberPattern = '(?:\\d+(?:\\.\\d+)?|' + Object.keys(NUMBER_WORDS).join('|') + ')';

export function parseExpiry(text) {
  const t = normalizeVoiceText(text);
  let m = t.match(/(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\s+(20\d{2})/i);
  if (m) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()] + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](20\d{2})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function cleanName(raw = "") {
  return raw
    .replace(/^.*?\b(?:product|item|naam)\s*[:=-]?\s*/i, "")
    .replace(/\b(?:price|rate|daam|keemat|stock|quantity|qty|expiry|expiry date|date|hai|h|mein|me|ke|ka|ki|and|aur)\b.*$/i, "")
    .replace(/^\s*(?:ek|one|a)\s+/i, "")
    .trim()
    .replace(/\s{2,}/g, " ");
}

export function splitProductUtterances(text = "") {
  const t = normalizeVoiceText(text);
  if (!t) return [];
  const chunks = t.split(/\s+(?:phir|next product|agla product|agla item)\s+/i).filter(Boolean);
  const out = [];
  chunks.forEach((chunk) => {
    const parts = chunk.split(/\s+aur\s+(?=[a-z][a-z0-9 -]{1,60}\s+(?:price|rate|daam|stock|expiry))/i);
    out.push(...parts.filter(Boolean));
  });
  return out;
}

export function parseProductVoice(text = "") {
  const t = normalizeVoiceText(text);
  if (!t) return null;
  const expiryDate = parseExpiry(t);
  const priceMatch = t.match(new RegExp('(?:price|rate|daam|keemat)\\s*(?:hai|is)?\\s*(?:₹\\s*)?(' + numberPattern + ')', 'i'));
  const stockMatch = t.match(new RegExp('(?:stock|quantity|qty|maal)\\s*(?:me|mein)?\\s*(' + numberPattern + ')\\s*(?:patta|patti|strip|packet|pack|piece|pcs?)?', 'i'))
    || t.match(new RegExp('(' + numberPattern + ')\\s*(?:patta|patti|strip|packet|pack|pieces?|pcs)', 'i'));
  const grams = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilogram|gram|grams|g)\b/i);
  const litres = t.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|litres|liters|l|ml)\b/i);
  const metres = t.match(/(\d+(?:\.\d+)?)\s*(?:metre|meter|m|cm)\b/i);
  const packSizeMatch = t.match(new RegExp('(?:strip|patta|patti|pack|packet)\\s*(?:me|mein|has|contains|containing)?\\s*(' + numberPattern + ')\\s*(?:tablet|tablets|tab|tabs|piece|pieces|pcs)', 'i'))
    || t.match(new RegExp('(' + numberPattern + ')\\s*(?:tablet|tablets|tab|tabs)\\s*(?:ki|ka|ke)?\\s*(?:strip|patta|patti)', 'i'));

  let unit = "piece";
  let stock = numberFrom(stockMatch?.[1]);
  let packSize = numberFrom(packSizeMatch?.[1]);
  if (/\b(strip|patta|patti|packet|pack)\b/i.test(t)) unit = "pack";
  else if (grams) unit = "weight";
  else if (litres) unit = "volume";
  else if (metres) unit = "length";

  if (stock == null) {
    if (unit === "weight") stock = numberFrom(grams?.[1]);
    else if (unit === "volume") stock = numberFrom(litres?.[1]);
    else if (unit === "length") stock = numberFrom(metres?.[1]);
  }

  let nameSource = t;
  if (priceMatch) nameSource = t.slice(0, priceMatch.index);
  else if (stockMatch) nameSource = t.slice(0, stockMatch.index);
  else if (expiryDate) nameSource = t.slice(0, t.search(/\bexpiry\b/i));
  let name = cleanName(nameSource)
    .replace(/\b(?:paracitamole|paracitamol)\b/i, "Paracetamol")
    .replace(/\b(?:650|500|250)\s*mg\b/i, "")
    .trim();
  if (!name || name.length < 2) return null;

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    price: numberFrom(priceMatch?.[1]),
    stock,
    unit,
    packSize: packSize || (unit === "pack" ? 10 : null),
    expiryDate,
    code: "",
    imageUrl: null,
    rawTranscript: text,
  };
}

const QUANTITY_RE = new RegExp('(?:\\b)(' + numberPattern + ')\\s*(tablet|tablets|tab|tabs|goli|goliyan|pcs?|pieces?|strip|strips|patta|patti|packet|pack|kg|gram|g|ml|litre|liter|l|metre|meter|m|cm|bottle|bottles)\\b', 'i');
const ONE_UNIT_RE = /(?:\b)(?:ek|one|a)\s+(strip|patta|packet|pack|tablet|tab|goli|piece|bottle)\b/i;

export function parseSaleVoice(text = "", products = []) {
  const t = normalizeVoiceText(text);
  const typoAliases = { paracitamole: "paracetamol", paracitamol: "paracetamol" };
  const tokens = t.split(/\s+/).map(x => typoAliases[x] || x);
  const normalizedForMatch = tokens.join(" ");
  const matches = [];

  products.forEach((p) => {
    const n = normalizeVoiceText(p.name);
    const aliases = [
      n,
      n.replace(/\s*\([^)]*\)/g, ""),
      n.replace(/\b\d+(?:\.\d+)?\b/g, "").replace(/\s+/g, " ").trim(),
      n.split(/\s+/)[0],
    ].filter((a, i, arr) => a && arr.indexOf(a) === i).sort((a, b) => b.length - a.length);
    const matchedAlias = aliases.find((a) => normalizedForMatch.includes(a));
    if (!matchedAlias) return;

    const idx = normalizedForMatch.indexOf(matchedAlias);
    const otherPositions = aliases.flatMap((a) => { const positions=[]; let from=0; while(true){ const j=normalizedForMatch.indexOf(a, from); if(j<0) break; if(j!==idx) positions.push(j); from=j+a.length; } return positions; });
    const nextProductAt = products.map((other) => normalizeVoiceText(other.name)).flatMap((a) => normalizedForMatch.indexOf(a, idx + matchedAlias.length)).filter((j) => j >= 0).sort((a,b)=>a-b)[0];
    const before = normalizedForMatch.slice(Math.max(0, idx - 35), idx);
    const after = normalizedForMatch.slice(idx, nextProductAt || idx + 140);
    const context = `${before} ${after}`;

    let qty = null;
    let subUnit = null;
    const q1 = context.match(QUANTITY_RE);
    if (q1) { qty = numberFrom(q1[1]); subUnit = q1[2].toLowerCase(); }
    const q2 = context.match(ONE_UNIT_RE);
    if (q2 && qty == null) { qty = 1; subUnit = q2[1].toLowerCase(); }
    if (qty == null) qty = 1;

    matches.push({ product: p, qty, subUnit });
  });
  return matches;
}

export function parseSearchVoice(text = "") {
  const raw = normalizeVoiceText(text);
  if (!raw) return { query: "", compare: false };
  const compare = /\b(compare|comparison|sasta|cheapest|cheap|best price|price check|rate check|kaha sasta|kahaan sasta)\b/i.test(raw);
  const query = raw
    .replace(/\b(mujhe|mujhko|please|plz|find|search|dhundho|dhoondo|dhundhna|chahiye|ka|ki|ke|price|rate|compare|comparison|sasta|cheapest|best price|kaha|kahaan|check|batao|bata|karna|karo|hai)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { query, compare };
}
