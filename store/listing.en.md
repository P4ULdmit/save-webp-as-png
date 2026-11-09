# Store listing — English

Paste these into the Chrome Web Store dashboard → **Store listing** (language: English).

**Name** (taken from the manifest): Save WebP as PNG

**Summary** (taken from the manifest, 132 chars max):
Save WebP (or any other image) as PNG from the context menu — lossless, with transparency and color profile preserved.

**Category:** Tools

## Description

Right-click any image → "Save as PNG". The PNG goes straight to your Downloads folder (or wherever Chrome saves your downloads). No upload sites, no extra dialogs.

Made for WebP, but works with any image Chrome can open: WebP, AVIF, JPEG, GIF, BMP, ICO, SVG.

WHY IT'S DIFFERENT
Most converters draw the image on a canvas first. That quietly changes the color of semi-transparent pixels. This extension reads the decoded pixels directly, so the PNG has exactly the pixels of the original image.

★ Lossless: every pixel is kept bit for bit, including partly transparent ones
★ Full alpha channel: transparency is preserved; fully opaque images are saved as smaller RGB PNGs
★ Exact colors: the embedded ICC color profile is copied into the PNG
★ Fast: multi-threaded PNG encoder; large images are handled in tiles
★ Works on picky sites: handles hotlink-protected CDNs, blob: images and images behind a login
★ Keeps the original file name, just with .png
★ English and Russian interface

PRIVACY
Everything happens locally in your browser. No images, URLs or personal data ever leave your computer. No analytics, no ads, no accounts.

Limitations: animated images are saved as their first frame. CSS background images don't have an image context menu in Chrome.
