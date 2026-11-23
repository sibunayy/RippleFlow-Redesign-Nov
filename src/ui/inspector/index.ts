import { $, $$, esc } from '../../core/dom';
import { CH, CW, DUR, FPS, compBg, markers, projName } from '../../model/project';
import { FPS_PRESETS, SIZES } from '../../actions/comp';
import { ic } from '../icons';
import { GROUPS, PROPS } from '../../model/schema';
import { lay, val } from '../../anim/interpolate';
import { S } from '../../state/state';
import { presetsView } from '../presets';
import { fmt, grpState, kdLabel, sec, tc } from './controls';
import { easingBlock } from './easing';
import { fxView } from './effects';
import { propsView } from './props-view';
import { repHtml } from './extras';
import { repN } from '../../anim/pose';
import { fbfView } from '../../drawing/workspace';

export function renderRight() {
  const el = $('#rpanel');
  if (!S.right) { el.innerHTML = ''; return; }
  const l = S.sel && lay(S.sel);
  const grab = `<button class="grab" id="sheetgrab" aria-label="${S.full ? 'Collapse' : 'Expand'} inspector sheet"></button>`;
  let head, body;
  if (S.right === 'presets') {
    ({ head, body } = presetsView());
  } else if (S.right === 'easing') {
    const n = S.keys.length;
    head = `<span class="chip-dot" style="background:rgb(var(--acc))"></span><div><h2>Easing</h2><div class="sub">${n ? `${n} keyframe${n > 1 ? 's' : ''} selected` : 'No keyframes selected'}</div></div>`;
    body = `<div class="sec-b" style="padding-top:4px">${easingBlock(false)}</div>`;
  } else if (S.right === 'dup') {
    if (!l) { head = `<div><h2>Duplicator</h2><div class="sub">No layer selected</div></div>`; body = `<p class="hint">Select a layer to make copies of it.</p>`; }
    else { head = `<span class="chip-dot" style="background:${l.hue}"></span><div style="min-width:0"><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</h2><div class="sub">${l.rep && l.rep.on ? repN(l) + ' copies' : 'Duplicator off'}</div></div>`; body = `<div class="sec-b" style="padding-top:4px">${repHtml(l)}</div>`; }
  } else if (S.right === 'fbf') {
    ({ head, body } = fbfView());
  } else if (!l) {
    head = `<div><h2>${S.right === 'effects' ? 'Effects' : 'Composition'}</h2><div class="sub">${esc(projName)} · ${CW}×${CH} · ${FPS} fps · ${+(DUR / FPS).toFixed(2)} s</div></div>`;
    const preset = SIZES.find((z) => z[1] === CW && z[2] === CH), BGS = [['#ffffff', 'White'], ['#f4efe9', 'Off white (paper)'], ['#000000', 'Black'], ['#808080', 'Mid grey (50%)'], ['#bfbfbf', 'Light grey (75%)']], custom = !!compBg && !BGS.some(([c]) => c === compBg.toLowerCase());
    body = `
      ${sec('comp', 'Composition', `<div class="sublbl">Size</div>
        <select class="sel" data-sel="compsize" aria-label="Composition size">${SIZES.map(([n, w, h]) => `<option value="${w},${h}" ${preset && preset[1] === w && preset[2] === h ? 'selected' : ''}>${n}</option>`).join('')}${preset ? '' : `<option value="" selected>Custom ${CW} × ${CH}</option>`}</select>
        <div class="two"><label class="kv"><span>Width</span><input class="txt tc" data-comp="w" inputmode="numeric" value="${CW}" aria-label="Width in pixels"></label><label class="kv"><span>Height</span><input class="txt tc" data-comp="h" inputmode="numeric" value="${CH}" aria-label="Height in pixels"></label></div>
        <div class="sublbl">Frame rate</div><div class="seg" role="group" aria-label="Frame rate">${FPS_PRESETS.map((n) => `<button data-act="setfps" data-v="${n}" aria-pressed="${FPS === n}">${n}</button>`).join('')}</div>
        <label class="kv"><span>Custom fps</span><input class="txt tc" data-comp="fps" inputmode="numeric" value="${FPS}" aria-label="Frames per second"></label>
        <p class="hint" style="padding:0">Changing the frame rate keeps the timing in seconds. Changing the size keeps each layer's pixel position.</p>
        <div class="sublbl">Duration</div><div class="seg" role="group" aria-label="Duration">${[3, 5, 10, 15].map((d) => `<button data-act="setdur" data-v="${d}" aria-pressed="${DUR === d * FPS}">${d} s</button>`).join('')}</div>
        <div class="sublbl">Background</div><div class="swatches">${BGS.map(([c, n]) => `<button class="sw ${(compBg || '').toLowerCase() === c ? 'on' : ''}" data-act="compbg" data-v="${c}" aria-label="Background ${n}" title="${n}" style="background:${c}"></button>`).join('')}<label class="sw cust ${custom ? 'on' : ''}" title="Custom colour" aria-label="Custom background colour"><input type="color" data-compbg value="${compBg && /^#[0-9a-f]{6}$/i.test(compBg) ? compBg : '#808080'}"></label></div>
        <div class="sublbl">Overlays</div><div class="seg" role="group" aria-label="Overlays">${[['off', 'None'], ['safe', 'Safe areas'], ['thirds', 'Thirds']].map(([v, n]) => `<button data-act="guide" data-v="${v}" aria-pressed="${S.guide === v}">${n}</button>`).join('')}</div>
        <button class="line-btn" data-act="settings">${ic('settings', 's')}Project settings…</button>`)}
      ${sec('mk', 'Markers', `<button class="line-btn" data-act="marker">${ic('plus', 's')}Add marker at ${tc(S.f)}</button>` + (markers.length ? markers.map((m, i) => `<div class="mkrow"><button class="ib" data-act="mkjump" data-v="${i}" aria-label="Go to ${esc(m.name)}" title="Go to marker">${ic('marker', 's')}</button><input class="lname" data-mkn="${i}" value="${esc(m.name)}" aria-label="Marker name"><span class="tc" style="color:var(--muted)">${tc(m.f)}</span><button class="ib" data-act="mkdel" data-v="${i}" aria-label="Delete ${esc(m.name)}">${ic('trash', 's')}</button></div>`).join('') : '<p class="hint" style="padding:0">No markers yet. Use Marker in the timeline tools.</p>'))}`;
  } else if (S.right === 'effects') {
    ({ head, body } = fxView(l));
  } else {
    ({ head, body } = propsView(l));
  }
  const rKey = S.right + ':' + (S.sel || ''), oldBody = el.querySelector('.pbody');
  const keepTop = oldBody && el.dataset.rkey === rKey ? oldBody.scrollTop : 0;
  el.innerHTML = `<div class="inner">${grab}<div class="phead">${head}</div><div class="pbody">${body}</div></div>`;
  el.dataset.rkey = rKey;
  if (keepTop) el.querySelector('.pbody').scrollTop = keepTop;
  el.classList.toggle('full', S.full);
}
export function updateFields() {
  $$('#rpanel .fld[data-p]').forEach((f) => {
    const L = lay(f.dataset.l), p = f.dataset.p; if (!L || !L.p[p]) return;
    const v = val(L.p[p], S.f), sp = f.querySelector('.v'); if (sp) sp.textContent = fmt(v, PROPS[p]);
    f.setAttribute('aria-valuenow', Math.round(v));
  });
  const l = S.sel && lay(S.sel); if (!l) return;
  $$('#rpanel .prop[data-g]').forEach((row) => {
    const g = row.dataset.g, st2 = grpState(l, g), b = row.querySelectorAll('.kc button');
    b[0].disabled = st2.prev == null; b[2].disabled = st2.next == null;
    row.classList.toggle('is-anim', st2.anim); b[1].classList.toggle('anim', st2.anim); b[1].classList.toggle('onkey', st2.on); b[1].setAttribute('aria-label', kdLabel(GROUPS[g].label, st2));
  });
}
