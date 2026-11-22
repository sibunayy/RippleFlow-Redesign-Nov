import { an, st } from './schema';
import type { Layer, Marker } from './types';

/** Composition size in pixels and frame rate. They are saved with the project. */
export let CW = 1920, CH = 1080, FPS = 30; export let DUR = 150; export let projName = 'Logo sting'; export let compBg: string | null = null;
export const HUES = ['#4aa8ff', '#bfe3f5', '#4fd1c5', '#ef6f7f', '#b9d65a', '#7f9bd6'];
export let layers: Layer[] = [
  { id: 'tag', name: 'motion made simple', type: 'text', hue: HUES[1], text: 'motion made simple', size: 64, weight: 500, track: 6, vis: true, lock: false, fx: [],
    p: { x: st(960), y: an([62, 760, 'out'], [86, 718]), scale: st(100), rot: st(0), op: an([62, 0, 'out'], [82, 100]) } },
  { id: 'logo', name: 'YOUR LOGO', type: 'text', hue: HUES[0], text: 'YOUR LOGO', size: 150, weight: 800, track: -2, vis: true, lock: false, fx: [{ id: 'glow', name: 'Glow', on: true, radius: 18, amount: 70 }],
    p: { x: st(960), y: st(600), scale: an([30, 70, 'back'], [54, 100]), rot: st(0), op: an([30, 0, 'out'], [44, 100]) } },
  { id: 'core', name: 'Core', type: 'ellipse', hue: HUES[3], r: 64, vis: true, lock: false, fx: [],
    p: { x: st(960), y: st(330), scale: an([8, 0, 'back'], [28, 100]), rot: st(0), op: st(100) } },
  { id: 'ring', name: 'Ring', type: 'ring', hue: HUES[2], r: 128, vis: true, lock: false, fx: [],
    p: { x: st(960), y: st(330), scale: an([0, 40, 'out'], [30, 100]), rot: an([0, -120, 'inout'], [60, 0]), op: an([0, 0], [12, 100]) } },
];
layers.forEach((l) => { l.p.ax = l.p.ax || st(0); l.p.ay = l.p.ay || st(0); l.p.ts = l.p.ts || st(0); l.p.te = l.p.te || st(l.type === 'ring' ? 70 : 100); });
export const markers: Marker[] = [{ f: 30, name: 'Logo hit' }, { f: 86, name: 'Tagline' }];
const SAMPLE = JSON.stringify({ layers, markers, dur: 150, name: 'Logo sting', bg: null });
/** A fresh copy of the demo project, for the library's sample and "Reset to demo project". */
export const sampleDoc = () => JSON.parse(SAMPLE);
try {
  const pj = JSON.parse(localStorage.getItem('rfp-project') || 'null');
  if (pj && Array.isArray(pj.layers) && pj.layers.length) {
    layers = pj.layers.filter((l) => !(l.src && String(l.src).startsWith('blob:')));
    markers.splice(0, markers.length, ...(pj.markers || []));
    DUR = pj.dur || 150; if (pj.name) projName = pj.name; if (pj.bg) compBg = pj.bg;
    CW = pj.w || 1920; CH = pj.h || 1080; FPS = pj.fps || 30;
  }
} catch { /* no saved project */ }
/** Set while a library project is open: the library saves it and owns the "Autosaved" status. */
let saveHook: (() => void) | null = null;
export function setSaveHook(fn: (() => void) | null) { saveHook = fn; }
/** Saves the project. While a library project is open the library saves it (to IndexedDB, after a short pause), so the
   copy in localStorage is not written: it doubled the work on each edit and big pictures ran it out of space.
   `layersJson` gives the layers already turned into text (the undo step), so a commit does not stringify them twice. */
export function saveProj(layersJson?: () => string) {
  if (saveHook) { saveHook(); return; }
  let ok = true;
  try {
    const rest = JSON.stringify({ markers, dur: DUR, name: projName, bg: compBg, w: CW, h: CH, fps: FPS });
    localStorage.setItem('rfp-project', layersJson ? `{"layers":${layersJson()},${rest.slice(1)}` : JSON.stringify({ layers, markers, dur: DUR, name: projName, bg: compBg, w: CW, h: CH, fps: FPS }));
  } catch { ok = false; }
  const sv = document.querySelector('.save'); if (sv) sv.classList.toggle('off', !ok);
}
export const docSnapshot = () => ({ layers, markers, dur: DUR, name: projName, bg: compBg, w: CW, h: CH, fps: FPS });
/** Swaps the whole document (opening a project from the library). */
export function replaceDoc(d) { layers = d.layers || []; markers.splice(0, markers.length, ...(d.markers || [])); DUR = d.dur || 150; projName = d.name || 'Untitled'; compBg = d.bg || null; CW = d.w || 1920; CH = d.h || 1080; FPS = d.fps || 30; }
export function setLayers(v) { return (layers = v); }
export function setCompBg(v) { return (compBg = v); }
export function setComp(w: number, h: number) { CW = w; CH = h; }
export function setFPS(v: number) { return (FPS = v); }
export function setDUR(v) { return (DUR = v); }
export function setProjName(v) { return (projName = v); }
