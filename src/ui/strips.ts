import { $ } from '../core/dom';
import { ic } from './icons';
import { DRAWMODES, S, SELMODES, isDrawTool } from '../state/state';
import { hi, hist } from '../state/history';
import { modBtnHtml } from '../state/modifier';
import { renderFbfStrips } from '../drawing/fbf-timeline';

/* ---------- render: strips ---------- */
const TOOLS = [['select', 'Select', 'V'], ['hand', 'Hand', 'H'], ['pen', 'Pen', 'P']];
export const SHAPES = [['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'E'], ['polygon', 'Polygon', 'Y'], ['star', 'Star', 'S'], ['line', 'Line', 'L'], ['hose', 'Rubber hose', 'U']];
export function renderStrips() {
  if (S.fbf) return renderFbfStrips();
  const t = S.tool;
  $('#lstrip').innerHTML = `
    <button class="sb ${t === 'select' ? 'on' : ''}" id="selbtn" data-act="tool" data-v="select" aria-label="Select" aria-pressed="${t === 'select'}" title="Select · V">${ic('select')}</button>
    <button class="sb ${t === 'marquee' || t === 'lasso' ? 'on' : ''}" id="areabtn" data-act="tool" data-v="${S.areaMode}" aria-label="${SELMODES.find((m) => m[0] === S.areaMode)[1]} (hold for marquee and lasso)" aria-pressed="${t === 'marquee' || t === 'lasso'}" title="${S.areaMode === 'lasso' ? 'Lasso · Q' : 'Marquee · M'} · hold for more">${ic(S.areaMode)}<span class="more"></span></button>
    ${TOOLS.slice(1).map(([id, n, k]) => `<button class="sb ${t === id ? 'on' : ''}" data-act="tool" data-v="${id}" aria-label="${n}" aria-pressed="${t === id}" title="${n} · ${k}">${ic(id)}</button>`).join('')}
    <button class="sb ${SHAPES.some((s) => s[0] === t) ? 'on' : ''}" id="shapebtn" data-act="tool" data-v="${S.shape}" aria-label="${SHAPES.find((s) => s[0] === S.shape)[1]} (hold for more shapes)" aria-pressed="${t === S.shape}" title="Shapes · hold for more">${ic(S.shape)}<span class="more"></span></button>
    <button class="sb ${t === 'text' ? 'on' : ''}" data-act="tool" data-v="text" aria-label="Text" aria-pressed="${t === 'text'}" title="Text · T">${ic('text')}</button>
    <button class="sb ${t === 'rig' ? 'on' : ''}" data-act="tool" data-v="rig" aria-label="Rig" aria-pressed="${t === 'rig'}" title="Rig · J">${ic('rig')}</button>
    <button class="sb ${isDrawTool(t) ? 'on' : ''}" id="brushbtn" data-act="tool" data-v="${S.drawMode}" aria-label="${DRAWMODES.find((m) => m[0] === S.drawMode)[1]} (hold for brush, draw and fill, eraser and fill bucket)" aria-pressed="${isDrawTool(t)}" title="Draw · hold for Brush, Draw &amp; fill, Eraser, Fill">${ic(S.drawMode)}<span class="more"></span></button>
    <span class="grow"></span>
    ${modBtnHtml(ic('shift'))}
    <button class="sb" data-act="undo" aria-label="Undo" title="Undo" ${hi <= 0 ? 'disabled' : ''}>${ic('undo')}</button>
    <button class="sb" data-act="redo" aria-label="Redo" title="Redo" ${hi >= hist.length - 1 ? 'disabled' : ''}>${ic('redo')}</button>
    <span class="sep"></span>
    <button class="sb insert" data-act="insert" aria-label="Insert" aria-haspopup="dialog" aria-expanded="${S.pop === 'insert'}" title="Insert layer, shape or media">${ic('plus')}</button>`;
  const hasKeys = S.keys.length > 0;
  $('#rstrip').innerHTML = `
    ${[['props', 'Properties', 'props'], ['effects', 'Effects', 'effects'], ['dup', 'Duplicator', 'copy'], ['presets', 'Presets', 'presets']].map(([id, n, icn]) => `<button class="sb ${S.right === id ? 'on' : ''}" data-act="right" data-v="${id}" aria-label="${n}" aria-pressed="${S.right === id}" title="${n}">${ic(icn)}</button>`).join('')}
    <span class="grow"></span>
    <button class="sb ${S.pop && S.pop.type === 'align' && S.pop.from === 'rstrip' ? 'on' : ''}" data-act="align" aria-haspopup="dialog" aria-label="Align" title="Align to composition or selection">${ic('alC')}</button>
    <button class="sb ${S.right === 'easing' ? 'on' : ''}" data-act="right" data-v="easing" aria-label="Easing" aria-pressed="${S.right === 'easing'}" title="Easing">${ic('easing')}${hasKeys ? '<span class="dot"></span>' : ''}</button>
    ${[['assets', 'Assets'], ['layers', 'Layers']].map(([id, n]) => `<button class="sb ${S.left === id ? 'on' : ''}" data-act="left" data-v="${id}" aria-label="${n}" aria-pressed="${S.left === id}" title="${n}">${ic(id)}</button>`).join('')}
    <button class="sb" data-act="help" aria-label="Help and shortcuts" title="Help">${ic('help')}</button>`;
}
