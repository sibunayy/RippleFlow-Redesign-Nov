// The Customise dialog: colours, interface and workflow settings. Colour and slider drags update the app in place and
// never rebuild the dialog, so the control under the finger is not replaced mid-gesture.
import { $, esc } from '../core/dom';
import { store } from '../core/store';
import { S } from '../state/state';
import { ic } from './icons';
import { applyTheme } from './layout';
import { renderPop } from './popovers';
import { renderTL } from './timeline';
import { renderDialog } from './dialog';
import { PF, PRESETS, activePreset, applyPrefs, applyPreset, clearColor, isHex, resetPrefs, savePrefs, setColor, shownColor, themeMode } from './prefs';
import type { ColorKey } from './prefs';

let tab = 'colours', resetArm = false;

const COLORS: [ColorKey, string, string][] = [
  ['accent', 'Accent', 'Buttons, selection, playhead'],
  ['panel', 'Panels', 'Top bar, tool strips, inspector, timeline'],
  ['canvas', 'Canvas area', 'The space around your composition'],
  ['comp', 'Composition', 'Background of projects set to Theme'],
  ['board', 'App backdrop', 'Behind the whole app'],
  ['text', 'Text', 'Labels and icons'],
  ['line', 'Lines', 'Dividers and control outlines'],
];

const label = (name: string, hint = '') => `<span class="cz-l">${name}${hint ? `<small>${hint}</small>` : ''}</span>`;
const colorRow = ([k, name, hint]: [ColorKey, string, string]) => {
  const v = esc(shownColor(k)), own = !!PF.colors[themeMode()][k];
  return `<div class="cz-row">${label(name, hint)}<span class="cz-c">
    <input class="cz-sw" type="color" data-pfc="${k}" value="${v}" aria-label="${name} colour">
    <input class="cz-hex tc" type="text" data-pfh="${k}" value="${v}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${name} hex value">
    <button class="ib cz-rs" data-act="pfcolorreset" data-v="${k}" aria-label="Reset ${name}" title="Reset to theme" ${own ? '' : 'disabled'}>${ic('reset', 's')}</button>
  </span></div>`;
};
const segRow = (k: string, name: string, opts: [string | number, string][], hint = '') => `<div class="cz-row cz-stack">${label(name, hint)}<div class="seg" role="group" aria-label="${name}">${opts.map(([v, n]) => `<button data-act="pfset" data-k="${k}" data-v="${v}" aria-pressed="${String(PF[k]) === String(v)}">${n}</button>`).join('')}</div></div>`;
const togRow = (k: string, name: string, hint = '') => { const on = k === 'autoFold' ? S.autoFold : PF[k]; return `<div class="cz-row">${label(name, hint)}<button class="tog" data-act="pftog" data-k="${k}" role="switch" aria-pressed="${!!on}" aria-checked="${!!on}" aria-label="${name}"></button></div>`; };
const rangeRow = (k: string, name: string, min: number, max: number, step: number, unit: string, hint = '') => `<div class="cz-row cz-stack">${label(name, hint)}<span class="cz-range"><input type="range" data-pfn="${k}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${PF[k]}" aria-label="${name}"><output class="tc">${PF[k]}${unit}</output></span></div>`;
const head = (t: string) => `<div class="mlbl cz-h">${t}</div>`;

function body() {
  if (tab === 'interface') return head('Type and shape')
    + segRow('textSize', 'Text size', [[90, 'Small'], [100, 'Standard'], [110, 'Large'], [120, 'Extra large']])
    + segRow('corners', 'Corners', [[.4, 'Sharp'], [1, 'Standard'], [1.5, 'Round']])
    + rangeRow('glow', 'Glow', 0, 150, 5, '%', 'Halo on active controls')
    + togRow('motion', 'Panel animation', 'Slide panels and controls')
    + head('Canvas')
    + segRow('grid', 'Background pattern', [['dots', 'Dots'], ['lines', 'Lines'], ['none', 'None']])
    + rangeRow('gridSize', 'Pattern spacing', 10, 60, 2, ' px')
    + head('Timeline')
    + rangeRow('nameW', 'Layer name column', 150, 320, 2, ' px');
  if (tab === 'workflow') return head('Playback and keys')
    + togRow('loop', 'Loop playback', 'Also the setting at launch')
    + togRow('autoKey', 'Auto-key', 'Also the setting at launch')
    + head('Panels')
    + togRow('autoFold', 'Auto-fold panels', 'Move panels aside while you drag')
    + rangeRow('hideAt', 'Hide right panel when it covers', 30, 100, 5, '%', 'Of the item you are dragging')
    + segRow('tlStart', 'Timeline on open', [['last', 'As I left it'], ['peek', 'Collapsed'], ['mid', 'Half'], ['tall', 'Tall']], 'Applies next time the app opens')
    + segRow('rightStart', 'Inspector on open', [['last', 'As I left it'], ['open', 'Open'], ['closed', 'Closed']], 'Applies next time the app opens')
    + head('Projects')
    + segRow('newLen', 'New project length', [[3, '3 s'], [5, '5 s'], [10, '10 s'], [15, '15 s']])
    + segRow('undo', 'Undo steps', [[30, '30'], [60, '60'], [100, '100'], [150, '150']], 'More steps use more memory on large projects');
  const cur = activePreset(), mode = S.themePref;
  return `<div class="cz-row cz-stack">${label('Mode')}<div class="seg" role="group" aria-label="Mode">${['auto', 'dark', 'light'].map((t) => `<button data-act="pfmode" data-v="${t}" aria-pressed="${mode === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>`
    + head('Dark themes')
    + `<div class="cz-presets">${PRESETS.map((p) => { const a = p.colors.accent || '#369cff', pn = p.colors.panel || '#1a2744', cv = p.colors.canvas || '#101a30'; return `<button class="cz-preset" data-act="pfpreset" data-v="${p.id}" aria-pressed="${themeMode() === 'dark' && cur === p.id}"><span class="cz-chip" style="background:linear-gradient(90deg,${pn} 0 50%,${cv} 50%)"><i style="background:${a}"></i></span>${p.name}</button>`; }).join('')}</div>`
    + head(`Custom colours · ${themeMode()} mode`)
    + COLORS.map(colorRow).join('');
}

