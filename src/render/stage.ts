import { $, $$, esc } from '../core/dom';
import { DUR, FPS, compBg, layers, CW, CH, projName } from '../model/project';
import { lay, val } from '../anim/interpolate';
import { S, isDrawTool, isSelTool, selIds } from '../state/state';
import { guideHtml } from './guides';
import { hoseD, shapeSvg } from './shapes';
import { isFilterFx, postT, rippleBF } from '../fx/defs';
import { fxDefs } from '../fx/filters';
import { mat, mstr, pose, relM, repN, repXf, setXfEls, world, xfEls } from '../anim/pose';
import { fxShaderDims, fxShaderId, fxShaderLayer, fxShaderSize, mountShaders, renderShader } from '../shader/runtime';

/** The layer's first switched-on Shader fill effect, if any (only one is drawn per layer). */
export const shaderFill = (l) => { if (l.fxOff || l.type === 'audio') return null; const j = l.fx.findIndex((e) => e.on && e.id === 'shader'); return j < 0 ? null : { j }; };
import { frozen } from '../ui/autofold';
import { lightboxOn } from '../drawing/cels';
import { drawXf } from '../drawing/raster';
import { drawOverlay } from '../drawing/overlay';
import { applyTextAnims } from '../ui/text-animators';
import { dragging } from '../events/delegate';

