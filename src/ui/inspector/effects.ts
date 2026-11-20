import { esc } from '../../core/dom';
import { ic } from '../icons';
import { FXDEF, fxDefaults, isFilterFx } from '../../fx/defs';
import { grid2, info, pf, sec } from './controls';
import { behHtml } from './extras';

export function fxView(l) {
  const nm = (l.mods || []).length;
  const n = l.fx.length, nOn = l.fx.filter((e) => e.on).length;
  const head = `<span class="chip-dot" style="background:${l.hue}"></span><div style="min-width:0"><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</h2><div class="sub">${n ? `${nOn} of ${n} effect${n === 1 ? '' : 's'} on` : 'No effects'}</div></div><span class="spacer"></span>${info('Add Glow, Ripple distort, Hue shift and more with the plus button. Effects stack top to bottom: hold an effect, then drag to reorder, or use ⋯ to move it. Mix blends each effect with what is beneath it.')}<button class="ib" data-act="addfx" aria-label="Add effect" aria-haspopup="menu">${ic('plus', 's')}</button>`;
  const rows = l.fx.map((e, i) => {
    const D = FXDEF[e.id] || FXDEF.glow;
    fxDefaults(e);
    const shut = !!e.shut, vis = (x) => !x || x(e);
    const opts = (D.opts || []).filter((o) => vis(o[4])).map(([k, lb, ch]) => `<div class="kv"><span>${lb}</span><select class="sel" data-sel="fxopt" data-i="${i}" data-k="${k}" aria-label="${e.name} ${lb.toLowerCase()}">${(typeof ch === 'function' ? ch() : ch).map(([v, n]) => `<option value="${v}" ${String(v) === String(e[k]) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('');
    const cols = (D.cols || []).filter((c) => vis(c[3])).map(([k, lb]) => { const cv = e[k] || '#ffffff', key = `fx${i}.${k}`; return `<button class="cchip" data-act="colour" data-key="${key}" aria-haspopup="dialog" aria-label="${lb} ${cv}"><span class="cc" style="background:${cv}"></span><span>${lb}</span><span class="tc hex">${String(cv).toUpperCase()}</span></button>`; });
    const colRow = cols.length ? `<div class="${cols.length > 1 ? 'two' : 'fxcol'}">${cols.join('')}</div>` : '';
    return `<div class="fx ${shut ? 'shut' : ''} ${e.on ? '' : 'off'}"><div class="fx-h"><button class="tog" data-act="fxon" data-v="${i}" aria-pressed="${e.on}" aria-label="${e.on ? 'Disable' : 'Enable'} ${e.name}"></button>
      <button class="nmb" data-act="fxshut" data-v="${i}" aria-expanded="${!shut}" aria-label="${shut ? 'Expand' : 'Collapse'} ${e.name}">${ic('down', 'xs chev')}<span>${e.name}</span></button>
      <button class="ib" data-act="fxreset" data-v="${i}" aria-label="Reset ${e.name}" title="Reset to defaults">${ic('reset', 's')}</button>
      <button class="ib" data-act="fxmenu" data-v="${i}" aria-label="${e.name} options" aria-haspopup="menu" title="More">${ic('more', 's')}</button></div>
      ${shut ? '' : `<div class="fxopts">${opts}${colRow}</div>` + grid2(D.ps.filter((p) => vis(p[7])).map(([k, lb, mn, mx, sp, u]) => pf(e, 'fx', i, k, lb, mn, mx, sp, u)).concat(e.id === 'postime' ? [] : [pf(e, 'fx', i, 'mix', 'Mix', 0, 100, .5, '%', true)]))}</div>`;
  }).join('');
  const bar = n ? `<div class="fxbar"><span>Bypass all</span><button class="tog" data-act="fxbypass" aria-pressed="${!!l.fxOff}" aria-label="Bypass all effects"></button><span class="spacer"></span><button class="line-btn ghost" data-act="fxfold" style="min-height:30px">${l.fx.every((e) => e.shut) ? 'Expand all' : 'Collapse all'}</button></div>` : '';
  const body = bar + (l.fxOff && n ? '<p class="hint" style="padding-top:0;color:var(--acc-text)">All effects are bypassed. The settings are kept.</p>' : '') + (rows || `<p class="hint">No effects yet.</p>`)
    + `<div style="padding:10px 14px;display:grid;gap:6px"><button class="line-btn" data-act="addfx" style="justify-content:center">${ic('plus', 's')}Add effect</button>${n || fxClip ? `<div class="two-btn"><button class="line-btn" data-act="fxcopy" ${n ? '' : 'disabled'} title="Copy this effect stack">${ic('copy', 's')}Copy stack</button><button class="line-btn" data-act="fxpaste" ${fxClip ? '' : 'disabled'} title="Paste copied effects onto the selected layers">Paste stack</button></div>` : ''}${l.fx.some(isFilterFx) && !l.fxOff && l.type !== 'audio' ? `<button class="line-btn" data-act="fxbake" style="justify-content:center" title="Turn this layer and its effects into a picture, so they no longer need redrawing every frame">${ic('bake', 's')}Bake effects into layer</button>` : ''}</div>`
    + sec('beh', 'Behaviours', behHtml(l), nm ? `<span class="count">${nm}</span>` : '');
  return { head, body };
}
export let fxClip = null;
export function setFxClip(v) { return (fxClip = v); }
