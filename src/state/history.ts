import { layers, saveProj, setLayers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from './state';
import { buildCanvas } from '../render/stage';
import { renderAll } from '../ui/layout';

export let hist = [JSON.stringify(layers)], hi = 0;
// Undo keeps the last HIST_MAX steps. Each step is a full copy of the project (drawings and images included), so an
// unlimited history grew memory until Safari reloaded the tab after a long session.
const HIST_MAX = 60;
export function commit(label) { hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(layers)); if (hist.length > HIST_MAX) hist = hist.slice(hist.length - HIST_MAX); hi = hist.length - 1; lastLabel = label; saveProj(); if (S.fbf) syncFbfUndo(); }
// The workspace's tool strip stays on screen while drawing, so its Undo and Redo must follow each change.
function syncFbfUndo() {
  const u = document.querySelector<HTMLButtonElement>('#lstrip [data-act="undo"]'), r = document.querySelector<HTMLButtonElement>('#lstrip [data-act="redo"]');
  if (u) u.disabled = hi <= 0;
  if (r) r.disabled = hi >= hist.length - 1;
}
export let lastLabel = '';
// The two- and three-finger tap gestures listen on the whole page, so they must do nothing while the library is showing.
const inLibrary = () => document.documentElement.classList.contains('lib-open');
export function undo() { if (inLibrary() || hi <= 0) return; hi--; setLayers(JSON.parse(hist[hi])); afterHist(); saveProj(); }
export function redo() { if (inLibrary() || hi >= hist.length - 1) return; hi++; setLayers(JSON.parse(hist[hi])); afterHist(); saveProj(); }
/** A newly opened project starts with its own undo history. */
export function resetHistory() { hist = [JSON.stringify(layers)]; hi = 0; lastLabel = ''; }
function afterHist() { if (S.sel && !lay(S.sel)) S.sel = null; S.keys = S.keys.filter((k) => lay(k.l)); buildCanvas(); renderAll(); }
export function setLastLabel(v) { return (lastLabel = v); }
