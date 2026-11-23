import { isFilterFx } from './defs';
import { fxDefs } from './filters';
import { xfEls } from '../anim/pose';
import { commit } from '../state/history';
import { buildCanvas, shaderFill } from '../render/stage';
import { renderAll } from '../ui/layout';
import { toast } from '../ui/toast';
import { FPS } from '../model/project';
import { celRaster, warmPicture } from '../drawing/raster';

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
  if (l.type === 'draw') return bakeDrawLayer(l);
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

/** The pixel box [left, top, right, bottom] around everything visible, or null if nothing is. It scans in from each
    edge and stops at the first visible pixel, so it reads only the empty margin, not the whole canvas. */
function alphaBounds(px: Uint8ClampedArray, W: number, H: number) {
  const on = (x: number, y: number) => px[(y * W + x) * 4 + 3] > 2;
  const rowOn = (y: number) => { for (let x = 0; x < W; x++) if (on(x, y)) return true; return false; };
  let top = 0; while (top < H && !rowOn(top)) top++;
  if (top === H) return null;
  let bot = H - 1; while (bot > top && !rowOn(bot)) bot--;
  const colOn = (x: number) => { for (let y = top; y <= bot; y++) if (on(x, y)) return true; return false; };
  let left = 0; while (!colOn(left)) left++;
  let right = W - 1; while (right > left && !colOn(right)) right--;
  return [left, top, right, bot];
}

/** Frame-by-frame layers: every cel is baked on its own, so the layer stays a drawing with the same cels, timing and holds. */
async function bakeDrawLayer(l) {
  const fxs = l.fx.filter(isFilterFx);
  if (l.fxOff || !fxs.length) return;
  const cels = (l.cels || []).filter((c) => (c.strokes || []).length);
  const ras = cels.map((c) => celRaster(c)), rects = ras.filter((e) => e.w > 0);
  if (!rects.length) { toast('Nothing to bake. Draw on this layer first'); return; }
  // One shared area for every cel, with room for glows, shadows and glitches that reach outside the drawing.
  const pad = 40 + Math.max(0, ...fxs.map((e) => Math.max(e.radius ?? 0, e.dist ?? 0, (e.off ?? 0) * 2) * 2));
  const x0 = Math.floor(Math.min(...rects.map((e) => e.x)) - pad), y0 = Math.floor(Math.min(...rects.map((e) => e.y)) - pad);
  const box = { x: x0, y: y0, w: Math.ceil(Math.max(...rects.map((e) => e.x + e.w)) + pad - x0), h: Math.ceil(Math.max(...rects.map((e) => e.y + e.h)) + pad - y0) };
  const k = Math.min(1, MAX_SIDE / box.w, MAX_SIDE / box.h), W = Math.max(1, Math.round(box.w * k)), H = Math.max(1, Math.round(box.h * k));
  toast(`Baking ${cels.length} drawing${cels.length > 1 ? 's' : ''}…`);
  const baked = [];
  for (const [i, c] of cels.entries()) {
    const e = ras[i];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS); svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    svg.innerHTML = `<defs>${fxDefs(l, box)}</defs>`;
    // Effects that change from frame to frame use this cel's frame, as they do on the stage.
    l.fx.forEach((fx, j) => {
      if (!fx.on || !['roughen', 'grain', 'glitch'].includes(fx.id)) return;
      const tb = svg.querySelector(`#rf-${l.id}-${j}`);
      if (tb) tb.setAttribute('seed', String(fx.id === 'grain' ? 1 + Math.floor(c.f) % 97 : 1 + Math.floor(c.f * (fx.speed || 0) / FPS) % 997));
    });
    const g = document.createElementNS(NS, 'g'); g.setAttribute('filter', `url(#fx-${l.id})`);
    if (e.w > 0) {
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('href', e.url); im.setAttribute('preserveAspectRatio', 'none');
      im.setAttribute('x', String(e.x)); im.setAttribute('y', String(e.y)); im.setAttribute('width', String(e.w)); im.setAttribute('height', String(e.h));
      g.appendChild(im);
    }
    svg.appendChild(g);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
    let cv: HTMLCanvasElement;
    try {
      const img = new Image(); img.src = url; await img.decode();
      cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      cv.getContext('2d').drawImage(img, 0, 0, W, H);
    } catch { toast('Could not bake this layer'); return; } finally { URL.revokeObjectURL(url); }
    const bb = alphaBounds(cv.getContext('2d').getImageData(0, 0, W, H).data, W, H);
    if (!bb) { baked.push([c, null]); continue; }
    const [a0, b0, a1, b1] = bb, cw = a1 - a0 + 1, ch = b1 - b0 + 1, out = document.createElement('canvas'); out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(cv, a0, b0, cw, ch, 0, 0, cw, ch);
    const pic = { k: 'img', url: out.toDataURL('image/png'), x: box.x + a0 / k, y: box.y + b0 / k, w: cw / k, h: ch / k };
    await warmPicture(pic.url);
    baked.push([c, pic]);
  }
  // Every cel baked: now swap them in, so a failure part-way leaves the layer as it was.
  for (const [c, pic] of baked) { c.strokes = pic ? [pic] : []; c.v = (c.v || 0) + 1; }
  l.fx = l.fx.filter((e) => !isFilterFx(e));
  commit('Bake effects'); buildCanvas(); renderAll();
  toast(`Baked ${cels.length} drawing${cels.length > 1 ? 's' : ''} of ${l.name}`, true);
}
