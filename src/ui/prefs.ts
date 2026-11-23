// The user's Customise settings: one saved object (rfp-prefs). Colours are kept separately for dark and light mode and
// applied as inline CSS variables on the root, only when set, so a clean install renders from the design tokens alone.
import { root } from '../core/dom';
import { store } from '../core/store';

export type Mode = 'dark' | 'light';
export type ColorKey = 'accent' | 'board' | 'canvas' | 'comp' | 'panel' | 'text' | 'line';
export type Palette = Partial<Record<ColorKey, string>>;

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** The values the stylesheet uses when nothing is customised (02-tokens.css). */
const BASE: Record<Mode, Required<Palette>> = {
  dark: { accent: '#369cff', board: '#0b1324', canvas: '#101a30', comp: '#0d1628', panel: '#1a2744', text: '#eef2fa', line: '#3d5079' },
  light: { accent: '#369cff', board: '#d9d2c8', canvas: '#ebe6df', comp: '#fffdf9', panel: '#fbf8f4', text: '#1e1a16', line: '#d3c9bd' },
};

export const PRESETS: { id: string; name: string; colors: Palette }[] = [
  { id: 'navy', name: 'Navy', colors: {} },
  { id: 'midnight', name: 'Midnight', colors: { accent: '#5b8cff', board: '#05070d', canvas: '#090d16', comp: '#070a12', panel: '#10141f', text: '#eef1f8', line: '#2c3447' } },
  { id: 'charcoal', name: 'Original charcoal', colors: { accent: '#369cff', board: '#090807', canvas: '#0e0d0c', comp: '#15120f', panel: '#171513', text: '#f4efe9', line: '#3a342e' } },
  { id: 'graphite', name: 'Graphite', colors: { accent: '#7aa7ff', board: '#0c0c0e', canvas: '#141416', comp: '#101012', panel: '#1e1e21', text: '#f1f1f3', line: '#3f3f45' } },
  { id: 'forest', name: 'Forest', colors: { accent: '#4fd08f', board: '#08130f', canvas: '#0d1b16', comp: '#0a1612', panel: '#152720', text: '#ecf5f0', line: '#355246' } },
  { id: 'plum', name: 'Plum', colors: { accent: '#c78bff', board: '#120b1a', canvas: '#191024', comp: '#140d1d', panel: '#241836', text: '#f4eefa', line: '#4c3a66' } },
];

export const PREF_DEFAULTS = {
  colors: { dark: {} as Palette, light: {} as Palette },
  textSize: 100, uiScale: 100, corners: 1, glow: 100, motion: true, grid: 'dots', gridSize: 22, gridOpacity: 100, nameW: 232, prefsV: 2,
  loop: true, autoKey: false, hideAt: 60, tlStart: 'last', rightStart: 'last', undo: 60, newLen: 5,
};
export type Prefs = typeof PREF_DEFAULTS;

const cleanPalette = (p: any): Palette => {
  const out: Palette = {};
  for (const k of Object.keys(BASE.dark) as ColorKey[]) if (isHex(p?.[k])) out[k] = p[k].toLowerCase();
  return out;
};
/** Settings saved before version 2 were relative to the old sizes. Text and corners now start from the larger, rounder look. */
function migrate(saved: any) {
  if (!saved || saved.prefsV >= 2) return saved;
  const s = { ...saved };
  s.textSize = s.textSize === 90 ? 83 : 100; // the old Small stays small; Standard, Large and Extra large become the new Default
  s.corners = s.corners === .4 ? .3 : s.corners === 1 ? .65 : 1; // Sharp, Standard and Round keep their look
  return s;
}
function load(saved: any): Prefs {
  saved = migrate(saved);
  const out: any = { ...PREF_DEFAULTS, colors: { dark: cleanPalette(saved?.colors?.dark), light: cleanPalette(saved?.colors?.light) } };
  for (const k of Object.keys(PREF_DEFAULTS)) if (k !== 'colors' && saved && typeof saved[k] === typeof PREF_DEFAULTS[k]) out[k] = saved[k];
  return out;
}
export const PF: Prefs = load(store.get('prefs', null));
/** The interface scale as a multiplier, for the few lengths that are set in code. */
export const uiK = () => PF.uiScale / 100;
export const savePrefs = () => store.set('prefs', PF);

export function resetPrefs() {
  Object.assign(PF, PREF_DEFAULTS, { colors: { dark: {}, light: {} } });
  savePrefs(); applyPrefs();
}

