# Save WebP as PNG (Chrome extension)

**English** · [Русский](README.ru.md)

Right-click any image and choose **Save as PNG**. The file goes straight to Chrome's download
folder (the one set in `chrome://settings/downloads`). If "Ask where to save each file" is on,
Chrome asks where to save it.

The interface follows the browser language: Russian for Russian Chrome, English for everything else.

## Install

**From a release (no store needed):** download `save-webp-as-png-<version>.zip` from
[Releases](https://github.com/P4ULdmit/save-webp-as-png/releases/latest) and unpack it into a folder you will keep. Then:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unpacked folder (or this repository's folder).

After editing the code, press ⟳ on the extension card.

## Features

- **Lossless.** Pixels never pass through a 2D canvas, which premultiplies alpha and damages
  the colour of semi-transparent pixels. The image is decoded with `premultiplyAlpha: 'none'`,
  uploaded to a WebGL2 texture and read back bit-exact. Even the RGB of fully transparent
  pixels is kept.
- **Alpha channel.** If no pixel is transparent, the PNG is written as RGB: same pixels,
  smaller file.
- **Colour.** If the source has an ICC profile (WebP, PNG, JPEG), it is copied unchanged into
  the PNG (`iCCP` chunk) and pixels are not converted. Otherwise the PNG is tagged sRGB.
- **Speed.** Own PNG encoder: per-row adaptive filter choice (like libpng), filtering in
  several workers in parallel, compression with the browser's native zlib
  (`CompressionStream`). Images larger than 4096 px are processed in tiles.
- **Tricky sites.** The image is fetched with the page's Referer, so hotlink-protected CDNs
  serve it. If that fails (`blob:` URLs, images behind a login), it is fetched from inside
  the page.
- Works with any format Chrome can decode: WebP, AVIF, JPEG, GIF, BMP, ICO, SVG.
- The file name comes from the URL or `Content-Disposition`, with the extension changed to
  `.png`. If the file already exists, Chrome adds a number.

## Limitations

- Animated WebP/GIF: only the first frame is saved.
- CSS background images (`background-image`) don't get the image context menu. This is a
  Chrome limitation.
- 8 bits per channel. That is enough for WebP, which is always 8-bit.

## Layout

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 |
| `_locales/en`, `_locales/ru` | UI strings (English is the default) |
| `background.js` | Context menu, Referer, in-page fallback fetch, download |
| `offscreen.html/js` | Offscreen document: fetch → convert → blob URL |
| `lib/decode.js` | Exact non-premultiplied RGBA decoding (WebGL2, tiles) |
| `lib/png.js` | PNG encoder (IHDR / iCCP·sRGB / IDAT / IEND, CRC32, worker pool) |
| `lib/filter.js`, `lib/filter-worker.js` | Adaptive PNG row filtering |
| `lib/icc.js` | ICC profile extraction from WebP / PNG / JPEG |
| `store/` | Chrome Web Store listing texts, privacy policy, screenshots, [publishing guide (RU)](store/PUBLISHING.md) |
| `pack.py` | Builds the ZIP for the Web Store into `dist/` |

## License

[MIT](LICENSE)