/* ---------- canvas ---------- */
export const stage = $('#stage'), vp = $('#vp');
export let gEls = {};
export function buildCanvas() {
  let defs = layers.map((l) => fxDefs(l)).join('') +'<filter id="mtw" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><filter id="mtk" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter><filter id="mtl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>';
  const srcOf = (l) => { const i = layers.indexOf(l); return l.matte && i > 0 ? layers[i - 1] : null; };
  const mSrc = new Set(layers.map(srcOf).filter(Boolean).map((x) => x.id));
  const W = '<rect x="-6000" y="-6000" width="14000" height="14000" fill="#fff"/>';
  layers.forEach((l) => { const m = srcOf(l); if (!m) return; const u = `<use href="#mg-${m.id}"`;
    defs += `<mask id="mt-${l.id}" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000">${l.matte === 'alpha' ? u + ' filter="url(#mtw)"/>' : l.matte === 'alphainv' ? W + u + ' filter="url(#mtk)"/>' : l.matte === 'luma' ? u + '/>' : W + u + ' filter="url(#mtl)"/>'}</mask>`; });
  const hidden = [];
  const body = [...layers].reverse().map((l) => {
    const n = repN(l), sh = shapeSvg(l), sf = shaderFill(l);
    // Shader fill effect: the shader canvas sits on top of the shape, masked to the shape's own outline.
    const copy = (i) => {
      if (!sf) return sh;
      const e = l.fx[sf.j], s = (e.scale ?? 100) / 100, w = CW * s, h = CH * s, mid = `shm-${l.id}-${i}`;
      defs += `<mask id="${mid}" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000"><use href="#sb-${l.id}-${i}" filter="url(#mtw)"/></mask>`;
      return `<g id="sb-${l.id}-${i}">${sh}</g><g mask="url(#${mid})" opacity="${((e.mix ?? 100) / 100).toFixed(3)}"${e.blend && e.blend !== 'normal' ? ` style="mix-blend-mode:${e.blend}"` : ''} pointer-events="none"><foreignObject class="shfx" data-fx="${fxShaderId(l, sf.j)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"></foreignObject></g>`;
    };
    const copies = Array.from({ length: n }, (_, k) => `<g class="xf" data-i="${n - 1 - k}">${copy(n - 1 - k)}</g>`).join('');
    const bl = l.blend && l.blend !== 'normal' ? ` style="mix-blend-mode:${l.blend}"` : '';
    const mk = srcOf(l) ? ` mask="url(#mt-${l.id})"` : '';
    const gs = `<g data-id="${l.id}"${mSrc.has(l.id) ? ` id="mg-${l.id}"` : ''}${bl}${mk} ${!l.fxOff && l.fx.some(isFilterFx) ? `filter="url(#fx-${l.id})"` : ''} ${l.type === 'adjust' ? 'pointer-events="none"' : ''}>${copies}</g>`;
    if (mSrc.has(l.id)) { hidden.push(gs); return ''; }
    return mk ? `<g>${gs}</g>` : gs;
  }).join('');
  defs += hidden.join('');
  stage.innerHTML = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Composition: ${esc(projName)}, ${CW} by ${CH}"><defs>${defs}<filter id="onB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .28  0 0 0 0 .32  0 0 0 1 0"/></filter><filter id="onA"><feColorMatrix type="matrix" values="0 0 0 0 .22  0 0 0 0 .86  0 0 0 0 .5  0 0 0 1 0"/></filter></defs><rect width="${CW}" height="${CH}" style="fill: ${compBg || 'var(--comp-bg)'}"/>${body}</svg>${guideHtml()}`;
  gEls = {}; setXfEls({}); fxElCache.clear();
  mountShaders();
  $$('g[data-id]', stage).forEach((g) => { gEls[g.dataset.id] = g; xfEls[g.dataset.id] = []; $$(':scope > .xf', g).forEach((x) => { xfEls[g.dataset.id][+x.dataset.i] = x; }); });
  updateCanvas();
}
/** Redraw only one layer's effect filter (much cheaper than rebuilding the whole canvas while a slider is dragged). */
export function updateFx(l) {
  const old = stage.querySelector(`filter#fx-${l.id}`), tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.innerHTML = fxDefs(l);
  const nf = tmp.querySelector(`filter#fx-${l.id}`);
  if (!old || !nf) { buildCanvas(); return; }
  old.replaceWith(nf); fxElCache.clear(); updateCanvas();
}
// Effect elements that change every frame (noise seeds, ripple frequency), found once instead of by a document search on each frame.
const fxElCache = new Map<string, Element | null>();
const fxEl = (id: string) => { let e = fxElCache.get(id); if (!e || !e.isConnected) { e = stage.querySelector('#' + id); fxElCache.set(id, e); } return e; };
/** The longer side (in pixels) a Shader fill is drawn at: enough for how big it is on screen, never more than the 960 maximum. */
function shaderPx(scalePct: number) {
  const px = Math.max(stage.clientWidth, stage.clientHeight) * (scalePct / 100) * Math.min(window.devicePixelRatio || 1, 2);
  return Math.max(320, Math.min(fxShaderSize, Math.ceil(px / 160) * 160));
}
export function updateCanvas() {
  const F0 = S.f;
  for (const l of layers) {
    const f = postT(l, F0), t = f / FPS;
    const g = gEls[l.id], xs = xfEls[l.id]; if (!g || !xs) continue;
    const vis = l.vis && (!S.solo.size || S.solo.has(l.id)) && F0 >= (l.inP ?? 0) && F0 < (l.outP ?? DUR);
    if (!vis) { g.setAttribute('opacity', '0'); continue; } // a hidden layer needs no pose, effect or shader work
    const base = l.parent && lay(l.parent) ? relM(l, f, 0) : null;
    xs.forEach((xf, i) => {
      if (!xf) return;
      const q = pose(l, f, i); if (l.rep && l.rep.on) repXf(l, q, i);
      let m = mat(q); if (base) m = base.multiply(m);
      if (l.type === 'hose') m = new DOMMatrix(); // a hose is drawn straight in composition space, between its joints
      xf.setAttribute('transform', mstr(m));
      xf.setAttribute('opacity', Math.max(0, Math.min(1, q.o / 100)).toFixed(3));
      if (l.type === 'draw') drawXf(l, xf, i, f);
      const tp = xf.querySelector('.tp');
      if (tp) {
        const lo = Math.max(0, Math.min(q.ts, q.te)), hi = Math.min(100, Math.max(q.ts, q.te)), len = +tp.dataset.len || 100;
        if (lo <= .01 && hi >= 99.99) { if (tp.dataset.dash) tp.setAttribute('stroke-dasharray', tp.dataset.dash); else tp.removeAttribute('stroke-dasharray'); if (tp.dataset.doff) tp.setAttribute('stroke-dashoffset', tp.dataset.doff); else tp.removeAttribute('stroke-dashoffset'); tp.style.strokeOpacity = ''; }
        else { tp.setAttribute('stroke-dasharray', `${((hi - lo) / 100 * len).toFixed(2)} ${(len * 2).toFixed(1)}`); tp.setAttribute('stroke-dashoffset', (-lo / 100 * len).toFixed(2)); tp.style.strokeOpacity = hi - lo < .05 ? '0' : ''; }
      }
    });
    if (l.type === 'hose') { const d = hoseD(l, f); g.querySelectorAll('path.ho, path.hf').forEach((p) => p.setAttribute('d', d)); }
    g.setAttribute('opacity', String(lightboxOn() && l.id !== S.sel ? .2 : 1));
    if (l.type === 'shader') { const rt = renderShader(l, f); const ph = g.querySelector('.shph'); if (ph) ph.style.display = rt.ok ? 'none' : ''; }
    const sf = shaderFill(l); if (sf) { renderShader(fxShaderLayer(l, sf.j), f, ...fxShaderDims(shaderPx(l.fx[sf.j].scale ?? 100))); }
    if (l.type === 'text' && (l.anims || []).length) applyTextAnims(l, g, f);
    l.fx.forEach((e, j) => {
      if (e.on && (e.id === 'roughen' || e.id === 'grain' || e.id === 'glitch')) { const tb = fxEl(`rf-${l.id}-${j}`); if (tb) tb.setAttribute('seed', String(e.id === 'grain' ? 1 + Math.floor(F0) % 97 : 1 + Math.floor(F0 * (e.speed || 0) / FPS) % 997)); }
      if (e.on && e.id === 'ripple') { const tb = fxEl(`rt-${l.id}-${j}`); if (tb) { const bf = rippleBF(e), sp = (e.speed ?? 30) * .12; tb.setAttribute('baseFrequency', `${(bf * (1 + .22 * Math.sin(t * sp))).toFixed(5)} ${(bf * (1 + .22 * Math.cos(t * sp * .83))).toFixed(5)}`); } }
    });
  }
  // During playback the playback loop places the selection at the start of each frame, while the layout is still clean.
  // Here it would measure straight after the writes above and make the browser lay out the page twice per frame.
  if (!S.playing) placeSel();
}
// While a zoom is in progress the stage is scaled with a CSS transform (cheap, done by the GPU) instead of being resized.
// A resize makes Safari redraw every SVG filter at the new size on each step, which stutters with Bloom, Halftone and similar effects.
// When the zoom pauses, the stage gets its real size once and the filters are drawn sharp.
let base: { W: number; H: number; x: number; y: number } | null = null, settleT = 0, liveRaf = 0;
const SETTLE_MS = 140;
function settle() { settleT = 0; stage.style.willChange = ''; layoutStage(); if (layers.some(shaderFill)) updateCanvas(); } // a Shader fill is redrawn at the new on-screen size
/** Fast path for wheel and pinch zoom. Falls back to a full layout when there is no base size to scale from. */
export function layoutStageLive() {
  if (frozen || !base) { layoutStage(); return; }
  const g = fitBox();
  const sx = g.W / base.W;
  stage.style.willChange = 'transform';
  stage.style.transform = `translate(${g.x - base.x}px, ${g.y - base.y}px) scale(${sx})`;
  const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(g.sc * 100) + '%';
  // The selection box and overlay follow once per frame, not once per input event.
  if (!liveRaf) liveRaf = requestAnimationFrame(() => { liveRaf = 0; placeSel(); });
  clearTimeout(settleT); settleT = window.setTimeout(settle, SETTLE_MS);
}
/** Where the stage should sit for the current zoom and pan. */
function fitBox() {
  const w = vp.clientWidth;
  let h = vp.clientHeight;
  // On a phone the settings sheet covers most of the canvas width, so fit the canvas into the part above the sheet.
  const app = vp.closest('.app'), pr = $('.panel.r');
  if (app && pr && app.classList.contains('portrait') && app.classList.contains('right-open') && pr.offsetWidth > w * .6) {
    const above = pr.offsetTop - vp.offsetTop; if (above > 120) h = Math.min(h, above);
  }
  const fit = Math.min((w - 56) / CW, (h - 56) / CH);
  const sc = Math.max(.05, fit * S.zoom);
  const W = CW * sc, H = CH * sc;
  return { W, H, sc, x: (w - W) / 2 + S.pan[0], y: (h - H) / 2 + S.pan[1] };
}
export function layoutStage() {
  clearTimeout(settleT); settleT = 0; stage.style.transform = '';
  if (frozen) {
    const v = vp.getBoundingClientRect(), k = S.zoom / frozen.zoom, W = frozen.w * k, H = frozen.h * k;
    const cx = frozen.cx + S.pan[0] - frozen.pan[0], cy = frozen.cy + S.pan[1] - frozen.pan[1];
    Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: (cx - W / 2 - v.left) + 'px', top: (cy - H / 2 - v.top) + 'px' });
    const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(W / CW * 100) + '%';
    base = null; placeSel(); return;
  }
  const g = fitBox();
  Object.assign(stage.style, { width: g.W + 'px', height: g.H + 'px', left: g.x + 'px', top: g.y + 'px' });
  base = { W: g.W, H: g.H, x: g.x, y: g.y };
  const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(g.sc * 100) + '%';
  placeSel();
}
export function compPt(e) { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CW, (e.clientY - r.top) / r.height * CH]; }
export function selRect() {
  let r = null;
  for (const id of selIds()) {
    const l = lay(id), g = gEls[id]; if (!g || !l || !l.vis) continue;
    // With a Shader fill, measure the shape itself, not the (larger, masked) shader canvas on top of it.
    const parts = shaderFill(l) ? [...g.querySelectorAll('[id^="sb-"]')] : [g];
    const bs = parts.map((p) => p.getBoundingClientRect()), b = bs.reduce((u, q) => ({ left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom), width: 0, height: 0 }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, width: 0, height: 0 });
    b.width = b.right - b.left; b.height = b.bottom - b.top;
    if (!isFinite(b.width) || (b.width < 1 && b.height < 1)) continue;
    r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  }
  if (r) { r.width = r.right - r.left; r.height = r.bottom - r.top; }
  return r;
}
// A layer's anchor point in composition space (follows parenting and behaviours).
export const anchorAt = (l, f) => world(l, f).transformPoint(new DOMPoint(l.p.ax ? val(l.p.ax, f) : 0, l.p.ay ? val(l.p.ay, f) : 0));
// Convert a composition-space move into the layer's own (parent) space.
export function toLocal(l, dx, dy, f = S.f) {
  if (l.parent && lay(l.parent)) { try { const inv = relM(l, f, 0).inverse(); if (isFinite(inv.a)) return [inv.a * dx + inv.c * dy, inv.b * dx + inv.d * dy]; } catch { /* keep comp delta */ } }
  return [dx, dy];
}
export function placeSel() {
  const box = $('#selbox'), qb = $('#qbar'), anc = $('#anc'), v = vp.getBoundingClientRect(), dt = isDrawTool(S.tool), r = dt ? null : selRect();
  drawOverlay();
  $('#bbar').classList.toggle('show', dt && !S.playing && !S.fbf);
  if (S.tool === 'rig') { // the rig tool shows its own bar at the top, and no selection box
    box.hidden = true; anc.hidden = true; qb.classList.toggle('show', !S.playing);
    qb.style.left = Math.max(8, (v.width - qb.offsetWidth) / 2) + 'px'; qb.style.top = '12px'; return;
  }
  if (!r) { box.hidden = true; anc.hidden = true; qb.classList.remove('show'); return; }
  const multi = selIds().length > 1, l = lay(S.sel);
  box.hidden = false; box.classList.toggle('multi', multi);
  if (!multi && l) { const sr = stage.getBoundingClientRect(), ap = anchorAt(l, S.f); anc.hidden = false; anc.style.left = (sr.left - v.left + ap.x / CW * sr.width) + 'px'; anc.style.top = (sr.top - v.top + ap.y / CH * sr.height) + 'px'; } else anc.hidden = true;
  Object.assign(box.style, { left: (r.left - v.left - 4) + 'px', top: (r.top - v.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
  const show = isSelTool(S.tool) && !S.playing && !dragging;
  qb.classList.toggle('show', show);
  if (!show) return;
  const qw = qb.offsetWidth, qh = qb.offsetHeight;
  let x = r.left - v.left + r.width / 2 - qw / 2; x = Math.max(8, Math.min(v.width - qw - 8, x));
  let y = r.bottom - v.top + 14;
  if (y + qh > v.height - 8) y = r.top - v.top - qh - 40;
  if (y < 56) y = v.height - qh - 10;
  qb.style.left = x + 'px'; qb.style.top = y + 'px';
}
