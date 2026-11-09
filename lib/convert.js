import { extractIccProfile } from './icc.js';
import { decodeToRgba } from './decode.js';
import { encodePng } from './png.js';

/**
 * Any browser-decodable image (WebP, AVIF, JPEG, PNG, GIF, BMP, ICO, SVG) -> PNG Blob.
 *
 * Colour fidelity:
 *  - If the source carries an ICC profile (WebP / PNG / JPEG), pixels are decoded raw
 *    (no colour conversion) and the very same profile is embedded into the PNG (iCCP).
 *  - Otherwise pixels are delivered in sRGB and the PNG is tagged sRGB.
 * Alpha: decoded non-premultiplied and read back bit-exact, so semi-transparent
 * pixels keep their original RGB values.
 */
export async function convertToPng(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const icc = await extractIccProfile(bytes).catch(() => null);
  const image = await decodeToRgba(blob, { rawColor: !!icc });
  return encodePng(image, { icc });
}
