import { PROPS } from '../model/schema';
import { lay, val } from '../anim/interpolate';
import { S, selIds } from './state';
import { setVal } from '../anim/keys';
import { clamp } from '../ui/graph';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';

/* ---------- v6 (ported from v5): selection, handles, motion path, text animators, timeline gestures ---------- */
export const targets = () => (S.pop && S.pop.id ? [S.pop.id] : selIds()).map(lay).filter(Boolean);
export function toggleMember(id, prev) {
  const set = new Set<string>(prev); set.has(id) ? set.delete(id) : set.add(id);
  S.multi = set; S.sel = set.has(id) ? id : ([...set][0] || null); S.keys = [];
  renderAll(); const n = selIds().length; toast(n > 1 ? `${n} layers selected` : n ? `${lay(S.sel).name} selected` : 'Selection cleared');
}
/** Moving the anchor point changes where the layer's artwork sits. Shift Position by the same amount so the artwork stays where it is. */
function holdInPlace(l, p: 'ax' | 'ay', d: number) {
  const sc = val(l.p.scale, S.f) / 100, r = val(l.p.rot, S.f) * Math.PI / 180;
  const sx = sc * (l.flipX ? -1 : 1), sy = sc * (l.flipY ? -1 : 1);
  const lx = p === 'ax' ? d * sx : 0, ly = p === 'ay' ? d * sy : 0;
  setVal(l, 'x', val(l.p.x, S.f) + lx * Math.cos(r) - ly * Math.sin(r));
  setVal(l, 'y', val(l.p.y, S.f) + lx * Math.sin(r) + ly * Math.cos(r));
}
// Apply a Transform edit to the primary layer; other selected layers get the same change as a delta.
export function applyProp(l, p, v) {
  const old = val(l.p[p], S.f); setVal(l, p, v);
  const anchor = p === 'ax' || p === 'ay';
  if (anchor) holdInPlace(l, p, v - old);
  if (l.id !== S.sel) return;
  const d = v - old; if (!d) return;
  selIds().filter((id) => id !== l.id).map(lay).forEach((o) => {
    if (!o || !o.p[p] || o.lock) return;
    const o0 = val(o.p[p], S.f); setVal(o, p, clamp(o0 + d, PROPS[p].min, PROPS[p].max));
    if (anchor) holdInPlace(o, p as 'ax' | 'ay', val(o.p[p], S.f) - o0);
  });
}
export function pip(pt, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
