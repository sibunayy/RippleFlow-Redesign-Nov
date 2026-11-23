import { propRow } from './controls';
import { ic } from '../icons';
import { S } from '../../state/state';

/** Transform section: layer switches (hide, lock, solo), position, scale, rotation, anchor; flip and reset. Align is a pop-out in the right strip. */
export function transformSection(l, multi) {
  const sw = (act, on, icn, lbl) => `<button class="ib sm ${on ? 'on' : ''}" data-act="${act}" data-v="${l.id}" aria-pressed="${on}" aria-label="${lbl}" title="${lbl}">${ic(icn, 'xs')}</button>`;
  const switches = `<div class="lsw" role="group" aria-label="Layer switches"><span>Layer</span>`
    + sw('vis', !l.vis, l.vis ? 'eye' : 'eyeoff', l.vis ? 'Hide layer' : 'Show layer')
    + sw('lock', !!l.lock, l.lock ? 'lock' : 'unlock', l.lock ? 'Unlock layer' : 'Lock layer')
    + sw('solo', S.solo.has(l.id), 'solo', S.solo.has(l.id) ? 'Stop soloing' : 'Solo: show only this layer') + `</div>`;
  const tf = switches + ['pos', 'scale', 'rot', 'anchor'].map((g) => propRow(l, g)).join('')
    + `<div class="three"><button class="line-btn" data-act="flipx" aria-pressed="${!!l.flipX}" title="Flip horizontal">${ic('flipH', 's')}Flip H</button><button class="line-btn" data-act="flipy" aria-pressed="${!!l.flipY}" title="Flip vertical">${ic('flipV', 's')}Flip V</button><button class="line-btn" data-act="tfreset" title="Reset position, scale, rotation and opacity">${ic('reset', 's')}Reset</button></div>`;
  return tf;
}
