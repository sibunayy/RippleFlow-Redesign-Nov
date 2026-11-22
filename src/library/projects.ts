// Saving and loading library projects: create, open, autosave, duplicate, delete, and project files for backup.
import { DUR, docSnapshot, layers, projName, replaceDoc, sampleDoc, setSaveHook } from '../model/project';
import { S } from '../state/state';
import { resetHistory } from '../state/history';
import { buildCanvas, layoutStage, placeSel, updateCanvas } from '../render/stage';
import { renderAll } from '../ui/layout';
import { renderDialog } from '../ui/dialog';
import { play } from '../playback/loop';
import { aud } from '../playback/audio';
import { rasterFrame } from '../export/raster';
import { toggleFbf } from '../drawing/workspace';
import { deleteProject as dbDelete, getDocJson, getMedia, getMeta, listMeta, mediaIds, putMedia, putMeta, putProject, type Meta } from './db';

const OPEN_KEY = 'rfp-open'; // this tab's open project, so a Safari tab reload returns to it
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const session = { get: () => { try { return sessionStorage.getItem(OPEN_KEY); } catch { return null; } }, set: (v: string | null) => { try { if (v) sessionStorage.setItem(OPEN_KEY, v); else sessionStorage.removeItem(OPEN_KEY); } catch { /* optional */ } } };
export const resumeId = () => session.get();

let cur: Meta | null = null, dirty = false, changed = false, timer: ReturnType<typeof setTimeout> | undefined, chain: Promise<unknown> = Promise.resolve();
export const currentId = () => cur?.id ?? null;
const status = (ok: boolean) => document.querySelector('.save')?.classList.toggle('off', !ok);
function queueSave() { dirty = true; changed = true; clearTimeout(timer); timer = setTimeout(flush, 500); }

