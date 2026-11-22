import { CW, CH } from '../model/project';
import { $ } from '../core/dom';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { commit, undoGuard } from '../state/history';
import { buildCanvas, compPt, stage, vp } from '../render/stage';
import { pathHasHandles, pathSegs, polyOf } from '../render/shapes';
import { drawOverlay } from '../drawing/overlay';
import { renderFloats } from '../ui/floats';
import { renderAll } from '../ui/layout';
import { toast } from '../ui/toast';
import { setDragging } from '../events/delegate';
import { shifted } from '../state/modifier';
import { panStart, penFinish, penSeen, ptrs } from './canvas';

/* ---------- pen tool and point editing ----------
   A path point is [x, y] for a corner, or [x, y, inX, inY, outX, outY] with its two curve handles measured from the point.
   Shapes (rectangle, ellipse, star...) stay shapes until a point is actually changed; then they become a path. */
export const EDITABLE = ['path', 'rect', 'ellipse', 'ring', 'star', 'polygon', 'line'];
const KAPPA = .5523, HIT = 22, LINE_HIT = 16, DOUBLE_TAP = 350;
const hIn = (p) => [p[2] || 0, p[3] || 0], hOut = (p) => [p[4] || 0, p[5] || 0];
const setH = (p, i, o) => { p[2] = i[0]; p[3] = i[1]; p[4] = o[0]; p[5] = o[1]; };
const rd = (v) => Math.round(v * 10) / 10;

/** The points of any editable layer, without changing the layer. */
export function shapePts(l) {
  if (l.type === 'path') return l.pts || [];
  if (l.type === 'ellipse' || l.type === 'ring') { const r = l.r, k = r * KAPPA; return [[0, -r, -k, 0, k, 0], [r, 0, 0, -k, 0, k], [0, r, k, 0, -k, 0], [-r, 0, 0, k, 0, -k]]; }
  if (l.type === 'line') { const w = l.w || 420; return [[-w / 2, 0], [w / 2, 0]]; }
  if (l.type === 'star' || l.type === 'polygon') return polyOf(l).map((p) => [rd(p[0]), rd(p[1])]);
  const w = l.w || 280, h = l.h || 180, x = w / 2, y = h / 2, r = Math.min(l.cr ?? 24, x, y), k = r * KAPPA;
  if (r < .5) return [[-x, -y], [x, -y], [x, y], [-x, y]];
  return [[-x + r, -y, -k, 0, 0, 0], [x - r, -y, 0, 0, k, 0], [x, -y + r, 0, -k, 0, 0], [x, y - r, 0, 0, 0, k], [x - r, y, k, 0, 0, 0], [-x + r, y, 0, 0, -k, 0], [-x, y - r, 0, k, 0, 0], [-x, -y + r, 0, 0, 0, -k]];
}
/** Makes the layer a path with explicit handles, keeping how it looks. Safe to call on every edit. */
function toEditable(l) {
  if (l.type !== 'path') {
    const open = l.type === 'line', ring = l.type === 'ring', pts = shapePts(l);
    const sw = ring ? (l.sw ?? 14) : open ? (l.sw ?? 12) : (l.sw || 0), sc = ring ? l.hue : (l.sc || '#ffffff');
    Object.assign(l, { type: 'path', pts, closed: !open, smooth: false, fill: !open && !ring && l.fill !== false, sw, sc });
  } else if (l.smooth && l.pts.length > 2) {
    const segs = pathSegs(l), n = l.pts.length; l.pts = l.pts.map((p) => [p[0], p[1], 0, 0, 0, 0]);
    segs.forEach((q, k) => { const a = l.pts[k], b = l.pts[(k + 1) % n]; a[4] = rd(q[1][0] - q[0][0]); a[5] = rd(q[1][1] - q[0][1]); b[2] = rd(q[2][0] - q[3][0]); b[3] = rd(q[2][1] - q[3][1]); });
    l.smooth = false;
  }
  return l.pts;
}

/* ---- screen mapping: read from the drawn shape, so parents, behaviours and zoom are all included ---- */
function shapeMatrix(l) {
  const g = document.querySelector(`#stage g[data-id="${l.id}"]`); if (!g) return null;
  const el: any = [...g.querySelectorAll('path,rect,circle,polygon,line')].find((x) => !x.closest('defs'));
  const m = el && el.getScreenCTM && el.getScreenCTM();
  return m ? DOMMatrix.fromMatrix(m) : null;
}
const onScreen = (m, x, y) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };

