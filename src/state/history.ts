import { layers, saveProj, setLayers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from './state';
import { buildCanvas } from '../render/stage';
import { renderAll } from '../ui/layout';
import { PF } from '../ui/prefs';

/* Big pictures (baked images, drawn cels, imported images) are data URLs of several megabytes. Undo steps keep each one
   once, in this table, and hold a short token in its place. Without it, every step held its own copy of every picture. */
const media = new Map<string, string>(), mediaIds = new Map<string, string>();
let nextMedia = 0, sincePrune = 0;
const TOK = '\uE000', TOKS = /"\uE000(\d+)"/g, BIG = 4096;
function token(x: string) { let id = mediaIds.get(x); if (id === undefined) { id = String(nextMedia++); mediaIds.set(x, id); media.set(id, x); } return TOK + id; }
const pack = (v) => JSON.stringify(v, (_k, x) => typeof x === 'string' && x.length > BIG && x.startsWith('data:') ? token(x) : x);
const unpack = (s: string) => JSON.parse(s, (_k, x) => typeof x === 'string' && x.charCodeAt(0) === 0xE000 && media.has(x.slice(1)) ? media.get(x.slice(1)) : x);
/** The full project text of an undo step (tokens replaced by their pictures), for saving. */
const expand = (s: string) => s.replace(TOKS, (_m, id) => JSON.stringify(media.get(id) ?? ''));
/** Forgets pictures that no undo step uses any more. */
function prune() {
  const live = new Set<string>();
  for (const h of hist) for (const m of h.matchAll(TOKS)) live.add(m[1]);
  for (const [id, x] of media) if (!live.has(id)) { media.delete(id); mediaIds.delete(x); }
}

export let hist = [pack(layers)], hi = 0;
// Undo keeps the last HIST_MAX steps. Each step is a copy of the project (big pictures are shared, see above), so an
// unlimited history grew memory until Safari reloaded the tab after a long session.
// The limit is a Customise setting (60 by default).
export function commit(label) {
  const HIST_MAX = PF.undo, snap = pack(layers);
  hist = hist.slice(0, hi + 1); hist.push(snap); if (hist.length > HIST_MAX) hist = hist.slice(hist.length - HIST_MAX); hi = hist.length - 1;
  if (++sincePrune >= 10) { sincePrune = 0; prune(); }
  lastLabel = label; saveProj(() => expand(snap)); if (S.fbf) syncFbfUndo();
}
/** Replaces the newest undo step with the project as it is now (a shape drawn out by dragging is one step, not two). */
export function amendTop(label: string) { hist[hi] = pack(layers); lastLabel = label; saveProj(() => expand(hist[hi])); }
// The workspace's tool strip stays on screen while drawing, so its Undo and Redo must follow each change.
function syncFbfUndo() {
  const u = document.querySelector<HTMLButtonElement>('#lstrip [data-act="undo"]'), r = document.querySelector<HTMLButtonElement>('#lstrip [data-act="redo"]');
  if (u) u.disabled = hi <= 0;
  if (r) r.disabled = hi >= hist.length - 1;
}
export let lastLabel = '';
// The two- and three-finger tap gestures listen on the whole page, so they must do nothing while the library is showing.
const inLibrary = () => document.documentElement.classList.contains('lib-open');
/** Lets a tool in the middle of something (the pen drawing a path) take undo and redo first. Return true if handled. */
export const undoGuard: { undo: null | (() => boolean); redo: null | (() => boolean) } = { undo: null, redo: null };
export function undo() { if (inLibrary() || undoGuard.undo?.() || hi <= 0) return; hi--; setLayers(unpack(hist[hi])); afterHist(); saveProj(); }
export function redo() { if (inLibrary() || undoGuard.redo?.() || hi >= hist.length - 1) return; hi++; setLayers(unpack(hist[hi])); afterHist(); saveProj(); }
/** A newly opened project starts with its own undo history. */
export function resetHistory() { media.clear(); mediaIds.clear(); sincePrune = 0; hist = [pack(layers)]; hi = 0; lastLabel = ''; }
function afterHist() { if (S.sel && !lay(S.sel)) S.sel = null; S.keys = S.keys.filter((k) => lay(k.l)); buildCanvas(); renderAll(); }
