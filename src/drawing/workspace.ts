import { ic } from '../ui/icons';
import { BPRE, DRAWMODES, S, isDrawTool } from '../state/state';
import { layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { pf, tc } from '../ui/inspector/controls';
import { brushCur, celIdx } from './cels';
import { app, esc } from '../core/dom';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';

/* ---------- frame-by-frame workspace ---------- */
// A drawing-first layout, switched on from the header. It folds the left panel, opens a brush panel on the
// right (tools, brush, size, smoothing, onion skin, cels) and gives the timeline more height. Switching it off
// puts the panels, timeline and tool back as they were.
export function toggleFbf() {
  if (S.fbf) {
    const p = S.fbfPrev || {};
    S.fbf = false; S.left = p.left ?? S.left; S.right = p.right === 'fbf' ? null : (p.right ?? null); S.tl = p.tl ?? S.tl; S.tlPx = null; S.tool = p.tool ?? 'select';
    S.fbfPrev = null; renderAll(); return;
  }
  if (S.playing) play(false);
  S.fbfPrev = { left: S.left, right: S.right, tl: S.tl, tool: S.tool };
  S.fbf = true; S.left = null; S.right = 'fbf'; S.tl = 'mid'; S.tlPx = Math.round(app.clientHeight * 0.3); S.pop = null; S.keys = [];
  if (!isDrawTool(S.tool)) S.tool = S.drawMode = 'brush';
  const cur = S.sel && lay(S.sel);
  if (!cur || cur.type !== 'draw') { const d = layers.find((l) => l.type === 'draw' && !l.lock); if (d) { S.sel = d.id; S.multi.clear(); } }
  renderAll();
}

/** Jump to the previous (-1) or next (1) cel of the selected drawing layer. */
export function stepCel(dir: number) {
  const l = S.sel && lay(S.sel); if (!l || l.type !== 'draw' || !(l.cels || []).length) return;
  if (S.playing) play(false);
  const i = celIdx(l, S.f), j = Math.max(0, Math.min(l.cels.length - 1, (i < 0 ? (dir > 0 ? -1 : l.cels.length) : i) + dir));
  seek(l.cels[j].f); renderAll();
}

export function fbfView() {
  const B = S.brush, t = S.tool, l = S.sel && lay(S.sel), draw = l && l.type === 'draw' ? l : null;
  const n = draw ? (draw.cels || []).length : 0, i = draw ? celIdx(draw, S.f) : -1, cur = brushCur(), O = S.onion;
  const head = `<span class="chip-dot" style="background:${draw ? draw.hue : 'rgb(var(--acc))'}"></span><div style="min-width:0"><h2>Frame by frame</h2><div class="sub">${draw ? `${esc(draw.name)} · ${n ? `cel ${i + 1} of ${n} · ` : 'no cels yet · '}${tc(S.f)}` : 'Draw to start a new drawing layer'}</div></div>`;
  const seg = (label: string, items: [string | number, string][], on: string | number, act: string) => `<div class="seg" role="group" aria-label="${label}">${items.map(([id, nm]) => `<button data-act="${act}" data-v="${id}" aria-pressed="${on === id}">${nm}</button>`).join('')}</div>`;
  const tog = (k: string, on: boolean, icn: string, lbl: string) => `<button class="line-btn ${on ? 'lit' : ''}" data-act="btog" data-k="${k}" aria-pressed="${on}">${ic(icn, 's')}${lbl}</button>`;
  const body = `<div class="sec-b" style="padding-top:4px;display:grid;gap:10px">
    <div class="sublbl" style="padding-top:0">Tool</div>
    ${seg('Drawing tool', DRAWMODES.map(([id, nm]) => [id, nm]), t, 'pickdraw')}
    ${t === 'brush' ? `<div class="sublbl">Brush</div>${seg('Brush', BPRE.map(([id, nm]) => [id, nm]), B.pre, 'bpre')}` : ''}
    ${t !== 'fill' ? `<div class="pair">${pf(cur, 'br', 0, 'sz', 'Size', 1, 240, .3)}${pf(cur, 'br', 0, 'op', 'Opacity', 5, 100, .4, '%')}</div>` : ''}
    ${t !== 'fill' ? `<div class="pair">${pf(B, 'bs', 0, 'sm', 'Smoothing', 0, 100, .5, '%', true)}<span></span></div>` : ''}
    ${t !== 'erase' ? `<div class="kv"><span>Colour</span><button class="bcol" data-act="bcolour" style="background:${B.c}" aria-label="Brush colour ${B.c}" aria-haspopup="dialog" title="Colour"></button></div>` : ''}
    ${t !== 'fill' ? `<div class="two-btn">${tog('pr', B.pr, 'press', 'Pressure')}${tog('tl', B.tl, 'tilt', 'Tilt')}</div>` : ''}
    <div class="sublbl">Onion skin</div>
    <div class="kv"><span>Show neighbouring frames</span><button class="tog" data-act="onion" aria-pressed="${O.on}" aria-label="Onion skin"></button></div>
    <div class="kv"><span>Before</span>${seg('Cels before', [0, 1, 2, 3].map((k) => [k, String(k)]), O.nb, 'onsetnb')}</div>
    <div class="kv"><span>After</span>${seg('Cels after', [0, 1, 2, 3].map((k) => [k, String(k)]), O.na, 'onsetna')}</div>
    <div class="sublbl">Cels</div>
    <div class="two-btn"><button class="line-btn" data-act="celprev" ${n ? '' : 'disabled'}>${ic('left', 's')}Previous</button><button class="line-btn" data-act="celnext" ${n ? '' : 'disabled'}>Next${ic('right', 's')}</button></div>
    <div class="two-btn"><button class="line-btn" data-act="celadd" ${draw ? '' : 'disabled'}>${ic('celadd', 's')}Blank cel</button><button class="line-btn" data-act="celdup" ${draw && i >= 0 ? '' : 'disabled'}>${ic('copy', 's')}Duplicate</button></div>
  </div>`;
  return { head, body };
}
