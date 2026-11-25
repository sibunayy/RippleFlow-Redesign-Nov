import { CW, CH, layers } from '../model/project';
import { lay, val } from '../anim/interpolate';
import { jointPt } from '../anim/pose';
import { S } from '../state/state';
import { commit } from '../state/history';
import { setVal } from '../anim/keys';
import { compPt, stage, toLocal, updateCanvas, vp } from '../render/stage';
import { updateFields } from '../ui/inspector/index';
import { renderAll } from '../ui/layout';
import { foldEnd, foldStart } from '../ui/autofold';
import { toast } from '../ui/toast';
import { setDragging } from '../events/delegate';
import { shifted } from '../state/modifier';
import { addJoint, attachTo, isJoint, newHose, rigSet } from '../actions/rig';
import { panStart, ptrs } from './canvas';
import { drawOverlay } from '../drawing/overlay';

/* ---------- rig: joints on the canvas ----------
   Joints show as dots joined by bones while the Rig tool is on, or while a hose or a joint is selected.
   Dragging a dot turns the bone above it, so the joints below swing with it (forward kinematics). The top joint of a chain moves instead. */
const HIT = 24;
/** The joints to draw and to hit-test. */
function shown(): any[] { if (S.tool === 'rig') return layers.filter(isJoint); if (S.tool !== 'select') return []; return rigSet(S.sel && lay(S.sel)); }
const toScreen = (x: number, y: number) => { const sr = stage.getBoundingClientRect(), v = vp.getBoundingClientRect(); return [sr.left - v.left + x / CW * sr.width, sr.top - v.top + y / CH * sr.height]; };

let preview: { a: number[]; b: number[] } | null = null;
export function rigOverlay(): string {
  // A hose or joint is posed by its joint dots. Its selection box (and the scale handles on its corners) would sit on top of them.
  const sl = S.sel && lay(S.sel); if (sl && (sl.type === 'hose' || sl.joint)) { const b = document.getElementById('selbox'), a = document.getElementById('anc'); if (b) b.style.visibility = 'hidden'; if (a) a.style.visibility = 'hidden'; }
  if (S.playing) return '';
  let out = '';
  const js = shown(), ids = new Set(js.map((j) => j.id));
  for (const j of js) { const p = j.parent && ids.has(j.parent) ? lay(j.parent) : null; if (!p) continue; const a = toScreen(...Object.values(jointPt(p, S.f)) as [number, number]), b = toScreen(...Object.values(jointPt(j, S.f)) as [number, number]); out += `<line class="rg-b" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`; }
  for (const j of js) { const q = jointPt(j, S.f), [x, y] = toScreen(q.x, q.y); out += `<circle class="rg-j ${j.id === S.sel ? 'on' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${j.id === S.sel ? 9 : 7}"/>`; }
  if (preview) { const a = toScreen(preview.a[0], preview.a[1]), b = toScreen(preview.b[0], preview.b[1]); out += `<line class="rg-b" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke-dasharray="6 6"/>`; }
  return out;
}

/** One-pointer drag that stops when a second finger lands. */
function drag(e, h: { move: (ev, started: boolean) => void; done: (moved: boolean) => void }, slop = 5) {
  let moved = false, dead = false;
  const off = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', cc); setDragging(false); };
  const mv = (ev) => { if (dead || ev.pointerId !== e.pointerId) return; if (ptrs.size > 1) { dead = true; off(); return; } if (!moved) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < slop) return; moved = true; setDragging(true); foldStart('drag'); h.move(ev, true); return; } h.move(ev, false); };
  const up = (ev) => { if (ev.pointerId !== e.pointerId || dead) return; off(); if (moved) foldEnd('drag'); h.done(moved); };
  const cc = (ev) => { if (ev.pointerId !== e.pointerId) return; dead = true; off(); if (moved) foldEnd('drag'); };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', cc);
}

/** Turn the bone above joint J so it points at the pointer. The top joint of a chain is moved instead. */
function poseDrag(e, J, move: boolean) {
  const f = S.f, P = !move && J.parent && lay(J.parent) && lay(J.parent).joint ? lay(J.parent) : null;
  if (P) {
    const pv = jointPt(P, f), jp = jointPt(J, f), a0 = Math.atan2(jp.y - pv.y, jp.x - pv.x), r0 = val(P.p.rot, f);
    drag(e, { move: (ev) => {
      const q = compPt(ev); let d = (Math.atan2(q[1] - pv.y, q[0] - pv.x) - a0) * 180 / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360;
      let r = r0 + d; if (shifted(ev)) r = Math.round(r / 15) * 15; // modifier: 15° steps
      setVal(P, 'rot', Math.round(r * 10) / 10); updateCanvas(); updateFields();
    }, done: (moved) => { if (moved) { commit('Pose rig'); renderAll(); } else select(J); } });
  } else {
    const [cx, cy] = compPt(e), x0 = val(J.p.x, f), y0 = val(J.p.y, f);
    drag(e, { move: (ev) => { const q = compPt(ev), [lx, ly] = toLocal(J, q[0] - cx, q[1] - cy); setVal(J, 'x', Math.round(x0 + lx)); setVal(J, 'y', Math.round(y0 + ly)); updateCanvas(); updateFields(); },
      done: (moved) => { if (moved) { commit(move ? 'Move joint' : 'Move rig'); renderAll(); } else select(J); } });
  }
}
function select(J) { if (S.sel !== J.id || S.multi.size) { S.sel = J.id; S.multi = new Set(); S.keys = []; renderAll(); } }

/** Pointer-down on the canvas. Returns true when the rig handled it. In the Select tool only a joint dot counts. */
export function rigDown(e): boolean {
  const rig = S.tool === 'rig', js = shown(); if (!js.length && !rig) return false;
  const v = vp.getBoundingClientRect(); let hit: any = null, best = HIT;
  for (const j of js) { const q = jointPt(j, S.f), [x, y] = toScreen(q.x, q.y), d = Math.hypot(x + v.left - e.clientX, y + v.top - e.clientY); if (d < best) { best = d; hit = j; } }
  if (hit) { if (rig && S.rigMode === 'attach') select(hit); else poseDrag(e, hit, rig && S.rigMode === 'joints'); return true; }
  if (!rig) return false;
  const [cx, cy] = compPt(e), g = e.target.closest && e.target.closest('g[data-id]'), L = g && lay(g.dataset.id);
  if (S.rigMode === 'joints') drag(e, { move: () => {}, done: (moved) => { if (!moved) addJoint(cx, cy); } });
  else if (S.rigMode === 'attach') {
    const j = lay(S.sel);
    drag(e, { move: () => {}, done: (moved) => { if (moved) return; if (!j || !j.joint) { toast('Tap a joint first, then tap the layer that should follow it.'); return; } if (!L) return; attachTo(L, j); } });
  } else panStart(e);
  return true;
}

/** Rubber hose tool: a tap places a default limb, a drag draws it from shoulder to hand. */
export function hoseDown(e, cx: number, cy: number) {
  drag(e, { move: (ev) => { const q = compPt(ev); preview = { a: [cx, cy], b: [q[0], q[1]] }; drawOverlay(); },
    done: (moved) => { const had = preview; preview = null; drawOverlay(); if (moved && had && Math.hypot(had.b[0] - cx, had.b[1] - cy) > 30) newHose([cx, cy], had.b); else newHose([cx - 200, cy], [cx + 200, cy]); } }, 6);
}