const tabs = () => [['colours', 'Colours'], ['interface', 'Interface'], ['workflow', 'Workflow']].map(([v, n]) => `<button role="tab" data-act="cztab" data-v="${v}" aria-selected="${tab === v}">${n}</button>`).join('');
const resetText = () => (resetArm ? 'Tap again to reset everything' : 'Reset all');

export function customiseDialog() {
  resetArm = false;
  return `<h2>Customise</h2>
    <div class="seg" id="cz-tabs" role="tablist" aria-label="Customise sections">${tabs()}</div>
    <div class="cz-body" id="cz-body">${body()}</div>
    <div class="foot"><button class="line-btn" id="cz-reset" data-act="pfresetall">${resetText()}</button><span class="spacer"></span><button class="primary" data-act="close">Done</button></div>`;
}
/** Redraws the tabs and the scrolling body only; the scroll position stays. */
function refresh() {
  const b = $('#cz-body'); if (!b) return;
  const y = b.scrollTop; $('#cz-tabs').innerHTML = tabs(); b.innerHTML = body(); b.scrollTop = y;
  disarm();
}
function disarm() { resetArm = false; const r = $('#cz-reset'); if (r) r.textContent = resetText(); }
/** Keeps a colour row and the theme highlights correct without rebuilding them. */
function syncColor(k: ColorKey, from?: HTMLElement) {
  const v = shownColor(k), sw = document.querySelector<HTMLInputElement>(`[data-pfc="${k}"]`), hx = document.querySelector<HTMLInputElement>(`[data-pfh="${k}"]`), rs = document.querySelector<HTMLButtonElement>(`[data-act="pfcolorreset"][data-v="${k}"]`);
  if (sw && sw !== from) sw.value = v;
  if (hx && hx !== from) hx.value = v;
  if (rs) rs.disabled = !PF.colors[themeMode()][k];
  const cur = themeMode() === 'dark' ? activePreset() : null;
  document.querySelectorAll<HTMLElement>('.cz-preset').forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.v === cur)));
}

function setLive(k: string, v: any) {
  PF[k] = v; savePrefs(); applyPrefs();
  if (k === 'loop') { S.loop = v; renderTL(); }
  if (k === 'autoKey') { S.autoKey = v; renderTL(); }
}

export function openCustomise() { S.dialog = 'customise'; S.pop = null; renderPop(); renderDialog(); }
export function czTab(el) { tab = el.dataset.v; refresh(); const b = $('#cz-body'); if (b) b.scrollTop = 0; }
export function pfSet(el) { const k = el.dataset.k, raw = el.dataset.v; setLive(k, typeof PF[k] === 'number' ? +raw : raw); refresh(); }
export function pfToggle(el) {
  const k = el.dataset.k;
  if (k === 'autoFold') { S.autoFold = !S.autoFold; store.set('autofold', S.autoFold); } else setLive(k, !PF[k]);
  refresh();
}
export function pfMode(el) { S.themePref = el.dataset.v; applyTheme(); refresh(); }
export function pfPreset(el) { applyPreset(el.dataset.v); S.themePref = 'dark'; applyTheme(); refresh(); }
export function pfColorReset(el) { clearColor(el.dataset.v); syncColor(el.dataset.v); disarm(); }
export function pfResetAll() {
  if (!resetArm) { resetArm = true; const r = $('#cz-reset'); if (r) r.textContent = resetText(); return; }
  resetPrefs(); S.loop = PF.loop; S.autoKey = PF.autoKey; S.autoFold = true; store.set('autofold', true);
  renderTL(); refresh();
}

/** Registers the live colour and slider listeners. main.ts calls it once. */
export function listenCustomise() {
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement, d = t.dataset; if (!d || !t.closest?.('#cz-body')) return;
    if (d.pfc) { setColor(d.pfc as ColorKey, t.value); syncColor(d.pfc as ColorKey, t); disarm(); }
    else if (d.pfh) { let v = t.value.trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v; if (isHex(v)) { setColor(d.pfh as ColorKey, v); syncColor(d.pfh as ColorKey, t); disarm(); } }
    else if (d.pfn) { setLive(d.pfn, +t.value); const o = t.parentElement?.querySelector('output'); if (o) o.textContent = t.value + (d.u || ''); disarm(); }
  });
  // A half-typed hex value goes back to the colour in use when the field is left.
  document.addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.dataset?.pfh && t.closest('#cz-body')) t.value = shownColor(t.dataset.pfh as ColorKey); });
}
