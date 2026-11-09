import { filterRows } from './filter.js';

self.onmessage = ({ data: { id, px, prev, w, h, bpp } }) => {
  const out = filterRows(px, w, h, bpp, prev);
  self.postMessage({ id, out }, [out.buffer]);
};
