import { CW, CH } from '../model/project';
import { $ } from '../core/dom';
import { animated, lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { anchorAt, stage, vp } from '../render/stage';
import { tc } from '../ui/inspector/controls';
import { areaSvg } from '../gestures/area-select';
import { peOverlay, penOverlay } from '../gestures/path-edit';
import { rigOverlay } from '../gestures/rig';

// The overlay is redrawn on every playback frame, but its content rarely changes. Unchanged content is not written again.
let lastView = '', lastHtml = '';
export function drawOverlay() {
  const svg = $('#ovl'); if (!svg) return;
  const v = vp.getBoundingClientRect(), vb = `0 0 ${v.width} ${v.height}`;
  if (vb !== lastView) { svg.setAttribute('viewBox', vb); lastView = vb; }
  let out = '';
  const l = S.sel && lay(S.sel);
  if (l && l.vis && !S.playing && selIds().length === 1 && (animated(l.p.x) || animated(l.p.y))) {
    const sr = stage.getBoundingClientRect(), X = (x) => sr.left - v.left + x / CW * sr.width, Y = (y) => sr.top - v.top + y / CH * sr.height;
    const ts = [...new Set(['x', 'y'].flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : []))].sort((a, b) => a - b);
    if (ts.length > 1) { let d = ''; for (let f = ts[0]; f <= ts[ts.length - 1]; f++) { const q = anchorAt(l, f); d += (f === ts[0] ? 'M' : 'L') + X(q.x).toFixed(1) + ' ' + Y(q.y).toFixed(1); } out += `<path class="mp" d="${d}"/>`; }
    ts.forEach((t) => { const q = anchorAt(l, t), cx = X(q.x).toFixed(1), cy = Y(q.y).toFixed(1); out += `<circle class="mpd ${Math.abs(t - S.f) < .5 ? 'on' : ''}" cx="${cx}" cy="${cy}" r="6"/><circle data-mp="${t}" cx="${cx}" cy="${cy}" r="18" fill="transparent"><title>Position keyframe at ${tc(t)} · drag to move, hold to ease</title></circle>`; });
  }
  out += penOverlay(v) + peOverlay(v) + rigOverlay();
  const html = out + areaSvg;
  if (html !== lastHtml) { svg.innerHTML = html; lastHtml = html; }
}
