import { isFilterFx } from './defs';
import { fxDefs } from './filters';
import { xfEls } from '../anim/pose';
import { commit } from '../state/history';
import { buildCanvas, shaderFill } from '../render/stage';
import { renderAll } from '../ui/layout';
import { toast } from '../ui/toast';

const NS = 'http://www.w3.org/2000/svg';
const MAX_SIDE = 2048; // keeps the baked picture small enough to save with the project

// Blob links only work inside this page, so pictures are copied in as data before drawing.
export async function inlineImages(root) {
  for (const im of [...root.querySelectorAll('image')]) {
    const h = im.getAttribute('href') || '';
    if (!h.startsWith('blob:')) continue;
    try {
      const b = await (await fetch(h)).blob();
      im.setAttribute('href', await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); }));
    } catch { /* leave it; it will draw empty */ }
  }
}

/** Turn a layer and its filter effects into one picture layer. Its movement, keyframes and parent are kept. */
export async function bakeLayer(l) {
  const xf = xfEls[l.id] && xfEls[l.id][0];
  if (!xf || l.fxOff || !l.fx.some(isFilterFx)) return;
  const live = shaderFill(l) ? xf.querySelector('[id^="sb-"]') || xf : xf;
  let bb; try { bb = live.getBBox(); } catch { bb = null; }
  if (!bb || !(bb.width > 0 || bb.height > 0)) { toast('Nothing to bake on this frame'); return; }
  // Room around the layer for glows, shadows and glitches that reach outside it.
  const pad = 40 + Math.max(0, ...l.fx.filter(isFilterFx).map((e) => Math.max(e.radius ?? 0, e.dist ?? 0, (e.off ?? 0) * 2) * 2));
  const box = { x: Math.floor(bb.x - pad), y: Math.floor(bb.y - pad), w: Math.ceil(bb.width + pad * 2), h: Math.ceil(bb.height + pad * 2) };
  const k = Math.min(2, MAX_SIDE / box.w, MAX_SIDE / box.h), W = Math.max(1, Math.round(box.w * k)), H = Math.max(1, Math.round(box.h * k));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS); svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
  const g = document.createElementNS(NS, 'g'); g.setAttribute('filter', `url(#fx-${l.id})`);
  [...live.childNodes].forEach((n) => g.appendChild(n.cloneNode(true)));
  g.querySelectorAll('foreignObject').forEach((fo) => fo.remove());
  svg.innerHTML = `<defs>${fxDefs(l, box)}</defs>`; svg.appendChild(g);
  await inlineImages(svg);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  let cv;
  try {
    const img = new Image(); img.src = url; await img.decode();
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.getContext('2d').drawImage(img, 0, 0, W, H);
  } catch { toast('Could not bake this layer'); return; } finally { URL.revokeObjectURL(url); }
  // Crop to the pixels that are not see-through.
  const px = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { toast('Nothing to bake on this frame'); return; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement('canvas'); out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
  // The picture sits where the layer's content was, in the layer's own space, so the anchor point does not move.
  const lw = cw / k, lh = ch / k, lx = box.x + x0 / k, ly = box.y + y0 / k;
  Object.assign(l, { type: 'image', src: out.toDataURL('image/png'), w: lw, h: lh, ox: lx + lw / 2, oy: ly + lh / 2 });
  delete l.anims; delete l.cels;
  l.fx = l.fx.filter((e) => !isFilterFx(e));
  commit('Bake effects'); buildCanvas(); renderAll();
  toast(`Baked ${l.name} into a picture`, true);
}
