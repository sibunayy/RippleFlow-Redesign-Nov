import { selIds } from '../../state/state';
import { TYPE_NAME } from '../left-panel';
import { esc } from '../../core/dom';

/** Inspector header: colour dot, then one line: the layer type, a dash and the layer name (underlined, tap to rename). */
export function inspectorHeader(l, multi) {
  const type = (TYPE_NAME[l.type] || 'Layer') + ' layer';
  const line = multi
    ? `<span class="ity" title="Edits apply to every selected layer">${selIds().length} layers · editing all</span>`
    : `<span class="ity">${type}</span><span class="idash" aria-hidden="true">–</span><input class="lname" id="lname" value="${esc(l.name)}" aria-label="Layer name. Tap to rename" placeholder="Layer name" enterkeyhint="done">`;
  return `<span class="chip-dot" style="background:${l.hue}"></span><div class="idn"><div class="nline">${line}</div></div>`;
}