/* ---- edit mode ---- */
/** The layer being point-edited. Clears itself if the selection or tool moved on. */
export function peLayer() {
  if (!S.pe) return null;
  const l = lay(S.pe);
  if (l && S.sel === S.pe && S.tool === 'select' && !l.lock && !S.fbf && S.multi.size <= 1 && EDITABLE.includes(l.type)) return l;
  S.pe = null; S.peI = -1; queueMicrotask(renderFloats); return null;
}
export function peEnter(l) {
  if (!l || l.lock || !EDITABLE.includes(l.type)) return;
  S.pe = l.id; S.peI = -1; S.pop = null; renderFloats(); drawOverlay();
}
export function peExit() { S.pe = null; S.peI = -1; renderFloats(); drawOverlay(); }
const peDone = (label = 'Edit points') => { commit(label); buildCanvas(); renderAll(); };

/** How a point is shaped: no handles = straight; handles set by Smooth (flag at index 6) = smooth; any other handles = curved. */
export type PointType = 'straight' | 'curved' | 'smooth';
export const pointType = (p): PointType => (!p || p.length <= 2 || !(hIn(p).some(Boolean) || hOut(p).some(Boolean)) ? 'straight' : p[6] ? 'smooth' : 'curved');
const TYPES: PointType[] = ['straight', 'curved', 'smooth'];
/** Straight, curved or smooth for the selected point. Smooth rounds the point off: its two handles lie on one line, along the direction
    from the previous point to the next, and each reaches a third of the way to its neighbour. */
