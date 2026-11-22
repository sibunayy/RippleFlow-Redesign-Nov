import { $, app } from '../core/dom';
import { S } from '../state/state';
import { layoutStage, stage, vp } from '../render/stage';
import { PF } from './prefs';

/* ---------- auto-fold ---------- */
// The left panel folds while the user drags on the canvas, and both fold during playback. During a drag the right panel
// stays open until it covers 60% of what is being dragged. The stage is frozen in screen space so the artwork never
// shifts under the finger; afterwards the frozen rect becomes zoom/pan.
export let frozen = null, foldBy = null, unfoldTimer = 0;
type FoldTarget = 'sel' | 'stage' | 'pointer';
// The limit is a Customise setting (60% by default). Showing again 10 points lower stops the panel flickering when a drag rests right on it.
const hideAt = () => PF.hideAt / 100, showBelow = () => hideAt() - .1;
let target: FoldTarget = 'sel', pointer: [number, number] | null = null, watchFrame = 0;
const trackPointer = (e: PointerEvent) => { pointer = [e.clientX, e.clientY]; };

function unfreeze() {
  if (!frozen) return;
  const r = stage.getBoundingClientRect(), v = vp.getBoundingClientRect();
  const fit = Math.min((v.width - 56) / 1920, (v.height - 56) / 1080);
  S.zoom = r.width / 1920 / fit;
  S.pan = [r.left - v.left - (v.width - r.width) / 2, r.top - v.top - (v.height - r.height) / 2];
  frozen = null; layoutStage();
}
/** The screen area of what is being dragged. A brush or pen is a point, so it counts as covered once it is over the panel. */
function dragRect() {
  const box = $('#selbox');
  if (target === 'stage') return stage.getBoundingClientRect();
  if (target === 'sel' && !box.hidden) return box.getBoundingClientRect();
  return pointer ? { left: pointer[0] - .5, right: pointer[0] + .5, top: pointer[1] - .5, bottom: pointer[1] + .5, width: 1, height: 1 } : null;
}
/** How much of the dragged area (0 to 1) sits under the right panel in its open position. */
function rightPanelCover() {
  const inner = $('.panel.r > .inner'), a = app.getBoundingClientRect(), v = vp.getBoundingClientRect(), r = dragRect();
  if (!inner || !r || r.width <= 0 || r.height <= 0) return 0;
  const left = a.right - 48 - inner.offsetWidth; // measured from the app so it stays correct while the panel is folded
  const w = Math.max(0, Math.min(r.right, a.right - 48) - Math.max(r.left, left)), h = Math.max(0, Math.min(r.bottom, v.bottom) - Math.max(r.top, v.top));
  return w * h / (r.width * r.height);
}
function watchRightPanel() {
  if (foldBy !== 'drag') return;
  const cover = rightPanelCover(), folded = app.classList.contains('fold-right');
  if (!folded && cover >= hideAt()) app.classList.add('fold-right');
  else if (folded && cover < showBelow()) app.classList.remove('fold-right');
  watchFrame = requestAnimationFrame(watchRightPanel);
}
export function foldStart(kind, dragging: FoldTarget = 'sel') {
  if (!S.autoFold || foldBy || app.classList.contains('portrait') || !(S.left || S.right)) return;
  clearTimeout(unfoldTimer);
  if (kind === 'drag') { const r = stage.getBoundingClientRect(); frozen = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, pan: [...S.pan], zoom: S.zoom }; }
  else unfreeze();
  foldBy = kind; app.classList.add('folding');
  if (kind !== 'drag') { app.classList.add('fold-right'); return; }
  target = dragging; pointer = null;
  if (S.right) { addEventListener('pointermove', trackPointer, true); watchFrame = requestAnimationFrame(watchRightPanel); }
}
export function foldEnd(kind) {
  if (foldBy !== kind) return;
  foldBy = null; app.classList.remove('folding', 'fold-right');
  cancelAnimationFrame(watchFrame); removeEventListener('pointermove', trackPointer, true);
  if (frozen) unfoldTimer = setTimeout(unfreeze, 260);
}
