import { $, app, esc } from '../core/dom';
import { DUR, FPS, layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { DRAWMODES, S } from '../state/state';
import { commit, hi, hist } from '../state/history';
import { updateCanvas } from '../render/stage';
import { ic } from '../ui/icons';
import { renderRight } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { toast } from '../ui/toast';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { celIdx, insertCel } from './cels';
import { drawTarget } from './ink';

/* ---------- frame-by-frame timeline ---------- */
// While the workspace is on, this replaces the normal timeline: one row per drawing layer and one column per frame.
// A cel is a block that starts on its frame and holds until the next cel.
const drawLayers = () => layers.filter((l) => l.type === 'draw');
const selDraw = () => { const l = S.sel && lay(S.sel); return l && l.type === 'draw' ? l : null; };
const celLen = (l, c) => { const n = l.cels[l.cels.indexOf(c) + 1]; return Math.max(1, (n ? n.f : l.outP ?? DUR) - c.f); };
const cellW = () => S.fcw || 34;
const frameNow = () => Math.floor(S.f + 1e-6);
const stopPlay = () => { if (S.playing) play(false); };
const celStatus = (l, i) => `${l.name} · ${l.cels.length ? (i >= 0 ? `cel ${i + 1} of ${l.cels.length}` : 'before the first cel') : 'no cels yet'}`;

export function renderFbfTimeline() {
  const el = $('#tl'); if (!el) return;
  const old = $('#ftlscroll'), left = old ? old.scrollLeft : null, top = old ? old.scrollTop : 0;
  const cw = cellW(), L = selDraw(), rows = drawLayers(), fr = frameNow(), cur = L ? celIdx(L, fr) : -1, nC = L ? (L.cels || []).length : 0;
  const fb = (act: string, icn: string, label: string, o: { cls?: string; dis?: boolean; aria?: string; title?: string } = {}) => `<button class="fb ${o.cls || ''}" data-act="${act}" ${o.dis ? 'disabled' : ''} aria-label="${o.aria || label}" title="${o.title || label}">${ic(icn, 's')}<span>${label}</span></button>`;
  let ruler = `<div class="corner"><button class="fb" data-act="fnewlayer" aria-label="New drawing layer" title="New drawing layer">${ic('plus', 's')}<span>Layer</span></button></div>`;
  for (let i = 0; i < DUR; i++) { const n = i + 1; ruler += `<i class="${i % FPS === 0 && i > 0 ? 's' : ''} ${i === fr ? 'cur' : ''}">${cw >= 28 || n === 1 || n % 5 === 0 ? n : ''}</i>`; }
  const row = (l) => {
    const act = !!L && l.id === L.id, cels = l.cels || [];
    const blocks = cels.map((c, k) => {
      const len = celLen(l, c);
      return `<b class="fcel ${(c.strokes || []).length ? '' : 'empty'} ${act && k === cur ? 'on' : ''} ${k === cels.length - 1 ? 'last' : ''}" data-fcel="${c.id}" data-l="${l.id}" style="left:calc(${c.f} * var(--cw));width:calc(${len} * var(--cw))" title="Cel ${k + 1} · frame ${c.f + 1} · ${len} frame${len > 1 ? 's' : ''} · drag to move, drag the right edge to change the hold"><span class="fn">${k + 1}</span><i class="fh" data-fhold="${c.id}" data-l="${l.id}" title="Drag to change how long this drawing holds"></i></b>`;
    }).join('');
    return `<div class="frow ${act ? 'act' : ''}"><div class="flab" data-act="sel" data-v="${l.id}"><span class="chip-dot" style="background:${l.hue}"></span><span class="nm">${esc(l.name)}</span><button class="ib" data-act="vis" data-v="${l.id}" aria-label="${l.vis ? 'Hide' : 'Show'} layer">${ic(l.vis ? 'eye' : 'eyeoff', 'xs')}</button></div><div class="ftrack" data-ftrack="${l.id}" style="--hue:${l.hue}">${blocks}</div></div>`;
  };
  const body = rows.length ? rows.map(row).join('') : `<div class="fempty"><p>No drawing layers yet.</p><button class="fb" data-act="fnewlayer">${ic('plus', 's')}<span>New drawing layer</span></button></div>`;
  el.classList.remove('drawsel');
  app.style.setProperty('--fi', String(fr));
  el.innerHTML = `<div class="ftl" style="--cw:${cw}px;--np:${DUR}">
    <div class="fbar">
      <div class="fgrp" role="group" aria-label="Playback">
        <button class="ib" data-act="step" data-v="-1" aria-label="Previous frame" title="Previous frame">${ic('stepb', 's')}</button>
        <button class="play" data-act="play" aria-label="${S.playing ? 'Pause' : 'Play'}">${ic(S.playing ? 'pause' : 'play')}</button>
        <button class="ib" data-act="step" data-v="1" aria-label="Next frame" title="Next frame">${ic('stepf', 's')}</button>
      </div>
      <div class="fcount"><b class="tc" id="fcount">Frame ${fr + 1}</b><span class="tc">/ ${DUR} · ${FPS} fps</span></div>
      <div class="fgrp" role="group" aria-label="Drawings">
        ${fb('celprev', 'left', 'Prev cel', { dis: !nC, title: 'Jump to the previous drawing' })}
        ${fb('celnext', 'right', 'Next cel', { dis: !nC, title: 'Jump to the next drawing' })}
      </div>
      <span class="spacer"></span>
      <div class="fgrp" role="group" aria-label="View">
        <button class="ib ${S.onion.on ? 'on' : ''}" data-act="onion" data-onion aria-pressed="${S.onion.on}" aria-label="Onion skin (hold for settings)" title="Onion skin · hold for settings">${ic('onion', 's')}</button>
        <button class="ib" data-flip aria-label="Flipbook: hold to see the previous drawing, drag to flip through drawings" title="Flipbook · hold, then drag to flip through drawings">${ic('flip', 's')}</button>
        <button class="ib ${S.loop ? 'on' : ''}" data-act="loopt" aria-pressed="${S.loop}" aria-label="Loop playback" title="Loop playback">${ic('loop', 's')}</button>
        <button class="ib" data-act="fzoom" data-v="-1" aria-label="Narrower frames" title="Narrower frames">${ic('zout', 's')}</button>
        <button class="ib" data-act="fzoom" data-v="1" aria-label="Wider frames" title="Wider frames">${ic('zin', 's')}</button>
      </div>
    </div>
    <div class="fbar acts" role="toolbar" aria-label="Frame actions">
      <div class="fgrp" role="group" aria-label="Frames">
        ${fb('fadd', 'celadd', 'Add frame', { dis: !L, title: 'Add a blank frame after this one' })}
        ${fb('fdup', 'copy', 'Copy frame', { dis: !nC, title: 'Copy this frame into a new frame after it' })}
        ${fb('celclear', 'erase', 'Clear', { dis: !nC, title: 'Erase the drawing on this frame' })}
        ${fb('fdel', 'trash', 'Delete', { dis: !nC, cls: 'warn', title: 'Delete this frame and close the gap' })}
      </div>
      <div class="fgrp" role="group" aria-label="Shift">
        ${fb('fmovel', 'left', 'Earlier', { dis: !nC, aria: 'Shift frame one step earlier', title: 'Shift this frame one step earlier' })}
        ${fb('fmover', 'right', 'Later', { dis: !nC, aria: 'Shift frame one step later', title: 'Shift this frame one step later' })}
        ${fb('fholdm', 'zout', 'Shorter', { dis: nC < 2, aria: 'Hold one frame less', title: 'Hold this drawing one frame less' })}
        ${fb('fholdp', 'zin', 'Longer', { dis: nC < 2, aria: 'Hold one frame more', title: 'Hold this drawing one frame more' })}
      </div>
      <span class="fhint" id="fcel">${L ? esc(celStatus(L, cur)) : 'Select a drawing layer'}</span>
    </div>
    <div class="ftl-scroll" id="ftlscroll"><div class="ftl-grid"><div class="fruler" data-fscrub role="slider" aria-label="Frame" aria-valuemin="1" aria-valuemax="${DUR}" aria-valuenow="${fr + 1}">${ruler}</div>${body}<span class="fcol"></span><span class="fph"></span></div></div>
  </div>`;
  const sc = $('#ftlscroll');
  if (sc) { if (left != null) { sc.scrollLeft = left; sc.scrollTop = top; } else reveal(sc); }
}

/** Scrolls just enough to keep the current frame in view. */
function reveal(sc = $('#ftlscroll')) {
  if (!sc) return;
  const cw = cellW(), lab = ($('.flab') || $('.fruler .corner') || { offsetWidth: 0 }).offsetWidth, cx = lab + frameNow() * cw;
  if (cx < sc.scrollLeft + lab || cx + cw > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, cx - lab - cw * 3);
}

/** The fast path for scrubbing and playback: moves the playhead and highlights without rebuilding the timeline. */
export function fbfTick() {
  const fr = frameNow();
  app.style.setProperty('--fi', String(fr));
  const count = $('#fcount'); if (count) count.textContent = `Frame ${fr + 1}`;
  const rl = $('.fruler');
  if (rl) { rl.querySelector('i.cur')?.classList.remove('cur'); rl.children[fr + 1]?.classList.add('cur'); rl.setAttribute('aria-valuenow', String(fr + 1)); }
  const L = selDraw();
  if (L) {
    const cur = celIdx(L, fr);
    (L.cels || []).forEach((c, k) => $(`[data-fcel="${c.id}"]`)?.classList.toggle('on', k === cur));
    const hint = $('#fcel'); if (hint) hint.textContent = celStatus(L, cur);
  }
  reveal();
}

// Drags update the blocks in place. Replacing the block under a finger would make Safari stop the drag and scroll instead.
function placeCels(l, cur = l.id === S.sel ? celIdx(l, frameNow()) : -1) {
  (l.cels || []).forEach((c, k) => {
    const b = $(`[data-fcel="${c.id}"]`); if (!b) return;
    b.style.left = `calc(${c.f} * var(--cw))`; b.style.width = `calc(${celLen(l, c)} * var(--cw))`;
    b.classList.toggle('on', k === cur); b.classList.toggle('last', k === l.cels.length - 1);
    const n = b.querySelector('.fn'); if (n) n.textContent = String(k + 1);
  });
}

/* ---- frame actions ---- */
function target() {
  const l = selDraw();
  if (!l) { toast('Select a drawing layer first.'); return null; }
  stopPlay();
  return l;
}
const refresh = () => { renderTL(); renderRight(); };

export function fbfInsert(dup: boolean) {
  const l = target(); if (!l) return;
  l.cels = l.cels || [];
  const f0 = Math.round(S.f), i = celIdx(l, f0), cur = i >= 0 ? l.cels[i] : null;
  if (dup && !cur) { toast('There is no frame here to copy.'); return; }
  const pos = cur ? f0 + 1 : f0;
  if (pos >= DUR) { toast('No room after the last frame.'); return; }
  const later = l.cels.filter((c) => c.f >= pos);
  if (later.length && later[later.length - 1].f + 1 >= DUR) { toast('No room to shift the later frames.'); return; }
  later.forEach((c) => { c.f += 1; });
  insertCel(l, pos, dup && cur ? cur.strokes : []);
  commit(dup ? 'Copy frame' : 'Add frame');
  seek(pos); refresh();
  toast(`${dup ? 'Copied to' : 'Blank frame at'} frame ${pos + 1}`, true);
}

export function fbfDelete() {
  const l = target(); if (!l) return;
  const i = celIdx(l, Math.round(S.f));
  if (i < 0) { toast('There is no frame here to delete.'); return; }
  const c = l.cels[i], len = celLen(l, c), after = l.cels.slice(i + 1);
  l.cels.splice(i, 1);
  after.forEach((k) => { k.f -= len; });
  commit('Delete frame');
  seek(Math.min(Math.round(S.f), DUR - 1)); refresh(); updateCanvas();
  toast(`Deleted frame ${c.f + 1}`, true);
}

export function fbfMove(d: number) {
  const l = target(); if (!l) return;
  const i = celIdx(l, Math.round(S.f));
  if (i < 0) { toast('There is no frame here to shift.'); return; }
  const c = l.cels[i], nf = c.f + d;
  if (nf < 0 || nf >= DUR) { toast(d < 0 ? 'Already at the first frame.' : 'Already at the last frame.'); return; }
  const other = l.cels.find((k) => k !== c && k.f === nf);
  if (other) other.f = c.f;
  c.f = nf;
  l.cels.sort((a, b) => a.f - b.f);
  commit('Shift frame');
  seek(nf); refresh();
  toast(`Moved to frame ${nf + 1}`, true);
}

export function fbfHold(d: number) {
  const l = target(); if (!l) return;
  const i = celIdx(l, Math.round(S.f));
  if (i < 0) { toast('There is no frame here.'); return; }
  const later = l.cels.slice(i + 1);
  if (!later.length) { toast('This is the last drawing. It holds to the end of the timeline.'); return; }
  if (d < 0 && celLen(l, l.cels[i]) <= 1) { toast('This drawing is already one frame long.'); return; }
  if (d > 0 && later[later.length - 1].f + 1 >= DUR) { toast('No room to hold longer.'); return; }
  later.forEach((k) => { k.f += d; });
  commit('Change hold');
  refresh(); updateCanvas();
  const n = celLen(l, l.cels[i]);
  toast(`Hold is ${n} frame${n > 1 ? 's' : ''}`, true);
}

export function fbfZoom(d: number) { S.fcw = Math.max(16, Math.min(64, cellW() + d * 6)); renderTL(); reveal(); }
export function fbfNewLayer() { stopPlay(); S.sel = null; S.multi = new Set(); drawTarget(); renderAll(); }

/* ---- gestures on the frame grid ---- */
function pick(id: string) {
  const l = id && lay(id);
  if (!l || l.type !== 'draw' || S.sel === id) return false;
  S.sel = id; S.multi = new Set(); S.keys = [];
  renderRight();
  return true;
}

function scrub(e: PointerEvent) {
  e.preventDefault(); stopPlay();
  const go = (ev: PointerEvent) => {
    const r = $('.fruler'), corner = $('.fruler .corner'), base = r ? r.getBoundingClientRect().left + (corner ? corner.offsetWidth : 0) : 0;
    const f = Math.max(0, Math.min(DUR - 1, Math.floor((ev.clientX - base) / cellW())));
    if (f !== frameNow()) seek(f);
  };
  go(e);
  const up = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
  addEventListener('pointermove', go); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

// With a finger, a short hold lifts the cel so that a quick swipe can still scroll the grid. A mouse or Pencil drags at once.
function dragCel(e: PointerEvent, el: HTMLElement) {
  const l = lay(el.dataset.l), c = l && (l.cels || []).find((k) => k.id === el.dataset.fcel); if (!c) return;
  stopPlay();
  const touch = e.pointerType === 'touch', x0 = e.clientX, y0 = e.clientY, cw = cellW(), f0 = c.f, rect = el.parentElement.getBoundingClientRect();
  let armed = !touch, moved = false, dead = false, hold: ReturnType<typeof setTimeout> | undefined;
  if (touch) hold = setTimeout(() => { armed = true; el.classList.add('lift'); navigator.vibrate?.(8); }, 230);
  const block = (ev: TouchEvent) => { if (armed && ev.cancelable) ev.preventDefault(); };
  const finish = (tap: boolean) => {
    if (dead) return;
    dead = true; clearTimeout(hold); el.classList.remove('lift');
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); el.removeEventListener('touchmove', block);
    if (moved) {
      if (c.f !== f0) { commit('Retime cel'); toast(`Cel moved to frame ${c.f + 1}`, true); }
      refresh();
    } else if (tap) {
      pick(l.id); seek(Math.max(0, Math.min(DUR - 1, Math.floor((x0 - rect.left) / cw)))); refresh();
    }
  };
  const mv = (ev: PointerEvent) => {
    if (!armed) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) finish(false); return; }
    if (!moved && Math.abs(ev.clientX - x0) < 5) return;
    moved = true;
    const nf = Math.max(0, Math.min(DUR - 1, f0 + Math.round((ev.clientX - x0) / cw)));
    if (nf === c.f) return;
    while (c.f !== nf) { // cels it passes swap places with it
      const to = c.f + (nf > c.f ? 1 : -1), other = l.cels.find((k) => k !== c && k.f === to);
      if (other) other.f = c.f;
      c.f = to;
    }
    l.cels.sort((u, v) => u.f - v.f);
    S.sel = l.id;
    seek(nf); placeCels(l);
  };
  const up = () => finish(true), cancel = () => finish(false);
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  el.addEventListener('touchmove', block, { passive: false }); // a touch keeps reporting to the element it started on
}