export function peSetType(type: PointType, i = S.peI) {
  const l = peLayer(); if (!l || i < 0) return;
  const P = toEditable(l), n = P.length, p = P[i]; if (!p) return;
  const a = P[l.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[l.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
  if (type === 'straight') P[i] = [p[0], p[1]];
  else if (type === 'curved') { if (pointType(p) === 'curved') return; const o = [rd((b[0] - a[0]) / 6), rd((b[1] - a[1]) / 6)]; P[i] = [p[0], p[1], -o[0], -o[1], o[0], o[1]]; }
  else {
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty);
    if (tl < 1e-6) { toast('This point has no neighbours to smooth against'); return; }
    tx /= tl; ty /= tl;
    const dIn = a === p ? Math.hypot(b[0] - p[0], b[1] - p[1]) / 3 : Math.hypot(p[0] - a[0], p[1] - a[1]) / 3, dOut = b === p ? dIn : Math.hypot(b[0] - p[0], b[1] - p[1]) / 3;
    P[i] = [p[0], p[1], rd(-tx * (a === p ? dOut : dIn)), rd(-ty * (a === p ? dOut : dIn)), rd(tx * dOut), rd(ty * dOut), 1];
  }
  peDone('Change point type');
}
/** Switches the point to the next type (straight, curved, smooth). Used by double-tap. */
export function peToggle(i = S.peI) {
  const l = peLayer(); if (!l || i < 0) return;
  const p = shapePts(l)[i]; if (!p) return;
  peSetType(TYPES[(TYPES.indexOf(pointType(p)) + 1) % 3], i);
}
export function peDelete() {
  const l = peLayer(); if (!l || S.peI < 0) return;
  const P = toEditable(l);
  if (P.length <= 2) { toast('A path needs at least two points'); return; }
  P.splice(S.peI, 1); if (P.length < 3) l.closed = false; S.peI = -1;
  peDone('Delete point');
}
export function peCloseToggle() {
  const l = peLayer(); if (!l) return;
  const P = toEditable(l); if (P.length < 3 && !l.closed) { toast('Closing a path needs three points'); return; }
  l.closed = !l.closed; if (!l.closed) l.fill = false;
  peDone(l.closed ? 'Close path' : 'Open path');
}

/** One-finger gesture that stands down the moment a second finger lands, so a two-finger tap never edits anything. */
function track(e, h: { move?: (ev) => void; done?: () => void; tap?: () => void; cancel?: () => void }) {
  const id = e.pointerId, x0 = e.clientX, y0 = e.clientY; let moved = false, dead = false;
  const off = () => { vp.removeEventListener('pointerdown', second); vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', cc); setDragging(false); };
  const kill = () => { if (dead) return; dead = true; off(); h.cancel?.(); };
  const second = (ev) => { if (ev.pointerId !== id) kill(); };
  const mv = (ev) => { if (ev.pointerId !== id) return; if (!moved) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; moved = true; setDragging(true); } h.move?.(ev); };
  const up = (ev) => { if (ev.pointerId !== id) return; off(); if (moved) h.done?.(); else h.tap?.(); };
  const cc = (ev) => { if (ev.pointerId === id) kill(); };
  vp.addEventListener('pointerdown', second); vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', cc);
}

let lastTap = { i: -1, t: 0 };
export function peDown(e) {
  const l = peLayer(); if (!l) return;
  const m = shapeMatrix(l); if (!m) return;
  const inv = m.inverse(), local = (ev) => { const q = inv.transformPoint(new DOMPoint(ev.clientX, ev.clientY)); return [q.x, q.y]; };
  const snap = JSON.stringify(l), restore = () => { Object.keys(l).forEach((k) => delete l[k]); Object.assign(l, JSON.parse(snap)); buildCanvas(); drawOverlay(); };
  const P0 = JSON.parse(JSON.stringify(shapePts(l))), near = (x, y, r) => { const q = onScreen(m, x, y); return Math.hypot(q[0] - e.clientX, q[1] - e.clientY) < r; };
  const live = () => { buildCanvas(); drawOverlay(); }, finish = () => { peDone(); };

  // 1. a curve handle of the selected point
  const sp = P0[S.peI];
  if (sp) for (const side of ['o', 'i']) {
    const h = side === 'o' ? hOut(sp) : hIn(sp), other = side === 'o' ? hIn(sp) : hOut(sp);
    if (!(h[0] || h[1]) || !near(sp[0] + h[0], sp[1] + h[1], HIT)) continue;
    const lh = Math.hypot(...h), lo = Math.hypot(...other), linked = lh > 0 && lo > 0 && Math.abs(h[0] * other[1] - h[1] * other[0]) < lh * lo * .02 && h[0] * other[0] + h[1] * other[1] < 0;
    const i = S.peI;
    track(e, { move: (ev) => { const P = toEditable(l), p = P[i], q = local(ev), d = [rd(q[0] - p[0]), rd(q[1] - p[1])], ld = Math.hypot(d[0], d[1]) || 1, o = S.peParallel ? [rd(other[0] + d[0] - h[0]), rd(other[1] + d[1] - h[1])] : linked && !ev.altKey ? [rd(-d[0] / ld * lo), rd(-d[1] / ld * lo)] : other; if (side === 'o') setH(p, o, d); else setH(p, d, o); if (p.length > 6 && (S.peParallel || ev.altKey)) p[6] = 0; live(); }, done: finish, cancel: restore });
    return;
  }
  // 2. a point: tap selects, double-tap switches corner/curve, drag moves
  let hit = -1, best = HIT;
  P0.forEach((p, i) => { const q = onScreen(m, p[0], p[1]), d = Math.hypot(q[0] - e.clientX, q[1] - e.clientY); if (d < best) { best = d; hit = i; } });
  if (hit >= 0) {
    const i = hit, p0 = P0[i], at = local(e);
    track(e, {
      move: (ev) => { const P = toEditable(l), q = local(ev); P[i][0] = Math.round(p0[0] + q[0] - at[0]); P[i][1] = Math.round(p0[1] + q[1] - at[1]); S.peI = i; live(); },
      done: finish, cancel: restore,
      tap: () => { const now = performance.now(), dbl = lastTap.i === i && now - lastTap.t < DOUBLE_TAP; lastTap = { i, t: now }; S.peI = i; if (dbl) { lastTap = { i: -1, t: 0 }; peToggle(i); } else { renderFloats(); drawOverlay(); } },
    });
    return;
  }
  // 3. a line: tap adds a point, drag bends it
  const edit = { ...l, pts: P0, smooth: l.type === 'path' && l.smooth, closed: l.type === 'path' ? l.closed : l.type !== 'line' };
  const segs = pathSegs(edit); let seg = -1, u = .5, lineBest = LINE_HIT;
  segs.forEach((q, k) => { for (let s = 1; s < 32; s++) { const t = s / 32, b = bez(q, t), sc = onScreen(m, b[0], b[1]), d = Math.hypot(sc[0] - e.clientX, sc[1] - e.clientY); if (d < lineBest) { lineBest = d; seg = k; u = t; } } });
  if (seg >= 0) {
    const k = seg, t = u, q0 = segs[k], at = local(e), w = Math.max(.1, Math.min(.9, t)), D = 3 * (1 - w) * w * ((1 - w) * (1 - w) + w * w), a = (1 - w) / D, c = w / D;
    track(e, {
      move: (ev) => { const P = toEditable(l), A = P[k], B = P[(k + 1) % P.length], q = local(ev), d = [q[0] - at[0], q[1] - at[1]]; A[4] = rd(q0[1][0] - q0[0][0] + d[0] * a); A[5] = rd(q0[1][1] - q0[0][1] + d[1] * a); A[2] = A[2] || 0; A[3] = A[3] || 0; B[2] = rd(q0[2][0] - q0[3][0] + d[0] * c); B[3] = rd(q0[2][1] - q0[3][1] + d[1] * c); B[4] = B[4] || 0; B[5] = B[5] || 0; live(); },
      done: finish, cancel: restore,
      tap: () => {
        const P = toEditable(l), A = P[k], B = P[(k + 1) % P.length], c0 = [q0[0], q0[1], q0[2], q0[3]], lerp = (x, y) => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t];
        const p01 = lerp(c0[0], c0[1]), p12 = lerp(c0[1], c0[2]), p23 = lerp(c0[2], c0[3]), p012 = lerp(p01, p12), p123 = lerp(p12, p23), mid = lerp(p012, p123);
        const curved = c0[1] !== c0[0] || c0[2] !== c0[3], np: number[] = [Math.round(mid[0]), Math.round(mid[1])];
        if (curved) {
          setH(A, hIn(A), [rd(p01[0] - A[0]), rd(p01[1] - A[1])]); setH(B, [rd(p23[0] - B[0]), rd(p23[1] - B[1])], hOut(B));
          setH(np, [rd(p012[0] - np[0]), rd(p012[1] - np[1])], [rd(p123[0] - np[0]), rd(p123[1] - np[1])]);
        }
        P.splice(k + 1, 0, np); S.peI = k + 1; peDone('Add point');
      },
    });
    return;
  }
  // 4. empty canvas: tap leaves point editing, drag pans
  const sx = e.clientX, sy = e.clientY; let multi = false;
  const sec = (ev) => { if (ev.pointerId !== e.pointerId) multi = true; };
  const end = (ev) => { if (ev.pointerId !== e.pointerId) return; vp.removeEventListener('pointerdown', sec); vp.removeEventListener('pointerup', end); vp.removeEventListener('pointercancel', end); if (ev.type === 'pointerup' && !multi && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) peExit(); };
  vp.addEventListener('pointerdown', sec); vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  if (e.pointerType !== 'pen') panStart(e); // the Pencil never moves the canvas while a curve is edited; a finger or mouse still pans
}
const bez = (q, t) => { const v = 1 - t, f = (i) => v * v * v * q[0][i] + 3 * v * v * t * q[1][i] + 3 * v * t * t * q[2][i] + t * t * t * q[3][i]; return [f(0), f(1)]; };

