/**
 * Decode an image Blob into straight (non-premultiplied) 8-bit RGBA.
 *
 * Why not just canvas 2D? A 2D canvas stores pixels premultiplied by alpha, so
 * semi-transparent pixels lose RGB precision (alpha 1..254 -> rounding, alpha 0 -> RGB wiped).
 * Instead the bitmap is decoded with premultiplyAlpha:'none' and uploaded to a WebGL2
 * RGBA8 texture, which is then read back with readPixels — bit-exact.
 * Large images are processed in tiles (UNPACK_SKIP_* / PACK_ROW_LENGTH), so there is
 * no limit from MAX_TEXTURE_SIZE. The 2D canvas is used only if WebGL2 is unavailable.
 */
export async function decodeToRgba(blob, { rawColor }) {
  const opts = {
    premultiplyAlpha: 'none',
    colorSpaceConversion: rawColor ? 'none' : 'default',
  };
  const bitmap = await createBitmap(blob, opts);
  try {
    const { width, height } = bitmap;
    if (!width || !height) throw new Error('Image has zero size');
    const data = readViaWebGL(bitmap) ?? readVia2D(bitmap);
    return { width, height, data };
  } finally {
    bitmap.close();
  }
}

async function createBitmap(blob, opts) {
  try {
    return await createImageBitmap(blob, opts);
  } catch (err) {
    // SVG (and a few exotic cases) can't go straight from Blob; go through <img>.
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) throw err;
      return await createImageBitmap(img, opts);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function readViaWebGL(src) {
  const { width: w, height: h } = src;
  let gl;
  try {
    gl = new OffscreenCanvas(1, 1).getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  if (!gl) return null;

  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  try {
    const tile = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    const out = new Uint8Array(w * h * 4);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.PACK_ROW_LENGTH, w); // write tiles straight into `out`

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const tw = Math.min(tile, w - x);
        const th = Math.min(tile, h - y);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
        // Texture row 0 = first image row, so no vertical flip is needed.
        gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, out, (y * w + x) * 4);
      }
    }
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) return null;
    return out;
  } catch {
    return null;
  } finally {
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function readVia2D(src) {
  const { width: w, height: h } = src;
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
}
