import React, { useRef, useState } from "react";
import { scanPack } from "../lib/ocr";

// Photo -> text -> suggested fields. Never saves anything; the parent only pre-fills inputs the user can still edit.
export default function OcrScanButton({ onResult, className = "" }) {
  const ref = useRef(null);
  const [pct, setPct] = useState(null);
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setMsg("Sirf photo chuniye.");
    setMsg(""); setPct(0);
    try {
      const { parsed } = await scanPack(f, { onProgress: (i) => { setPct(i.pct); setLabel(i.label); } });
      const n = Object.keys(parsed).filter((k) => ["name", "mrp", "batchNo", "expiryDate", "manufacturer"].includes(k)).length;
      if (!n) setMsg("Photo se kuch padh nahi paya. Roshni me, seedhi aur paas se photo lein, ya manually bharein.");
      else { onResult(parsed); setMsg(`${n} field bhare gaye. Save se pehle check zaroor karein ✔`); }
    } catch (err) { setMsg(err?.message || "Photo padhne me dikkat aayi. Manually bharein."); }
    finally { setPct(null); }
  };
  return <div className={className}>
    <button type="button" disabled={pct !== null} onClick={() => ref.current?.click()} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 py-3 text-sm font-bold text-violet-700 disabled:opacity-60 min-h-[48px]">
      {pct === null ? "📷 Photo se bharo (strip / box)" : `${label || "Padh raha hu"}… ${pct}%`}
    </button>
    <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
    {msg && <div className="mt-1 text-[11px] text-gray-500">{msg}</div>}
  </div>;
}
