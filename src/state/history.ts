import { layers, saveProj, setLayers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from './state';
import { buildCanvas } from '../render/stage';
import { renderAll } from '../ui/layout';

export let hist = [JSON.stringify(layers)], hi = 0;
// Undo keeps the last HIST_MAX steps. Each step is a full copy of the project (drawings and images included), so an
// unlimited history grew memory until Safari reloaded the tab after a long session.
const HIST_MAX = 60;
export function commit(label) { hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(layers)); if (hist.length > HIST_MAX) hist = hist.slice(hist.length - HIST_MAX); hi = hist.length - 1; lastLabel = label; saveProj(); }
export let lastLabel = '';
export function undo() { if (hi <= 0) return; hi--; setLayers(JSON.parse(hist[hi])); afterHist(); }
export function redo() { if (hi >= hist.length - 1) return; hi++; setLayers(JSON.parse(hist[hi])); afterHist(); }
function afterHist() { if (S.sel && !lay(S.sel)) S.sel = null; S.keys = S.keys.filter((k) => lay(k.l)); buildCanvas(); renderAll(); }
export function setLastLabel(v) { return (lastLabel = v); }