const light = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
export function themeMode(): Mode {
  const t = root.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : light() ? 'light' : 'dark';
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Blends a towards b by t (0 to 1). */
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export function luminance(h: string) {
  const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
/** Dark or white text, whichever reads better on the accent colour. */
export function onAccent(h: string) {
  const L = luminance(h), dark = luminance('#02132b');
  return (L + .05) / (dark + .05) >= 1.05 / (L + .05) ? '#02132b' : '#ffffff';
}

/** The colour currently shown for a slot in this mode, custom or default. */
export function shownColor(k: ColorKey, mode = themeMode()) {
  const own = PF.colors[mode][k]; if (own) return own;
  if (k === 'accent' && root.getAttribute('data-tint') === 'warm') return '#26c6e8';
  return BASE[mode][k];
}
export function setColor(k: ColorKey, v: string) { PF.colors[themeMode()][k] = v.toLowerCase(); savePrefs(); applyPrefs(); }
export function clearColor(k: ColorKey) { delete PF.colors[themeMode()][k]; savePrefs(); applyPrefs(); }
/** The Ocean / Aqua tint buttons pick the accent, so they must clear a custom one. */
export function clearAccent() { delete PF.colors.dark.accent; delete PF.colors.light.accent; savePrefs(); applyPrefs(); }
export function applyPreset(id: string) { const p = PRESETS.find((x) => x.id === id); if (!p) return; PF.colors.dark = { ...p.colors }; savePrefs(); }
export function activePreset() {
  const cur = PF.colors.dark, keys = Object.keys(BASE.dark) as ColorKey[];
  return PRESETS.find((p) => keys.every((k) => (cur[k] || '') === (p.colors[k] || '')))?.id || null;
}

const MANAGED = ['--acc', '--on-acc', '--board', '--bg', '--comp-bg', '--surface', '--surface-2', '--surface-3', '--line', '--line-soft', '--text', '--muted', '--faint',
  '--fs-xs', '--fs-s', '--fs-m', '--fs-l', '--r-field', '--r-btn', '--r-panel', '--r-k', '--g', '--grid-s', '--grid-c', '--name', '--k'];

export function applyPrefs() {
  const st = root.style, set = (k: string, v: string) => st.setProperty(k, v), mode = themeMode(), c = PF.colors[mode], b = BASE[mode];
  MANAGED.forEach((k) => st.removeProperty(k));
  const panel = c.panel || b.panel, text = c.text || b.text;
  if (c.accent) { set('--acc', rgb(c.accent).join(' ')); set('--on-acc', onAccent(c.accent)); }
  if (c.board) set('--board', c.board);
  if (c.canvas) set('--bg', c.canvas);
  if (c.comp) set('--comp-bg', c.comp);
  if (c.text) set('--text', c.text);
  if (c.panel) { set('--surface', c.panel); set('--surface-2', mix(panel, text, .06)); set('--surface-3', mix(panel, text, .13)); }
  if (c.line) { set('--line', c.line); set('--line-soft', mix(panel, c.line, .6)); }
  else if (c.panel || c.text) { set('--line', mix(panel, text, .22)); set('--line-soft', mix(panel, text, .11)); }
  if (c.panel || c.text) { set('--muted', mix(panel, text, .68)); set('--faint', mix(panel, text, .46)); }

  const K = PF.uiScale / 100; // the interface scale: the stylesheet multiplies every length by --k
  if (PF.uiScale !== 100) set('--k', String(K));
  if (PF.textSize !== 100) { const k = PF.textSize / 100 * K; [['--fs-xs', 13.2], ['--fs-s', 15], ['--fs-m', 16.8], ['--fs-l', 20.4]].forEach(([n, px]) => set(n as string, `${+(px as number * k).toFixed(2)}px`)); }
  if (PF.corners !== 1) { const k = PF.corners; set('--r-k', String(+(k * 1.5).toFixed(3))); set('--r-field', `${+(9 * k * K).toFixed(2)}px`); set('--r-btn', `${+(15 * k * K).toFixed(2)}px`); set('--r-panel', `${+(21 * k * K).toFixed(2)}px`); }
  if (PF.glow !== 100) set('--g', String((root.getAttribute('data-glow') === 'soft' ? .5 : 1) * PF.glow / 100));
  if (PF.gridSize !== 22) set('--grid-s', `${+(PF.gridSize * K).toFixed(2)}px`);
  if (PF.gridOpacity !== 100) { const o = PF.gridOpacity; set('--grid-c', o < 100 ? `color-mix(in srgb, var(--line-soft) ${o}%, transparent)` : `color-mix(in srgb, var(--line) ${o - 100}%, var(--line-soft))`); }
  if (PF.nameW !== 232) set('--name', `${+(PF.nameW * K).toFixed(2)}px`);
  if (PF.grid === 'dots') root.removeAttribute('data-grid'); else root.setAttribute('data-grid', PF.grid);
  if (PF.motion) root.removeAttribute('data-motion'); else root.setAttribute('data-motion', 'off');

  // The browser and Home Screen app chrome follow the header colour.
  const meta = document.querySelector('meta[name="theme-color"]'), surface = getComputedStyle(root).getPropertyValue('--surface').trim();
  if (meta && surface && meta.getAttribute('content') !== surface) meta.setAttribute('content', surface);
}

if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => applyPrefs());
