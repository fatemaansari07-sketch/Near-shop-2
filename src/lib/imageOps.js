// Pure pixel helpers for the OCR pipeline (no DOM, so they can be unit-tested in Node).

// RGBA -> grayscale with the darkest pixel mapped to 0 and the brightest to 255 (undoes washed-out / dim photos).
export function grayStretch(rgba, w, h) {
  const g = new Uint8Array(w * h);
  let lo = 255, hi = 0;
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    const v = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
    g[j] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  for (let j = 0; j < g.length; j++) g[j] = ((g[j] - lo) * 255) / span;
  return g;
}

// Local-mean threshold (same idea as OpenCV ADAPTIVE_THRESH_MEAN_C): a pixel is white if it is brighter than
// (mean of its block x block neighbourhood) - C. This removes foil glare/shadows that ruin a single global threshold.
export function adaptiveMean(g, w, h, block = 41, C = 12) {
  const r = block >> 1, W = w + 1;
  const integ = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += g[y * w + x]; integ[(y + 1) * W + x + 1] = integ[y * W + x + 1] + row; }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integ[(y1 + 1) * W + x1 + 1] - integ[y0 * W + x1 + 1] - integ[(y1 + 1) * W + x0] + integ[y0 * W + x0];
      out[y * w + x] = g[y * w + x] > sum / area - C ? 255 : 0;
    }
  }
  return out;
}

export function grayToRgba(g) {
  const out = new Uint8ClampedArray(g.length * 4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { out[j] = out[j + 1] = out[j + 2] = g[i]; out[j + 3] = 255; }
  return out;
}
