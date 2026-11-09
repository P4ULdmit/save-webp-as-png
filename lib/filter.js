/**
 * PNG scanline filtering with per-row adaptive selection
 * (None/Sub/Up/Average/Paeth, minimum sum of absolute differences — the libpng heuristic).
 *
 * @param {Uint8Array} px     straight RGBA rows to filter (w*h*4 bytes)
 * @param {number} w
 * @param {number} h          number of rows in `px`
 * @param {3|4} bpp           output bytes per pixel (3 drops the alpha channel)
 * @param {Uint8Array|null} prevRgba  RGBA row directly above `px` (null for the first image row)
 * @returns {Uint8Array}      h * (1 + w*bpp) bytes: filter type byte + filtered row
 */
export function filterRows(px, w, h, bpp, prevRgba = null) {
  const stride = w * bpp;
  const out = new Uint8Array((stride + 1) * h);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  let cand = new Uint8Array(stride);
  let best = new Uint8Array(stride);
  if (prevRgba) pack(prevRgba, 0, prev, stride, bpp);

  for (let y = 0, o = 0; y < h; y++, o += stride + 1) {
    pack(px, y * w * 4, cur, stride, bpp);

    // Filter 0 (None) is the baseline.
    let bestType = 0;
    let bestSum = 0;
    for (let i = 0; i < stride; i++) {
      const v = cur[i];
      bestSum += v < 128 ? v : 256 - v;
    }
    best.set(cur);

    // Filters 1..4; each loop bails out as soon as it can't beat the best so far.
    for (let type = 1; type <= 4 && bestSum > 0; type++) {
      let sum = 0;
      let i = 0;
      switch (type) {
        case 1: // Sub
          for (; i < bpp; i++) { const v = cur[i]; cand[i] = v; sum += v < 128 ? v : 256 - v; }
          for (; i < stride && sum < bestSum; i++) {
            const v = (cur[i] - cur[i - bpp]) & 255;
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          break;
        case 2: // Up
          for (; i < stride && sum < bestSum; i++) {
            const v = (cur[i] - prev[i]) & 255;
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          break;
        case 3: // Average
          for (; i < bpp; i++) {
            const v = (cur[i] - (prev[i] >> 1)) & 255;
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          for (; i < stride && sum < bestSum; i++) {
            const v = (cur[i] - ((cur[i - bpp] + prev[i]) >> 1)) & 255;
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          break;
        case 4: // Paeth
          for (; i < bpp; i++) {
            const v = (cur[i] - prev[i]) & 255; // a = c = 0 -> predictor is b
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          for (; i < stride && sum < bestSum; i++) {
            const a = cur[i - bpp], b = prev[i], c = prev[i - bpp];
            const p = b - c, q = a - c;
            const pa = p < 0 ? -p : p, pb = q < 0 ? -q : q, pc = p + q < 0 ? -(p + q) : p + q;
            const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            const v = (cur[i] - pred) & 255;
            cand[i] = v; sum += v < 128 ? v : 256 - v;
          }
          break;
      }
      if (i === stride && sum < bestSum) {
        bestSum = sum;
        bestType = type;
        const t = best; best = cand; cand = t;
      }
    }

    out[o] = bestType;
    out.set(best, o + 1);
    const t = prev; prev = cur; cur = t;
  }
  return out;
}

function pack(src, s, dst, stride, bpp) {
  if (bpp === 4) {
    dst.set(src.subarray(s, s + stride));
  } else {
    for (let i = 0, j = s; i < stride; i += 3, j += 4) {
      dst[i] = src[j];
      dst[i + 1] = src[j + 1];
      dst[i + 2] = src[j + 2];
    }
  }
}
