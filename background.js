// Service worker: context menu, fetching orchestration and downloads.
// The heavy lifting (decode + PNG encode) runs in an offscreen document,
// because a service worker has no URL.createObjectURL and no DOM.

const MENU_ID = 'save-as-png';
const OFFSCREEN_URL = 'offscreen.html';

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

// ---------------------------------------------------------------- menu

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: t('menuTitle'),
      contexts: ['image'],
    });
  });
  clearSessionRules();
});

chrome.runtime.onStartup.addListener(clearSessionRules);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  busy++;
  saveAsPng(info, tab)
    .catch(reportError)
    .finally(() => busy--);
});

// ---------------------------------------------------------------- main flow

let busy = 0; // conversions in flight; the offscreen doc is not closed while > 0

async function saveAsPng(info, tab) {
  const url = info.srcUrl;
  if (!url) throw new Error(t('errNoUrl'));

  await ensureOffscreen();

  // 1) Fetch from the extension (bypasses CORS thanks to host permissions).
  //    The Referer of the page is added so hotlink-protected CDNs answer.
  let res = { ok: false, fetchFailed: true, error: 'unsupported scheme' };
  if (/^(https?|data|file):/i.test(url)) {
    const referrer = info.frameUrl || info.pageUrl || tab?.url;
    res = await withReferer(url, referrer, () =>
      callOffscreen({ cmd: 'convert-url', url })
    );
  }

  // 2) Fallback: fetch inside the page itself (blob: URLs, cookie-bound images…).
  if (!res.ok && res.fetchFailed && tab?.id >= 0) {
    const page = await fetchInPage(tab.id, info.frameId ?? 0, url).catch((e) => ({
      error: String(e?.message || e),
    }));
    if (page?.data) {
      res = await callOffscreen({ cmd: 'convert-base64', data: page.data, type: page.type });
    } else if (page?.error) {
      res.error = `${res.error}; ${page.error}`;
    }
  }

  if (!res.ok) {
    throw new Error(res.fetchFailed ? t('errFetch', [res.error]) : res.error);
  }

  await startDownload(res.blobUrl, makeFileName(url, res.fileName));
}

// ---------------------------------------------------------------- offscreen document

let creating = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ['BLOBS', 'WORKERS'],
      justification: 'Decode images and encode PNG blobs (in worker threads) for download.',
    })
    .finally(() => (creating = null));
  await creating;
}

async function callOffscreen(msg) {
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', ...msg });
  if (!res) throw new Error('Offscreen document did not respond');
  return res;
}

// ---------------------------------------------------------------- downloads

async function startDownload(blobUrl, filename) {
  try {
    return await chrome.downloads.download({ url: blobUrl, filename, conflictAction: 'uniquify' });
  } catch (e) {
    // Chrome rejects some file names (reserved words, odd unicode…): retry with a safe one.
    try {
      return await chrome.downloads.download({ url: blobUrl, filename: 'image.png', conflictAction: 'uniquify' });
    } catch (e2) {
      await callOffscreen({ cmd: 'revoke', url: blobUrl }).catch(() => {});
      throw new Error(t('errDownload', [String(e2?.message || e2)]));
    }
  }
}

// Release the blob as soon as Chrome has finished writing the file.
chrome.downloads.onChanged.addListener(async (delta) => {
  const state = delta.state?.current;
  if (state !== 'complete' && state !== 'interrupted') return;
  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item || item.byExtensionId !== chrome.runtime.id) return;
  if (!item.url.startsWith(`blob:chrome-extension://${chrome.runtime.id}/`)) return;
  if (!(await chrome.offscreen.hasDocument())) return;

  const { remaining } = await callOffscreen({ cmd: 'revoke', url: item.url }).catch(() => ({}));
  if (remaining === 0 && busy === 0) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
});

// ---------------------------------------------------------------- file name

function makeFileName(url, headerName) {
  let name = headerName || '';
  if (!name && !/^(data|blob):/i.test(url)) {
    try {
      const last = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      name = decodeURIComponent(last);
    } catch {
      /* keep empty */
    }
  }
  name = name
    .replace(/\.[a-z0-9]{1,5}$/i, '') // drop original extension (.webp, .jpg…)
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 150);
  return `${name || 'image'}.png`;
}

// ---------------------------------------------------------------- Referer for hotlink protection

async function withReferer(url, referrer, fn) {
  let rule = null;
  try {
    const target = new URL(url);
    const ref = new URL(referrer);
    if (/^https?:$/.test(target.protocol) && /^https?:$/.test(ref.protocol)) {
      // Mimic the browser's default "strict-origin-when-cross-origin" policy.
      const value = ref.origin === target.origin ? ref.href.split('#')[0] : `${ref.origin}/`;
      rule = {
        id: 1 + Math.floor(Math.random() * 2_000_000_000),
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'referer', operation: 'set', value }],
        },
        condition: {
          requestDomains: [target.hostname],
          initiatorDomains: [chrome.runtime.id],
          tabIds: [chrome.tabs.TAB_ID_NONE],
          resourceTypes: ['xmlhttprequest'],
        },
      };
      await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });
    }
  } catch {
    rule = null; // no referer is not fatal
  }
  try {
    return await fn();
  } finally {
    if (rule) {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id] }).catch(() => {});
    }
  }
}

async function clearSessionRules() {
  const rules = await chrome.declarativeNetRequest.getSessionRules().catch(() => []);
  if (rules.length) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rules.map((r) => r.id) });
  }
}

// ---------------------------------------------------------------- in-page fallback

async function fetchInPage(tabId, frameId, url) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: pageFetch,
    args: [url],
  });
  return injection?.result;
}

// Runs inside the page (isolated world). Must be self-contained.
async function pageFetch(url) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const bytes = new Uint8Array(await r.arrayBuffer());
    let data;
    if (typeof bytes.toBase64 === 'function') {
      data = bytes.toBase64();
    } else {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      data = btoa(s);
    }
    return { data, type: r.headers.get('content-type') || '' };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------- errors

function reportError(err) {
  console.error('[webp→png]', err);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: t('errTitle'),
    message: String(err?.message || err).slice(0, 300),
  });
}
