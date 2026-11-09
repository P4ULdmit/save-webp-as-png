// Offscreen document: fetch → decode (exact, non-premultiplied RGBA) → PNG → blob URL.
import { convertToPng } from './lib/convert.js';

const live = new Map(); // blobUrl -> safety timer
const SAFETY_REVOKE_MS = 10 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false;
  handle(msg).then(sendResponse, (e) =>
    sendResponse({ ok: false, error: String(e?.message || e) })
  );
  return true; // async response
});

async function handle(msg) {
  switch (msg.cmd) {
    case 'convert-url': {
      let blob, fileName;
      try {
        const r = await fetch(msg.url, { credentials: 'include' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        fileName = fileNameFromDisposition(r.headers.get('content-disposition'));
        blob = await r.blob();
      } catch (e) {
        return { ok: false, fetchFailed: true, error: String(e?.message || e) };
      }
      return finish(await convertToPng(blob), fileName);
    }
    case 'convert-base64': {
      const bytes = base64ToBytes(msg.data);
      return finish(await convertToPng(new Blob([bytes], { type: msg.type || '' })));
    }
    case 'revoke': {
      revoke(msg.url);
      return { ok: true, remaining: live.size };
    }
    default:
      return { ok: false, error: `Unknown command ${msg.cmd}` };
  }
}

function finish(png, fileName) {
  const blobUrl = URL.createObjectURL(png);
  live.set(blobUrl, setTimeout(() => revoke(blobUrl), SAFETY_REVOKE_MS));
  return { ok: true, blobUrl, fileName };
}

function revoke(url) {
  if (!live.has(url)) return;
  clearTimeout(live.get(url));
  live.delete(url);
  URL.revokeObjectURL(url);
}

function base64ToBytes(b64) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fileNameFromDisposition(header) {
  if (!header) return '';
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[2].trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  return plain ? (plain[2] ?? plain[1]).trim() : '';
}
