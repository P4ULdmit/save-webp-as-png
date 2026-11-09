/**
 * Extract an embedded ICC profile from WebP, PNG or JPEG bytes.
 * Returns Uint8Array (raw, uncompressed profile) or null.
 */
export async function extractIccProfile(b) {
  if (isWebP(b)) return fromWebP(b);
  if (isPng(b)) return fromPng(b);
  if (b[0] === 0xff && b[1] === 0xd8) return fromJpeg(b);
  return null;
}

const ascii = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));
const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function isWebP(b) {
  return b.length >= 16 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP';
}

function isPng(b) {
  return b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG';
}

// RIFF container: 'RIFF' size 'WEBP' then chunks (fourcc, LE size, payload, pad to even).
function fromWebP(b) {
  const end = Math.min(b.length, 8 + u32le(b, 4));
  for (let o = 12; o + 8 <= end; ) {
    const id = ascii(b, o, 4);
    const size = u32le(b, o + 4);
    if (id === 'ICCP') return b.slice(o + 8, o + 8 + size);
    if (id === 'VP8 ' || id === 'VP8L') break; // simple format, no profile
    o += 8 + size + (size & 1);
  }
  return null;
}

// iCCP: name\0, method(0), zlib stream. It must come before IDAT.
async function fromPng(b) {
  for (let o = 8; o + 12 <= b.length; ) {
    const len = u32be(b, o);
    const type = ascii(b, o + 4, 4);
    if (type === 'iCCP') {
      const data = b.subarray(o + 8, o + 8 + len);
      const nul = data.indexOf(0);
      if (nul < 0 || data[nul + 1] !== 0) return null;
      return inflate(data.subarray(nul + 2));
    }
    if (type === 'IDAT' || type === 'IEND') break;
    o += 12 + len;
  }
  return null;
}

// APP2 segments "ICC_PROFILE\0" + seq(1-based) + count + data, possibly split across segments.
function fromJpeg(b) {
  const parts = [];
  for (let o = 2; o + 4 <= b.length; ) {
    if (b[o] !== 0xff) break;
    const marker = b[o + 1];
    if (marker === 0xff) { o++; continue; }
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    const len = (b[o + 2] << 8) | b[o + 3];
    if (marker === 0xe2 && len > 16 && ascii(b, o + 4, 12) === 'ICC_PROFILE\0') {
      parts[b[o + 16]] = b.subarray(o + 18, o + 2 + len);
    }
    o += 2 + len;
  }
  const chunks = parts.filter(Boolean);
  if (!chunks.length) return null;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
