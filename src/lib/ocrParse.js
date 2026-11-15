// Pure text parser for medicine/product pack photos. Best-effort only: every value is a SUGGESTION the user confirms.
// Written to survive typical OCR damage: "8.No" for "B.No", "path" for "Date", "27-50" for "27.50", "062025" for "06/2025".
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(y, m, 0).getDate();

// "03/2027", "3-27", "Mar 2027", "MAR.27", "032027" -> "2027-03-<last day>" (expiry) or "-01" (mfg)
export function parseMonthYear(raw, end = true) {
  if (!raw) return "";
  const s = String(raw).trim().replace(/[Oo]/g, "0");
  let m, y, r;
  if ((r = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/))) { m = +r[1]; y = +r[2]; }
  else if ((r = s.match(/^(\d{2})\s?(\d{4})$/))) { m = +r[1]; y = +r[2]; }
  else {
    const t = String(raw).trim();
    if ((r = t.match(/^([A-Za-z]{3,9})\.?\s*[\/\-.,]?\s*(\d{2,4})$/))) { m = MONTHS[r[1].slice(0, 3).toLowerCase()]; y = +String(r[2]).replace(/[Oo]/g, "0"); }
    else return "";
  }
  if (!m || m < 1 || m > 12) return "";
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return "";
  return `${y}-${pad(m)}-${pad(end ? lastDay(y, m) : 1)}`;
}

const DATE = String.raw`(\d{1,2}\s*[\/\-.]\s*\d{2,4}|\d{2}\s?\d{4}|[A-Za-z]{3,9}\.?\s*[\/\-.,]?\s*\d{2,4})`;
const FORMS = /\b(tablets?|capsules?|syrup|suspension|cream|gel|drops|injection|ointment|powder|lotion|spray|sachet)\b/i;
const NOISE = /(mrp|m\.r\.p|batch|b\.?\s?no|mfg|mfd|exp|rs\.?|₹|inclusive|manufactured|marketed|regd|schedule|composition|each|contains|www|@|lic\.?|price|per strip|store|keep|protect|warning|use only|dosage|net|qty|\bpack\b|made in|taxes)/i;

