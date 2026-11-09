/**
 * Lossless PNG encoder for straight 8-bit RGBA.
 *  - colour type 6 (RGBA), or 2 (RGB) when every pixel is fully opaque — same pixels, smaller file;
 *  - per-row adaptive filter selection (see filter.js), parallelised across workers;
 *  - zlib via the browser's native CompressionStream('deflate');
 *  - iCCP with the source ICC profile, or sRGB chunk if there is none.
 * Pixel values are written untouched — no premultiplication, no gamma, no dithering.
 */
import { filterRows } from './filter.js';

export async function encodePng({ width, height, data }, { icc = null } = {}) {
  const alpha = hasTransparency(data);
  const bpp = alpha ? 4 : 3;
  const idat = await compressScanlines(data, width, height, bpp);

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type
  // [10] compression 0, [11] filter 0, [12] interlace 0

  const parts = [PNG_SIGNATURE, chunk('IHDR', ihdr)];
  if (icc) {
    const name = new TextEncoder().encode('ICC Profile');
    parts.push(chunk('iCCP', concat([name, Uint8Array.of(0, 0), await deflate(icc)])));
  } else {
    parts.push(chunk('sRGB', Uint8Array.of(0))); // perceptual intent
  }
  // Split huge streams so a single chunk never approaches the 2^31-1 limit.
  const MAX = 1 << 30;
  for (let o = 0; o < idat.length; o += MAX) parts.push(chunk('IDAT', idat.subarray(o, o + MAX)));
  parts.push(chunk('IEND', new Uint8Array(0)));
  return new Blob(parts, { type: 'image/png' });
}

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function hasTransparency(px) {
  if (px.byteOffset % 4 === 0) {
    const u32 = new Uint32Array(px.buffer, px.byteOffset, px.length >>> 2);
    // Little-endian: alpha is the top byte.
    for (let i = 0; i < u32.length; i++) if (u32[i] < 0xff000000) return true;
    return false;
  }
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) return true;
  return false;
}

// ------------------------------------------------------------ filtering + zlib

const PARALLEL_MIN_BYTES = 4 << 20; // below ~1 MP a single thread is faster than worker hand-off
const STRIP_BYTES = 4 << 20; // RGBA bytes per worker task

/**
 * Filter + deflate the image. Large images are filtered in horizontal strips by a pool of
 * workers, and finished strips are streamed in order into the native deflater, so
 * filtering and compression overlap.
 */
async function compressScanlines(px, w, h, bpp) {
  const pool = px.length >= PARALLEL_MIN_BYTES ? getPool() : null;
  if (pool) {
    try {
      return await compressParallel(pool, px, w, h, bpp);
    } catch (e) {
      console.warn('[webp→png] parallel filtering failed, using a single thread', e);
    }
  }
  return deflate(filterRows(px, w, h, bpp));
}

async function compressParallel(pool, px, w, h, bpp) {
  const rowBytes = w * 4;
  const rowsPer = Math.max(1, Math.floor(STRIP_BYTES / rowBytes));
  const results = [];
  for (let y = 0; y < h; y += rowsPer) {
    const rows = Math.min(rowsPer, h - y);
    // Copies are made lazily, when a worker picks the task up.
    const p = pool.run(() => ({
      px: px.slice(y * rowBytes, (y + rows) * rowBytes),
      prev: y ? px.slice((y - 1) * rowBytes, y * rowBytes) : null,
      w, h: rows, bpp,
    }));
    p.catch(() => {}); // surfaced through the stream below
    results.push(p);
  }
  let next = 0;
  const stream = new ReadableStream({
    async pull(ctrl) {
      if (next === results.length) return ctrl.close();
      ctrl.enqueue(await results[next++]);
    },
  });
  return deflate(stream);
}

let poolInstance;
function getPool() {
  if (poolInstance !== undefined) return poolInstance;
  try {
    const n = Math.max(1, Math.min((navigator.hardwareConcurrency || 2) - 1, 8));
    poolInstance = new WorkerPool(new URL('./filter-worker.js', import.meta.url), n);
  } catch {
    poolInstance = null;
  }
  return poolInstance;
}

class WorkerPool {
  constructor(url, size) {
    this.idle = [];
    this.queue = [];
    this.jobs = new Map();
    this.seq = 0;
    for (let i = 0; i < size; i++) {
      const worker = new Worker(url, { type: 'module' });
      worker.onmessage = ({ data }) => this.#done(worker, data.id, null, data.out);
      worker.onerror = (e) => {
        e.preventDefault();
        for (const [id, job] of this.jobs) if (job.worker === worker) this.#done(worker, id, e.message || 'worker error');
      };
      this.idle.push(worker);
    }
  }

  run(makeMessage) {
    return new Promise((resolve, reject) => {
      this.queue.push({ makeMessage, resolve, reject });
      this.#pump();
    });
  }

  #pump() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop();
      const job = this.queue.shift();
      const id = ++this.seq;
      const msg = job.makeMessage();
      this.jobs.set(id, { ...job, worker });
      const transfer = [msg.px.buffer];
      if (msg.prev) transfer.push(msg.prev.buffer);
      worker.postMessage({ id, ...msg }, transfer);
    }
  }

  #done(worker, id, error, out) {
    const job = this.jobs.get(id);
    if (!job) return;
    this.jobs.delete(id);
    this.idle.push(worker);
    if (error) job.reject(new Error(error));
    else job.resolve(out);
    this.#pump();
  }
}

async function deflate(input) {
  const source = input instanceof ReadableStream ? input : new Blob([input]).stream();
  const stream = source.pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type, data) {
  const buf = new Uint8Array(12 + data.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
  buf.set(data, 8);
  dv.setUint32(8 + data.length, crc32(buf.subarray(4, 8 + data.length)));
  return buf;
}

function concat(arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of arrays) { out.set(a, p); p += a.length; }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
