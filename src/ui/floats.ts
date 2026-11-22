import { $ } from '../core/dom';
import { ic } from './icons';
import { TF } from '../model/schema';
import { animated, lay } from '../anim/interpolate';
import { S, isDrawTool, selIds } from '../state/state';
import { EDITABLE, shapePts } from '../gestures/path-edit';
import { layoutStage } from '../render/stage';
import { renderBrushBar } from '../drawing/brush-bar';
import { setFitSelOn, setSuppressClick } from '../events/delegate';

export function renderFloats() {
  // Zoom is the percentage pill alone: drag it to zoom, tap it to fit (Nathan, Nov 2026: no + / − buttons).
  $('#zoom').innerHTML = `<button class="pct tc" data-act="fit" aria-label="Zoom level. Drag left or right to zoom. Tap to fit the selection, tap again to fit the workspace" title="Drag to zoom · tap to fit selection / workspace">100%</button><span class="vsep"></span>
    <button class="ib ${S.snap ? 'on' : ''}" data-act="snap" aria-pressed="${S.snap}" aria-label="Snap" title="Snap">${ic('magnet', 's')}</button>`;
  const ql = S.sel && lay(S.sel), hasKeys = !!(ql && TF.some((p) => animated(ql.p[p])));
  $('#qbar').innerHTML = `<button class="qb" data-act="keyall">${ic('key', 's')}Keyframe</button>
    <button class="qb" data-act="qease" ${hasKeys ? '' : 'disabled'}>${ic('easing', 's')}Easing</button>
    <button class="qb" data-act="align" aria-haspopup="dialog">${ic('alC', 's')}Align</button>
    ${ql && EDITABLE.includes(ql.type) && selIds().length === 1 ? `<button class="qb" data-act="peedit">${ic('pen', 's')}Edit points</button>` : ''}
    <button class="qb" data-act="dup">${ic('copy', 's')}Duplicate</button>
    <button class="qb" data-act="group">${ic('group', 's')}Pre-compose</button>
    <button class="qb" data-act="del">${ic('trash', 's')}Delete</button>`;
  if (S.tool === 'pen' && S.penPts.length) $('#qbar').innerHTML = `<button class="qb" data-act="pendone">${ic('key', 's')}Done</button><button class="qb" data-act="penclose" ${S.penPts.length > 2 ? '' : 'disabled'}>Close path</button><button class="qb" data-act="penundo">Undo point</button><button class="qb" data-act="pencancel">${ic('trash', 's')}Cancel</button>`;
  const pe = S.pe && S.tool === 'select' ? lay(S.pe) : null;
  if (pe) { const pt: any = shapePts(pe)[S.peI], curved = !!pt && pt.length > 2 && (pt[2] || pt[3] || pt[4] || pt[5]), hasPt = S.peI >= 0, closed = pe.type === 'path' ? !!pe.closed : pe.type !== 'line'; $('#qbar').innerHTML = `<button class="qb" data-act="pedone">${ic('key', 's')}Done</button><button class="qb" data-act="petype" ${hasPt ? '' : 'disabled'}>${curved ? 'Make corner' : 'Make curve'}</button><button class="qb" data-act="peclose">${closed ? 'Open path' : 'Close path'}</button><button class="qb" data-act="pedel" ${hasPt ? '' : 'disabled'}>${ic('trash', 's')}Delete point</button>`; }
  renderBrushBar();
  const hint = $('#toolhint');
  const msg = S.eyedrop ? 'Tap a layer to pick its colour' : pe ? 'Drag points or handles · drag a line to bend it · tap a line to add a point · double-tap a point for corner or curve' : isDrawTool(S.tool) ? null : { marquee: 'Drag a box to select layers · hold a layer to add or remove it', lasso: 'Draw around layers to select them', hand: 'Drag to pan · pinch to zoom', pen: 'Tap for a corner · drag for a curve · tap the first point to close', text: 'Tap the canvas to place text', rect: 'Tap to place a rectangle, or drag to size it', ellipse: 'Tap to place an ellipse, or drag out from the centre', polygon: 'Tap to place a polygon, or drag out from the centre', star: 'Tap to place a star, or drag out from the centre', line: 'Tap to place a line, or drag to draw it' }[S.tool];
  hint.hidden = !msg; if (msg) hint.textContent = msg;
  layoutStage();
}
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  /* ---------- render: viewport floats ---------- */
  /* Zoom number doubles as a scrubber: drag left/right to change zoom, tap to fit. */
  $('#zoom').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.pct'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const x0 = e.clientX, z0 = Math.log(S.zoom); let moved = false;
    const mv = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true; b.classList.add('drag');
      S.zoom = Math.max(.25, Math.min(6, Math.exp(z0 + dx * 0.012))); setFitSelOn(false); layoutStage();
    };
    const up = () => {
      b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
      b.classList.remove('drag');
      if (moved) setSuppressClick(true);
    };
    b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
}