function dragHold(e: PointerEvent, el: HTMLElement) {
  e.preventDefault(); e.stopPropagation();
  const l = lay(el.dataset.l), i = l ? l.cels.findIndex((k) => k.id === el.dataset.fhold) : -1; if (i < 0) return;
  const later = l.cels.slice(i + 1);
  if (!later.length) { toast('This is the last drawing. It holds to the end of the timeline.'); return; }
  stopPlay();
  const x0 = e.clientX, cw = cellW(), orig = later.map((k) => k.f), len0 = celLen(l, l.cels[i]);
  const mv = (ev: PointerEvent) => {
    const d = Math.max(1 - len0, Math.min(DUR - 1 - orig[orig.length - 1], Math.round((ev.clientX - x0) / cw)));
    if (d !== later[0].f - orig[0]) { later.forEach((k, n) => { k.f = orig[n] + d; }); placeCels(l); updateCanvas(); }
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (later[0].f === orig[0]) return;
    commit('Change hold'); refresh(); updateCanvas();
    const n = celLen(l, l.cels[i]);
    toast(`Hold is ${n} frame${n > 1 ? 's' : ''}`, true);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

function trackTap(e: PointerEvent, track: HTMLElement) {
  const x0 = e.clientX, y0 = e.clientY, id = track.dataset.ftrack;
  const off = () => { removeEventListener('pointerup', up); removeEventListener('pointercancel', off); };
  const up = (ev: PointerEvent) => {
    off();
    if (Math.abs(ev.clientX - x0) >= 8 || Math.abs(ev.clientY - y0) >= 8) return;
    const changed = pick(id); stopPlay();
    const r = ($(`[data-ftrack="${id}"]`) || track).getBoundingClientRect();
    seek(Math.max(0, Math.min(DUR - 1, Math.floor((ev.clientX - r.left) / cellW()))));
    if (changed) renderTL();
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', off);
}

export function listenFbfTimeline() {
  document.addEventListener('pointerdown', (e) => {
    if (!S.fbf) return;
    const t = e.target as HTMLElement;
    if (!t.closest?.('#ftlscroll') || (t.closest('button') && !t.closest('.fh'))) return;
    const h = t.closest<HTMLElement>('[data-fhold]'); if (h) return dragHold(e, h);
    const c = t.closest<HTMLElement>('[data-fcel]'); if (c) return dragCel(e, c);
    const r = t.closest('[data-fscrub]'); if (r) { if (!t.closest('.corner')) scrub(e); return; }
    const tr = t.closest<HTMLElement>('[data-ftrack]'); if (tr) trackTap(e, tr);
  });
}

/** The left strip in the workspace: drawing tools, colour, brush settings, undo and redo. */
export function renderFbfStrips() {
  const t = S.tool;
  $('#lstrip').innerHTML = DRAWMODES.map(([id, n, k]) => `<button class="sb ${t === id ? 'on' : ''}" data-act="pickdraw" data-v="${id}" aria-label="${n}" aria-pressed="${t === id}" title="${n} · ${k}">${ic(id)}</button>`).join('') + `
    <button class="sb" data-act="bcolour" aria-haspopup="dialog" aria-label="Brush colour" title="Colour"><span class="swatch" style="background:${S.brush.c}"></span></button>
    <button class="sb ${S.right === 'fbf' ? 'on' : ''}" data-act="right" data-v="fbf" aria-label="Brush and onion skin settings" aria-pressed="${S.right === 'fbf'}" title="Brush and onion skin settings">${ic('settings')}</button>
    <span class="grow"></span>
    <button class="sb" data-act="undo" aria-label="Undo" title="Undo" ${hi <= 0 ? 'disabled' : ''}>${ic('undo')}</button>
    <button class="sb" data-act="redo" aria-label="Redo" title="Redo" ${hi >= hist.length - 1 ? 'disabled' : ''}>${ic('redo')}</button>`;
  $('#rstrip').innerHTML = '';
}