/** Writes the open project now. Saves run one at a time, in order. */
export function flush() {
  clearTimeout(timer);
  if (!cur || !dirty) return chain;
  dirty = false;
  Object.assign(cur, { name: projName.trim() || 'Untitled', updated: Date.now(), dur: DUR, count: layers.length, f: Math.round(S.f) });
  const rec = { ...cur }, json = JSON.stringify(docSnapshot());
  chain = chain.then(() => putProject(rec, json)).then(() => status(true)).catch(() => { dirty = true; status(false); });
  return chain;
}
addEventListener('pagehide', () => { flush(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

async function makeThumb() {
  const f0 = S.f;
  try {
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    await rasterFrame(Math.round(f0), 480, 270, c.getContext('2d'), false);
    return c.toDataURL('image/jpeg', .82);
  } catch { return null; } finally { S.f = f0; updateCanvas(); }
}

/** The links made for the open project's stored files. They are freed when another project opens. */
let liveUrls: string[] = [];
/** Gives image and audio layers working links to their stored files. Returns how many files could not be found.
    A layer whose file is missing is kept (it shows nothing), so the next autosave does not delete it for good. */
async function hydrate(doc) {
  for (const k of Object.keys(aud)) { aud[k].pause(); delete aud[k]; }
  liveUrls.forEach((u) => URL.revokeObjectURL(u)); liveUrls = [];
  const urls: Record<string, string> = {};
  for (const id of mediaIds(doc)) { const b = await getMedia(id); if (b) liveUrls.push(urls[id] = URL.createObjectURL(b)); }
  let missing = 0;
  for (const l of doc.layers) {
    if (!l.mediaId) { if (String(l.src || '').startsWith('blob:')) { l.src = ''; missing++; } continue; } // a link from an earlier visit no longer works
    l.src = urls[l.mediaId] || '';
    if (!l.src) { missing++; continue; }
    if (l.type === 'audio') { const el = new Audio(l.src); el.preload = 'auto'; aud[l.id] = el; }
  }
  return missing;
}

function resetEditor(frame: number) {
  if (S.playing) play(false);
  if (S.fbf) toggleFbf();
  const sel = layers[0]?.id ?? null;
  Object.assign(S, { sel, keys: [], multi: new Set(), f: Math.max(0, Math.min(frame || 0, DUR - 1)), wa: [0, DUR], pop: null, dialog: null, zoom: 1, pan: [0, 0], open: new Set(sel ? [sel] : []), solo: new Set(), penPts: [], tool: 'select', selMode: 'select', tlPx: null, resetArm: false, shDraft: null, shImport: false });
  resetHistory(); buildCanvas(); renderAll(); renderDialog();
  requestAnimationFrame(() => { layoutStage(); placeSel(); });
}

export const listProjects = async () => (await listMeta()).sort((a, b) => b.updated - a.updated);

export async function openProject(id: string) {
  const m = await getMeta(id), json = await getDocJson(id);
  if (!m || !json) return false;
  const doc = JSON.parse(json), missing = await hydrate(doc);
  setSaveHook(null); replaceDoc(doc); cur = m; dirty = false; changed = false;
  resetEditor(m.f); setSaveHook(queueSave); session.set(id);
  return { missing };
}

/** Saves and leaves the open project. Returns false if it could not be saved, so the editor stays open. */
export async function closeProject() {
  if (S.playing) play(false);
  await flush();
  if (dirty) return false;
  if (cur && (changed || !cur.thumb)) { const t = await makeThumb(); if (t) { cur.thumb = t; await putMeta({ ...cur }).catch(() => {}); } }
  cur = null; setSaveHook(null); session.set(null);
  return true;
}

async function addProject(doc, f = 0, thumb: string | null = null) {
  const now = Date.now(), name = String(doc.name || '').trim() || 'Untitled';
  const m: Meta = { id: newId(), name, created: now, updated: now, dur: doc.dur || 150, count: doc.layers.length, f, thumb };
  await putProject(m, JSON.stringify({ ...doc, name }));
  try { navigator.storage?.persist?.(); } catch { /* optional: asks Safari to keep the library */ }
  return m;
}
export const createBlank = (name: string, dur = 150) => addProject({ layers: [], markers: [], dur, name, bg: null });
export const createSample = (name?: string, dur?: number) => { const d = sampleDoc(); if (name) d.name = name; if (dur) d.dur = dur; return addProject(d, 42); };

export async function nextUntitled() {
  const names = new Set((await listMeta()).map((m) => m.name));
  if (!names.has('Untitled')) return 'Untitled';
  for (let i = 2; ; i++) if (!names.has(`Untitled ${i}`)) return `Untitled ${i}`;
}

export async function renameProject(id: string, name: string) {
  const m = await getMeta(id), json = await getDocJson(id); if (!m || !json) return;
  m.name = name.trim() || 'Untitled';
  await putProject(m, JSON.stringify({ ...JSON.parse(json), name: m.name }));
}
export async function duplicateProject(id: string) {
  const m = await getMeta(id), json = await getDocJson(id); if (!m || !json) return;
  await addProject({ ...JSON.parse(json), name: `${m.name} copy` }, m.f, m.thumb ?? null);
}
export const deleteProject = (id: string) => dbDelete(id);

/** "Reset to demo project" from Settings, while a library project is open. */
export function resetOpenProject() {
  if (!cur) return false;
  replaceDoc(sampleDoc()); resetEditor(42); queueSave(); flush();
  return true;
}

/** First launch with the library: the project already saved on this device becomes its first card. */
export async function adoptSavedProject() {
  let done = false, had = false;
  try { done = !!localStorage.getItem('rfp-library'); had = !!localStorage.getItem('rfp-project'); } catch { return; }
  if (done) return;
  if (had && layers.length) {
    const m = await addProject(JSON.parse(JSON.stringify(docSnapshot())), Math.round(S.f));
    await new Promise((r) => requestAnimationFrame(r));
    const t = await makeThumb(); if (t) await putMeta({ ...m, thumb: t });
  }
  try { localStorage.setItem('rfp-library', '1'); } catch { /* it will try again next launch */ }
}

/* ---- project files (a backup that can leave this device) ---- */
const toData = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

export async function projectFile(id: string) {
  const m = await getMeta(id), json = await getDocJson(id); if (!m || !json) throw new Error('Project not found');
  const doc = JSON.parse(json), media: Record<string, string> = {};
  for (const k of mediaIds(doc)) { const b = await getMedia(k); if (b) media[k] = await toData(b); }
  const blob = new Blob([JSON.stringify({ app: 'RippleFlow', format: 1, doc, media, thumb: m.thumb || null, f: m.f })], { type: 'application/json' });
  return { blob, name: `${m.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled'}.ripple.json` };
}

function dataToBlob(url: string) {
  const comma = url.indexOf(','), bin = atob(url.slice(comma + 1)), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: url.slice(5, url.indexOf(';')) });
}

const DATA_URL =/^data:(image|audio)\/[a-z0-9.+-]+(;[a-z0-9=.-]+)*;base64,[a-z0-9+/=]+$/i;
const UNSAFE = /<\s*\/?\s*(script|img|svg|iframe|object|embed|style|link)\b|["']\s*on[a-z]+\s*=|javascript:/i;
/** A project file comes from outside the app, and some of its values end up in the page, so it is checked first. */
function safeValues(v: unknown, key = ''): boolean {
  if (typeof v === 'string') return key === 'src' ? !v || DATA_URL.test(v) || v.startsWith('blob:') : !UNSAFE.test(v);
  if (Array.isArray(v)) return v.every((x) => safeValues(x));
  if (v && typeof v === 'object') return Object.entries(v).every(([k, x]) => safeValues(x, k));
  return true;
}

/** Adds a project file to the library. Throws with a readable message if it is not one. */
export async function importProjectFile(file: File) {
  let data; try { data = JSON.parse(await file.text()); } catch { throw new Error('That file is not a RippleFlow project.'); }
  const doc = data?.doc;
  if (data?.app !== 'RippleFlow' || !doc || !Array.isArray(doc.layers)) throw new Error('That file is not a RippleFlow project.');
  if (data.format > 1) throw new Error('That project was made with a newer version of RippleFlow.');
  if (!safeValues(doc)) throw new Error('That project file contains content RippleFlow cannot open.');
  const media = data.media && typeof data.media === 'object' ? data.media : {};
  for (const [id, url] of Object.entries(media)) {
    if (!/^m[a-z0-9]+$/i.test(id) || typeof url !== 'string' || !DATA_URL.test(url)) throw new Error('That project file contains content RippleFlow cannot open.');
    await putMedia(id, dataToBlob(url));
  }
  const thumb = typeof data.thumb === 'string' && /^data:image\/(jpeg|png);base64,[a-z0-9+/=]+$/i.test(data.thumb) ? data.thumb : null;
  return addProject(doc, +data.f || 0, thumb);
}