/* ---- pen tool ---- */
let penRedoStack: any[] = [];
export function penUndo() { const p = S.penPts.pop(); if (p) penRedoStack.push(p); drawOverlay(); renderFloats(); }
function penRedo() { const p = penRedoStack.pop(); if (p) S.penPts.push(p); drawOverlay(); renderFloats(); }
export function penClearRedo() { penRedoStack = []; }
/** While a path is being drawn, undo and redo step through its points instead of the project history. */
export function installPenUndo() {
  undoGuard.undo = () => { if (S.tool !== 'pen' || !S.penPts.length) return false; penUndo(); return true; };
  undoGuard.redo = () => { if (S.tool !== 'pen' || !penRedoStack.length) return false; penRedo(); return true; };
}
export function penDown(e) {
  if (ptrs.size > 1) return;
  if (e.pointerType === 'touch' && penSeen) return panStart(e); // with Apple Pencil in use, a finger pans
  const [px, py] = compPt(e), P = S.penPts, k = stage.getBoundingClientRect().width / CW;
  if (P.length > 2 && Math.hypot(px - P[0][0], py - P[0][1]) * k < HIT) { // closing: lifting finishes, dragging shapes the last curve
    const first = P[0], saved = [...first], sh = (ev) => { const [x, y] = compPt(ev); first[2] = Math.round(first[0] - x); first[3] = Math.round(first[1] - y); first[4] = first[4] || 0; first[5] = first[5] || 0; drawOverlay(); };
    track(e, { move: sh, done: () => penFinish(true), tap: () => penFinish(true), cancel: () => { first.length = 0; first.push(...saved); drawOverlay(); } });
    return;
  }
  let qx = px, qy = py;
  if (shifted(e) && P.length) { const [ox, oy] = P[P.length - 1], a = Math.round(Math.atan2(py - oy, px - ox) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(px - ox, py - oy); qx = ox + Math.cos(a) * d; qy = oy + Math.sin(a) * d; } // modifier: 45° steps
  const pt: number[] = [Math.round(qx), Math.round(qy)]; P.push(pt); penClearRedo(); drawOverlay(); renderFloats();
  track(e, {
    move: (ev) => { const [x, y] = compPt(ev), o = [Math.round(x - pt[0]), Math.round(y - pt[1])]; setH(pt, [-o[0], -o[1]], o); drawOverlay(); },
    done: () => { drawOverlay(); renderFloats(); },
    cancel: () => { const i = S.penPts.indexOf(pt); if (i >= 0) S.penPts.splice(i, 1); drawOverlay(); renderFloats(); },
  });
}

/* ---- overlay drawing ---- */
const dOf = (segs, X) => segs.length ? 'M' + X(segs[0][0]) + segs.map((q) => 'C' + X(q[1]) + ' ' + X(q[2]) + ' ' + X(q[3])).join('') : '';
const handleSvg = (a, b) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" style="stroke:rgb(var(--acc));stroke-width:1.2"/><circle class="mpd on" cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="4.5"/>`;
const pointSvg = (q, on) => `<rect class="mpd ${on ? 'on' : ''}" x="${(q[0] - 5).toFixed(1)}" y="${(q[1] - 5).toFixed(1)}" width="10" height="10" rx="2"/>`;
/** Outline, points and handles while a layer is being point-edited. */
export function peOverlay(v) {
  const l = peLayer(), box = $('#selbox'), anc = $('#anc');
  box.style.visibility = anc.style.visibility = l ? 'hidden' : '';
  if (!l || S.playing) return '';
  const m = shapeMatrix(l); if (!m) return '';
  const P = shapePts(l), to = (x, y) => { const q = onScreen(m, x, y); return [q[0] - v.left, q[1] - v.top]; };
  const edit = { ...l, pts: P, smooth: l.type === 'path' && l.smooth, closed: l.type === 'path' ? l.closed : l.type !== 'line' };
  let out = `<path class="mp" style="stroke-dasharray:none;stroke-width:1.5" d="${dOf(pathSegs(edit), (q) => to(q[0], q[1]).map((n) => n.toFixed(1)).join(' '))}"/>`;
  const sp = P[S.peI];
  if (sp) { const a = to(sp[0], sp[1]), hi = hIn(sp), ho = hOut(sp); if (hi[0] || hi[1]) out += handleSvg(a, to(sp[0] + hi[0], sp[1] + hi[1])); if (ho[0] || ho[1]) out += handleSvg(a, to(sp[0] + ho[0], sp[1] + ho[1])); }
  P.forEach((p, i) => { out += pointSvg(to(p[0], p[1]), i === S.peI); });
  return out;
}
/** The path being drawn with the pen tool. */
export function penOverlay(v) {
  const P = S.penPts; if (S.tool !== 'pen' || !P.length) return '';
  const sr = stage.getBoundingClientRect(), to = (x, y) => [sr.left - v.left + x / CW * sr.width, sr.top - v.top + y / CH * sr.height];
  const segs = pathSegs({ pts: P, closed: false, smooth: false });
  let out = segs.length ? `<path class="mp" style="stroke-dasharray:none;stroke-width:2.5" d="${dOf(segs, (q) => to(q[0], q[1]).map((n) => n.toFixed(1)).join(' '))}"/>` : '';
  const last = P[P.length - 1], a = to(last[0], last[1]);
  if (pathHasHandles({ pts: [last] })) { const hi = hIn(last), ho = hOut(last); out += handleSvg(a, to(last[0] + hi[0], last[1] + hi[1])) + handleSvg(a, to(last[0] + ho[0], last[1] + ho[1])); }
  P.forEach((q, i) => { const s = to(q[0], q[1]); out += `<circle class="mpd ${i === 0 ? 'on' : ''}" cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${i === 0 ? 8 : 5}"/>`; });
  return out;
}
