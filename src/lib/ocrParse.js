// Pure text parser for medicine/product pack photos. Best-effort only: every value is a SUGGESTION the user confirms.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(y, m, 0).getDate();

// "03/2027", "3-27", "Mar 2027", "MAR.27" -> "2027-03-<last day>" (expiry) or "-01" (mfg)
export function parseMonthYear(raw, end = true) {
  if (!raw) return "";
  const s = String(raw).trim();
  let m, y;
  let r = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/);
  if (r) { m = +r[1]; y = +r[2]; }
  else if ((r = s.match(/^([A-Za-z]{3,9})\.?\s*[\/\-.,]?\s*(\d{2,4})$/))) { m = MONTHS[r[1].slice(0, 3).toLowerCase()]; y = +r[2]; }
  else return "";
  if (!m || m < 1 || m > 12) return "";
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return "";
  return `${y}-${pad(m)}-${pad(end ? lastDay(y, m) : 1)}`;
}

const DATE = String.raw`(\d{1,2}\s*[\/\-.]\s*\d{2,4}|[A-Za-z]{3,9}\.?\s*[\/\-.,]?\s*\d{2,4})`;
const FORMS = /\b(tablets?|capsules?|syrup|suspension|cream|gel|drops|injection|ointment|powder|lotion|spray|sachet)\b/i;
const NOISE = /(mrp|m\.r\.p|batch|b\.?\s?no|mfg|mfd|exp|rs\.?|₹|inclusive|manufactured|marketed|regd|schedule|composition|each|contains|www|@|lic\.?|price|per strip|store|keep|protect|warning|use only|dosage|net|qty|\bpack\b|made in|taxes)/i;

export function parsePackText(text) {
  const raw = String(text || "");
  const t = raw.replace(/[|]/g, "I").replace(/\r/g, "");
  const out = {};

  const mrp = t.match(/(?:M\.?\s?R\.?\s?P\.?|Rs\.?|₹|INR)\s*[:.\-]?\s*(?:Rs\.?\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/i);
  if (mrp) {
    const v = Number(mrp[1].replace(",", "."));
    if (v > 0 && v < 100000) out.mrp = String(v);
  }

  const batch = t.match(/(?:B\.?\s?No\.?|Batch\s*(?:No\.?|Number|#)?)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,14})/i);
  if (batch && !/^(mfg|mfd|exp|date)/i.test(batch[1])) out.batchNo = batch[1].toUpperCase();

  const exp = t.match(new RegExp(String.raw`(?:Exp\.?(?:iry)?(?:\s*Date)?|E\.?D\.?|Use\s*before)\s*[:.\-]?\s*` + DATE, "i"));
  if (exp) { const d = parseMonthYear(exp[1], true); if (d) out.expiryDate = d; }
  const mfg = t.match(new RegExp(String.raw`(?:Mfg\.?(?:\s*Date)?|Mfd\.?(?:\s*Date)?|M\.?D\.?)\s*[:.\-]?\s*` + DATE, "i"));
  if (mfg) { const d = parseMonthYear(mfg[1], false); if (d) out.mfgDate = d; }

  const by = t.match(/(?:Mfd\.?|Manufactured|Marketed)\s*by\s*[:\-]?\s*([^\n]{3,50})/i);
  if (by) out.manufacturer = by[1].replace(/[^\w &.\-]/g, "").trim();

  const strength = t.match(/\b(\d{1,4}(?:\.\d+)?)\s?(mg|mcg|gm|g|ml|iu)\b/i);

  // Name: first clean alphabetic line from the top, preferring one that mentions a dosage form.
  const lines = raw.split("\n").map((l) => l.replace(/[^A-Za-z0-9 .\-+&()]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const ok = lines.slice(0, 10).filter((l) => {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    return letters >= 4 && letters / l.length > 0.6 && !NOISE.test(l);
  });
  const best = ok.find((l) => FORMS.test(l)) || ok[0];
  if (best) {
    let name = best.replace(FORMS, " ").replace(/\b(I\.?P\.?|B\.?P\.?|U\.?S\.?P\.?)\b/gi, " ").replace(/\s+/g, " ").replace(/^[\s.\-]+|[\s.\-]+$/g, "");
    const form = (best.match(FORMS) || [])[1];
    if (name.length >= 3) {
      if (strength && !new RegExp(strength[1] + "\\s?" + strength[2], "i").test(name)) name += ` ${strength[1]} ${strength[2].toLowerCase()}`;
      out.name = name;
    }
    if (form) out.form = form;
  }
  if (strength) out.strength = `${strength[1]} ${strength[2].toLowerCase()}`;
  return out;
}
