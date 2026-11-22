// The library: RippleFlow's landing page. It sits over the editor and uses the app's own tokens and components.
import { $, app, esc, root } from '../core/dom';
import { FPS } from '../model/project';
import { ic } from '../ui/icons';
import { toast as editorToast } from '../ui/toast';
import { saveFile } from '../host/save-file';
import type { Meta } from './db';
import { adoptSavedProject, closeProject, createBlank, createSample, deleteProject, duplicateProject, importProjectFile, listProjects, nextUntitled, openProject, projectFile, renameProject, resumeId } from './projects';

const el = $('#library');
const ui: { list: Meta[]; q: string; menu: null | { id: string; x: number; y: number; arm: boolean }; dialog: null | { type: 'new' | 'rename'; id?: string; name: string; dur: number; start: 'blank' | 'sample' }; note: string } = { list: [], q: '', menu: null, dialog: null, note: '' };
let available = true, busy = false, noteTimer: ReturnType<typeof setTimeout> | undefined;

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `Edited ${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return `Edited ${d} day${d > 1 ? 's' : ''} ago`; }
  return 'Edited ' + new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const secs = (d: number) => `${Math.round(d / FPS * 10) / 10} s`;

function card(m: Meta) {
  const thumb = m.thumb && m.thumb.startsWith('data:image/') ? `<img src="${esc(m.thumb)}" alt="">` : `<span class="lib-empty-thumb">${ic('rect')}</span>`;
  return `<article class="lib-card">
    <button class="lib-card-open" data-lib="open" data-id="${esc(m.id)}" aria-label="Open ${esc(m.name)}">
      <span class="lib-thumb">${thumb}<span class="lib-dur tc">${secs(m.dur)}</span></span>
      <span class="lib-cap"><b>${esc(m.name)}</b><small>${ago(m.updated)}</small></span>
    </button>
    <button class="ib lib-more" data-lib="menu" data-id="${esc(m.id)}" aria-label="More for ${esc(m.name)}" aria-haspopup="menu" aria-expanded="${ui.menu?.id === m.id}">${ic('more')}</button>
  </article>`;
}

function gridHtml() {
  const q = ui.q.trim().toLowerCase(), shown = q ? ui.list.filter((m) => m.name.toLowerCase().includes(q)) : ui.list;
  if (q && !shown.length) return `<p class="lib-none">No projects match “${esc(ui.q.trim())}”.</p>`;
  const blank = q ? '' : `<article class="lib-card"><button class="lib-card-open" data-lib="blank" aria-label="Create a blank project">
      <span class="lib-thumb lib-new">${ic('plus')}</span><span class="lib-cap"><b>Blank project</b><small>1920 × 1080 · 30 fps</small></span></button></article>`;
  const sample = ui.list.length ? '' : `<article class="lib-card"><button class="lib-card-open" data-lib="sample" aria-label="Open the sample project">
      <span class="lib-thumb lib-new">${ic('play')}</span><span class="lib-cap"><b>Sample project</b><small>A short logo animation</small></span></button></article>`;
  return `<div class="lib-grid">${blank}${sample}${shown.map(card).join('')}</div>`;
}

function dialogHtml() {
  const d = ui.dialog; if (!d) return '';
  const isNew = d.type === 'new';
  return `<div class="dlg-scrim" data-lib="scrim"><form class="dlg" role="dialog" aria-modal="true" aria-label="${isNew ? 'New project' : 'Rename project'}">
    <h2>${isNew ? 'New project' : 'Rename project'}</h2>
    <label class="lib-field"><span>Name</span><input id="lib-name" value="${esc(d.name)}" maxlength="80" placeholder="Untitled" autocomplete="off"></label>
    ${isNew ? `<div class="lib-field"><span>Length</span><div class="seg" role="group" aria-label="Length">${[3, 5, 10, 15].map((s) => `<button type="button" data-lib="dur" data-v="${s}" aria-pressed="${d.dur === s * FPS}">${s} s</button>`).join('')}</div></div>
    <div class="lib-field"><span>Start from</span><div class="seg" role="group" aria-label="Start from"><button type="button" data-lib="start" data-v="blank" aria-pressed="${d.start === 'blank'}">Blank</button><button type="button" data-lib="start" data-v="sample" aria-pressed="${d.start === 'sample'}">Sample</button></div></div>
    <div class="kv"><span>Size</span><b class="tc">1920 × 1080 · 30 fps</b></div>` : ''}
    <div class="foot"><button type="button" class="line-btn" data-lib="cancel">Cancel</button><button class="primary">${isNew ? 'Create' : 'Rename'}</button></div>
  </form></div>`;
}

function menuHtml() {
  const m = ui.menu; if (!m) return '';
  const x = Math.max(8, Math.min(innerWidth - 216, m.x - 200)), y = Math.max(8, Math.min(innerHeight - 236, m.y));
  return `<div class="pop menu lib-menu" role="menu" style="left:${x}px;top:${y}px">
    <button class="mi" role="menuitem" data-lib="m-open">Open</button>
    <button class="mi" role="menuitem" data-lib="m-rename">Rename</button>
    <button class="mi" role="menuitem" data-lib="m-dup">Duplicate</button>
    <button class="mi" role="menuitem" data-lib="m-file">Save a copy to Files</button>
    <div class="mhr"></div>
    <button class="mi danger" role="menuitem" data-lib="m-del">${m.arm ? 'Tap again to delete' : 'Delete'}</button>
  </div>`;
}

function render() {
  const prev = $('.lib-scroll', el)?.scrollTop || 0;
  el.innerHTML = `<header class="lib-top">
      <h1><img src="${import.meta.env.BASE_URL}icon.svg" alt="" width="24" height="24">RippleFlow</h1>
      <label class="search lib-search">${ic('search', 's')}<input id="lib-q" type="search" value="${esc(ui.q)}" placeholder="Search projects" aria-label="Search projects" autocomplete="off"></label>
      <label class="line-btn lib-import">Import<input type="file" id="lib-file" aria-label="Import a project file"></label>
      <button class="primary" data-lib="new">${ic('plus', 's')}New project</button>
    </header>
    <main class="lib-scroll"><div class="lib-wrap">
      <div class="lib-head"><h2>Projects</h2><span class="tc">${ui.list.length}</span></div>
      <div id="lib-grid">${gridHtml()}</div>
      <p class="lib-foot">Projects save automatically on this device. Use “Save a copy to Files” to back one up.</p>
    </div></main>
    ${menuHtml()}${dialogHtml()}
    ${ui.note ? `<div class="toast lib-toast" role="status"><span>${esc(ui.note)}</span></div>` : ''}`;
  const s = $('.lib-scroll', el); if (s) s.scrollTop = prev;
}

function note(text: string) { ui.note = text; clearTimeout(noteTimer); noteTimer = setTimeout(() => { ui.note = ''; $('.lib-toast', el)?.remove(); }, 3600); render(); }
async function refresh() { ui.list = await listProjects(); render(); }

function setOpen(open: boolean) {
  root.classList.toggle('lib-open', open); el.hidden = !open;
  (app as HTMLElement & { inert: boolean }).inert = open;
}

async function enter(id: string) {
  if (busy) return; busy = true;
  try {
    if (await openProject(id)) { ui.menu = null; ui.dialog = null; setOpen(false); } else { await refresh(); note('That project could not be found.'); }
  } catch { note('That project could not be opened.'); } finally { busy = false; }
}

/** The editor's "Library" button. */
export async function showLibrary() {
  if (!available) { editorToast('The library needs device storage, which is not available here.'); return; }
  if (busy) return; busy = true;
  try {
    if (!(await closeProject())) { editorToast('Could not save this project, so it is staying open.'); return; }
    ui.q = ''; ui.menu = null; ui.dialog = null; await refresh(); setOpen(true); $('.lib-scroll', el)?.scrollTo(0, 0);
  } catch { editorToast('Could not open the library.'); } finally { busy = false; }
}

/** Runs at launch. `?editor` skips the landing page for the automated tests. */
export async function bootLibrary() {
  if (new URLSearchParams(location.search).has('editor')) return;
  setOpen(true); render();
  try {
    await adoptSavedProject();
    const again = resumeId();
    if (again && await openProject(again)) { setOpen(false); return; }
    await refresh();
  } catch { available = false; setOpen(false); } // no storage here (private host): fall back to the plain editor
}

async function act(name: string, t: HTMLElement, e: Event) {
  const id = t.dataset.id || ui.menu?.id;
  switch (name) {
    case 'open': return enter(t.dataset.id!);
    case 'blank': { const m = await createBlank(await nextUntitled()); return enter(m.id); }
    case 'sample': { const m = await createSample(); return enter(m.id); }
    case 'new': ui.menu = null; ui.dialog = { type: 'new', name: '', dur: 150, start: 'blank' }; return render();
    case 'menu': { if (ui.menu?.id === id) { ui.menu = null; return render(); } const r = t.getBoundingClientRect(); ui.menu = { id: id!, x: r.right, y: r.bottom + 4, arm: false }; return render(); }
    case 'dur': keepName(); ui.dialog!.dur = +t.dataset.v! * FPS; return render();
    case 'start': keepName(); ui.dialog!.start = t.dataset.v as 'blank' | 'sample'; return render();
    case 'cancel': ui.dialog = null; return render();
    case 'scrim': if (e.target === t) { ui.dialog = null; render(); } return;
    case 'm-open': return enter(id!);
    case 'm-rename': { const m = ui.list.find((x) => x.id === id); ui.menu = null; ui.dialog = { type: 'rename', id, name: m?.name || '', dur: 150, start: 'blank' }; render(); const n = $('#lib-name', el); n?.focus(); n?.select(); return; }
    case 'm-dup': ui.menu = null; await duplicateProject(id!); await refresh(); return note('Project duplicated');
    case 'm-file': {
      ui.menu = null; render();
      const { blob, name: file } = await projectFile(id!), url = URL.createObjectURL(blob);
      await saveFile(file, blob, url, (msg) => note(msg)); setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }
    case 'm-del': {
      if (!ui.menu!.arm) { ui.menu!.arm = true; return render(); }
      ui.menu = null; await deleteProject(id!); await refresh(); return note('Project deleted');
    }
  }
}
const keepName = () => { const n = $('#lib-name', el); if (n && ui.dialog) ui.dialog.name = n.value; };

async function submit() {
  keepName(); const d = ui.dialog; if (!d) return;
  if (d.type === 'rename') { ui.dialog = null; await renameProject(d.id!, d.name); return refresh(); }
  const name = d.name.trim() || await nextUntitled();
  const m = d.start === 'sample' ? await createSample(name, d.dur) : await createBlank(name, d.dur);
  return enter(m.id);
}

/** The library handles its own input, so taps and keys never reach the editor underneath it. */
export function listenLibrary() {
  const guard = (fn: () => unknown) => Promise.resolve().then(fn).catch(() => note('That did not work. Your projects are unchanged.'));
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-lib]');
    if (!t) { if (ui.menu && !(e.target as HTMLElement).closest('.lib-menu')) { ui.menu = null; render(); } return; }
    if (ui.menu && !t.dataset.lib!.startsWith('m')) ui.menu = null;
    guard(() => act(t.dataset.lib!, t, e));
  });
  el.addEventListener('submit', (e) => { e.preventDefault(); guard(submit); });
  el.addEventListener('input', (e) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).id === 'lib-q') { ui.q = (e.target as HTMLInputElement).value; $('#lib-grid', el).innerHTML = gridHtml(); }
  });
  el.addEventListener('change', (e) => {
    e.stopPropagation();
    const t = e.target as HTMLInputElement; if (t.id !== 'lib-file' || !t.files?.[0]) return;
    const f = t.files[0]; t.value = '';
    importProjectFile(f).then(async () => { await refresh(); note(`Imported ${f.name}`); }).catch((err) => note(err?.message || 'Could not import that file.'));
  });
  addEventListener('keydown', (e) => {
    if (!root.classList.contains('lib-open')) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape' && (ui.dialog || ui.menu)) { ui.dialog = null; ui.menu = null; render(); }
  }, true);
}
