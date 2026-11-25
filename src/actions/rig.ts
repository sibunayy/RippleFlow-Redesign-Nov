import { HUES, layers, CW, CH } from '../model/project';
import { st } from '../model/schema';
import { lay } from '../anim/interpolate';
import { parentRef } from '../anim/pose';
import { S } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas } from '../render/stage';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';
import { nameCount } from './layers';

/* ---------- rigs ----------
   A joint is a Null layer with joint: true. A bone is the link from a joint to the joint that is its parent.
   Turning a joint turns everything below it (the joints and the layers parented to it), so a rig animates with the normal rotation keyframes.
   A rubber hose is a layer that draws a smooth tube through a chain of joints. */
const newId = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const base = (type: string, name: string, x: number, y: number, hue: string) => ({ id: newId(), name, type, hue, vis: true, lock: false, fx: [] as any[],
  p: { x: st(x), y: st(y), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) } });
const makeJoint = (name: string, x: number, y: number): any => ({ ...base('null', name, x, y, '#ffb020'), joint: true });
const link = (child: any, parent: any) => { child.parent = parent.id; child.pt = Math.round(S.f); child.pw = parentRef(parent, child.pt); };

export const isJoint = (l) => !!(l && l.joint);
/** The joints connected to a layer: the joints of a hose, or the whole chain a joint belongs to. */
export function rigSet(l): any[] {
  if (!l) return [];
  if (l.type === 'hose') return (l.joints || []).map((id) => lay(id)).filter(Boolean);
  if (!l.joint) return [];
  let root = l; for (let d = 0; d < 20 && root.parent && lay(root.parent) && lay(root.parent).joint; d++) root = lay(root.parent);
  const out = [root]; for (let i = 0; i < out.length && out.length < 200; i++) layers.forEach((c) => { if (c.joint && c.parent === out[i].id && !out.includes(c)) out.push(c); });
  return out;
}

/** A pre-rigged limb: shoulder, elbow and hand joints, and a hose drawn through them. Drag the hand to bend it. */
export function newHose(a: number[], c: number[]) {
  nameCount.hose = (nameCount.hose || 0) + 1;
  const name = `Hose ${nameCount.hose}`, len = Math.max(60, Math.hypot(c[0] - a[0], c[1] - a[1])), nx = -(c[1] - a[1]) / len, ny = (c[0] - a[0]) / len;
  const mid = [(a[0] + c[0]) / 2 + nx * len * .14, (a[1] + c[1]) / 2 + ny * len * .14];
  const j1 = makeJoint(`${name} shoulder`, Math.round(a[0]), Math.round(a[1])), j2 = makeJoint(`${name} elbow`, Math.round(mid[0]), Math.round(mid[1])), j3 = makeJoint(`${name} hand`, Math.round(c[0]), Math.round(c[1]));
  const hose: any = { ...base('hose', name, CW / 2, CH / 2, HUES[(layers.length + 2) % HUES.length]), joints: [j1.id, j2.id, j3.id], w: Math.round(Math.max(24, Math.min(90, len * .16))), sw: 6, sc: '#1b1410' };
  layers.unshift(hose, j1, j2, j3);
  link(j2, j1); link(j3, j2);
  S.sel = hose.id; S.multi = new Set(); S.keys = []; S.tool = 'select';
  commit('Add rubber hose'); buildCanvas(); renderAll(); toast(`Added ${name}. Drag a joint to pose it.`, true);
}
/** Rig tool, Joints mode: a joint at this point. It becomes a child of the selected joint, so a run of taps draws a chain. */
export function addJoint(x: number, y: number) {
  nameCount.joint = (nameCount.joint || 0) + 1;
  const par = lay(S.sel), j = makeJoint(`Joint ${nameCount.joint}`, Math.round(x), Math.round(y));
  const at = par && par.joint ? layers.indexOf(par) : -1;
  layers.splice(at >= 0 ? at : 0, 0, j); // a child sits just above its parent in the list
  if (par && par.joint) link(j, par);
  S.sel = j.id; S.multi = new Set(); S.keys = [];
  commit('Add joint'); buildCanvas(); renderAll();
}
/** Rig tool, Attach mode: the layer follows the joint. Attaching a layer that already follows it lets it go. */
export function attachTo(l, j) {
  if (!l || !j || l === j || l.joint) return;
  if (l.parent === j.id) { delete l.parent; delete l.pt; delete l.pw; commit('Detach from joint'); renderAll(); toast(`${l.name} detached`); return; }
  link(l, j); commit('Attach to joint'); buildCanvas(); renderAll(); toast(`${l.name} now follows ${j.name}`);
}
