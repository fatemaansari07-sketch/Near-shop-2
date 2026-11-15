// Free, on-device OCR (Tesseract.js from CDN on first use). Accuracy comes from the PIPELINE, not one shot:
//  1. orientation probe (0 / 90 / 270 deg) on a small copy, because pack photos are often taken sideways
//  2. several passes on the right orientation: contrast-stretched gray, and local-threshold variants that cut foil glare
//  3. every pass is parsed; fields are chosen by vote across passes (see mergeParsed)
// Everything stays on the phone. Results are only suggestions.
import { parsePackText, mergeParsed } from "./ocrParse";
import { grayStretch, adaptiveMean, grayToRgba } from "./imageOps";

const SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let loading;
const loadLib = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SRC; s.async = true;
    s.onload = () => (window.Tesseract ? res(window.Tesseract) : rej(new Error("OCR load failed")));
    s.onerror = () => { loading = null; rej(new Error("OCR library load nahi hui (internet check karein)")); };
    document.head.appendChild(s);
  });
  return loading;
};

// Draw the photo scaled to maxDim on its longest side, rotated by `rot` degrees (0 / 90 / 270).
function drawScaled(bmp, maxDim, rot) {
  const s = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  const sideways = rot === 90 || rot === 270;
  c.width = sideways ? h : w; c.height = sideways ? w : h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  return c;
}
const readGray = (canvas) => {
  const { width: w, height: h } = canvas;
  const id = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
  return { g: grayStretch(id.data, w, h), w, h };
};
const toCanvas = (g, w, h) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(grayToRgba(g), w, h), 0, 0);
  return c;
};

const ANCHORS = [/mrp|m\.r\.p|rs\./i, /e[xk]p/i, /b\.?\s?no|batch/i, /mf[gd]/i, /tablet|capsule|syrup|strip/i];
const quality = (t) => ANCHORS.filter((a) => a.test(t)).length * 10 + Math.min((t.match(/[A-Za-z]{4,}/g) || []).length, 40);

// Pass plan (best combination measured on test photos): gray -> large-block local threshold -> small-block, then extras.
const PASSES = [
  { id: "gray", psm: "6", prep: (g) => g },
  { id: "adaptive-large", psm: "6", prep: (g, w, h) => adaptiveMean(g, w, h, 71, 15) },
  { id: "adaptive-small", psm: "6", prep: (g, w, h) => adaptiveMean(g, w, h, 21, 8) },
  { id: "gray-sparse", psm: "11", prep: (g) => g },
  { id: "adaptive-sparse", psm: "11", prep: (g, w, h) => adaptiveMean(g, w, h, 41, 12) },
];

/**
 * @param {File} file photo
 * @param {{need?: string[], onProgress?: (info:{pass:number,total:number,pct:number,label:string})=>void}} opts
 *   need = fields that must be found before we stop early (default name+mrp)
 * @returns {{parsed: object, text: string}}  text = raw text of the best pass (for the "kya padha" preview)
 */
export async function scanPack(file, { need = ["name", "mrp"], onProgress } = {}) {
  const T = await loadLib();
  const bmp = await createImageBitmap(file);
  const total = 1 + PASSES.length;
  let step = 0, label = "Photo seedhi kar raha hu";
  const report = (p = 0) => onProgress?.({ pass: Math.min(step + 1, total), total, pct: Math.round(((step + p) / total) * 100), label });
  const worker = await T.createWorker("eng", 1, { logger: (m) => { if (m.status === "recognizing text") report(m.progress || 0); } });
  try {
    // 1. orientation probe on a small copy
    report(0);
    let bestRot = 0, bestQ = -1;
    for (const rot of [0, 90, 270]) {
      const { g, w, h } = readGray(drawScaled(bmp, 1000, rot));
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      const { data } = await worker.recognize(toCanvas(adaptiveMean(g, w, h, 31, 10), w, h));
      const q = quality(data.text || "");
      if (q > bestQ) { bestQ = q; bestRot = rot; }
      if (rot === 0 && q >= 50) break; // upright and clearly readable: skip rotated probes
    }
    step = 1;
    // 2. full-size passes on the chosen orientation, stop early once enough fields agree
    const { g, w, h } = readGray(drawScaled(bmp, 2200, bestRot));
    const parsedList = [], texts = [];
    for (let i = 0; i < PASSES.length; i++) {
      const p = PASSES[i];
      label = `Photo padh raha hu (${i + 1}/${PASSES.length})`; report(0);
      await worker.setParameters({ tessedit_pageseg_mode: p.psm });
      const { data } = await worker.recognize(toCanvas(p.prep(g, w, h), w, h));
      texts.push(data.text || ""); parsedList.push(parsePackText(data.text || ""));
      step += 1;
      const merged = mergeParsed(parsedList);
      if (parsedList.length >= 2 && need.every((k) => merged[k])) break;
    }
    const bestText = texts.map((t) => [quality(t), t]).sort((a, b) => b[0] - a[0])[0]?.[1] || "";
    return { parsed: mergeParsed(parsedList), text: bestText };
  } finally { await worker.terminate().catch(() => {}); bmp.close?.(); }
}
