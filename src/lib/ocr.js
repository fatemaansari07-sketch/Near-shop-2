// Free, on-device OCR via Tesseract.js loaded from CDN on first use (no package.json change, nothing sent to a server of ours).
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

// Downscale + grayscale + contrast stretch: faster and noticeably more accurate on glossy strips.
async function prepare(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0; d[i] = d[i + 1] = d[i + 2] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = ((d[i] - lo) * 255) / span; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function readTextFromImage(file, onProgress) {
  const T = await loadLib();
  const canvas = await prepare(file);
  const worker = await T.createWorker("eng", 1, { logger: (m) => { if (m.status === "recognizing text") onProgress?.(Math.round((m.progress || 0) * 100)); } });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text || "";
  } finally { await worker.terminate().catch(() => {}); }
}