export function parsePackText(text) {
  const raw = String(text || "");
  const t = raw.replace(/[|]/g, "I").replace(/\r/g, "");
  const out = {};

  // MRP: keyword then number; tolerate "27-50", "145. 50", "Rs, 189.00"
  const mrp = t.match(/(?:M\.?\s?R\.?\s?P\.?|Rs|₹|INR)[\s.,:\-]*(?:Rs[\s.,:\-]*)?(\d{1,5})(?:\s?[.,\-]\s?(\d{2}))?(?!\d)/i);
  if (mrp) {
    const v = Number(mrp[1] + (mrp[2] ? "." + mrp[2] : ""));
    if (v > 0 && v < 100000) out.mrp = String(v);
  }

  // Batch: "B.No", "8.No" (OCR), "Batch No/Number/#". A real batch code has at least one digit.
  const bre = /(?:[B8]\.?\s?No\.?|Batch\s*(?:No\.?|Number|#)?)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,14})/gi;
  let bm;
  while ((bm = bre.exec(t))) { if (/\d/.test(bm[1]) && !/^(mfg|mfd|exp|date)/i.test(bm[1])) { out.batchNo = bm[1].toUpperCase(); break; } }

  // Expiry / Mfg: the word "Date" is often garbled ("path", "Da"), so allow one junk word between keyword and value.
  const exp = t.match(new RegExp(String.raw`(?:E[xk]p\w*\.?|Use\s*before)\s*(?:[A-Za-z]{2,6}\.?\s*)?[:.\-]?\s*` + DATE, "i"));
  if (exp) { const d = parseMonthYear(exp[1], true); if (d && Number(d.slice(0, 4)) >= new Date().getFullYear() - 1) out.expiryDate = d; }
  const mfg = t.match(new RegExp(String.raw`(?:Mf[gd]\w*\.?)\s*(?:[A-Za-z]{2,6}\.?\s*)?[:.\-]?\s*` + DATE, "i"));
  if (mfg) { const d = parseMonthYear(mfg[1], false); if (d) out.mfgDate = d; }

  const by = t.match(/(?:Mfd\.?|Manufactured|Marketed)\s*by\s*[:\-]?\s*([^\n]{3,50})/i);
  if (by) out.manufacturer = by[1].replace(/[^\w &.\-]/g, "").trim();

  const strength = t.match(/\b(\d{1,4}(?:\.\d+)?)\s?(mg|mcg|gm|g|ml|iu)\b/i);

  // Name: first clean alphabetic line from the top, preferring one that mentions a dosage form.
  const lines = raw.split("\n").map((l) => l.replace(/[^A-Za-z0-9 .\-+&()]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const ok = lines.slice(0, 12).filter((l) => {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    return letters >= 4 && letters / l.length > 0.6 && !NOISE.test(l);
  });
  const longest = (l) => Math.max(0, ...(l.match(/[A-Za-z][A-Za-z\-]+/g) || []).map((w) => w.length));
  const best = [...ok].sort((a, b) => longest(b) - longest(a) || ok.indexOf(a) - ok.indexOf(b))[0];
  if (best && longest(best) < 5) { /* nothing that looks like a name */ } else
  if (best) {
    // keep the leading run of real words (>=3 letters); stop at OCR junk like ". ets .P. 3"
    const stripped = best.replace(FORMS, " ").replace(/\b(I\.?P\.?|B\.?P\.?|U\.?S\.?P\.?)\b/gi, " ").replace(/\s+/g, " ").trim();
    const words = [];
    for (const w of stripped.split(" ")) {
      if (/^[A-Za-z][A-Za-z\-]{2,}$/.test(w)) words.push(w); else if (words.length) break;
    }
    let name = words.slice(0, 3).join(" ");
    const form = (best.match(FORMS) || [])[1];
    if (name.length >= 3) out.name = name;   // strength is returned separately (out.strength); callers decide whether to append it
    if (form) out.form = form;
  }
  if (strength) out.strength = `${strength[1]} ${strength[2].toLowerCase()}`;
  return out;
}

const FIELDS = ["name", "mrp", "batchNo", "expiryDate", "mfgDate", "manufacturer", "form", "strength"];
const cap = (v) => v.charAt(0).toUpperCase() + v.slice(1);
// Combine several OCR passes: per field, the value seen in the most passes wins; ties go to the pass that found more fields.
// A truncated batch ("ET2415") supports its longer version ("ET2415A"); on MRP ties the larger number wins (truncation shrinks numbers).
export function mergeParsed(list) {
  const score = list.map((p) => ["name", "mrp", "batchNo", "expiryDate"].filter((k) => p[k]).length);
  const out = {};
  for (const k of FIELDS) {
    const ci = k === "name" || k === "manufacturer" || k === "form";
    const tally = new Map();
    list.forEach((p, i) => {
      if (!p[k]) return;
      const key = ci ? String(p[k]).toLowerCase() : p[k];
      const e = tally.get(key) || { v: p[k], votes: 0, best: 0 };
      e.votes += 1; e.best = Math.max(e.best, score[i]);
      if (ci && /^[A-Z]/.test(p[k]) && !/^[A-Z]/.test(e.v)) e.v = p[k];
      tally.set(key, e);
    });
    const arr = [...tally.values()];
    if (k === "batchNo") arr.forEach((a) => arr.forEach((b) => { if (a !== b && b.v.startsWith(a.v)) b.votes += a.votes; }));
    arr.sort((a, b) => b.votes - a.votes || b.best - a.best || (k === "mrp" ? Number(b.v) - Number(a.v) : 0));
    if (arr[0]) out[k] = ci ? cap(arr[0].v) : arr[0].v;
  }
  return out;
}
