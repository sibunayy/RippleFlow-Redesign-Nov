import { lay } from '../../anim/interpolate';
import { S, selIds } from '../../state/state';
import { saveProj } from '../../model/project';
import { renderRight } from '../../ui/inspector/index';
import { FXDEF, fxDefaults } from '../../fx/defs';
import { bakeLayer } from '../../fx/bake';
import { commit } from '../../state/history';
import { buildCanvas, updateFx } from '../../render/stage';
import { toast } from '../../ui/toast';
import { renderPop } from '../../ui/popovers';
import { fxClip, setFxClip } from '../../ui/inspector/effects';
import { renderAll } from '../../ui/layout';

/** Redraws only the changed layers' filters. A Shader fill changes the layer's structure, so that case rebuilds the canvas. */
const hasShader = (l) => l.fx.some((e) => e.id === 'shader');
function redraw(ls, wasShader = false) { if (wasShader || ls.some(hasShader)) buildCanvas(); else ls.forEach((l) => updateFx(l)); }

/** Effects stack. Keys are data-act names. */
export const effectsActions = {
  fxshut: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; e.shut = !e.shut; saveProj(); renderRight(); },
  fxfold: () => { const l = lay(S.sel); if (!l) return; const shut = !l.fx.every((e) => e.shut); l.fx.forEach((e) => { e.shut = shut; }); saveProj(); renderRight(); },
  fxreset: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; fxDefaults(e, true); commit('Reset effect'); redraw([l]); renderRight(); toast(`${e.name} reset`, true); },
  fxmenu: (el) => { const r = el.getBoundingClientRect(); S.pop = { type: 'fxm', i: +el.dataset.v, x: r.right, y: r.bottom }; renderPop(); },
  fxbypass: () => { const l = lay(S.sel); if (!l) return; l.fxOff = !l.fxOff; commit(l.fxOff ? 'Bypass effects' : 'Enable effects'); redraw([l]); renderRight(); },
  fxcopy: () => { const l = lay(S.sel); if (!l || !l.fx.length) return; setFxClip(JSON.parse(JSON.stringify(l.fx))); renderRight(); toast(`Copied ${l.fx.length} effect${l.fx.length > 1 ? 's' : ''}`); },
  fxpaste: () => { if (!fxClip) return; const ls = selIds().map(lay).filter((l) => l && !l.lock); ls.forEach((l) => { l.fx = [...l.fx, ...JSON.parse(JSON.stringify(fxClip))]; }); commit('Paste effects'); redraw(ls); renderAll(); toast(`Pasted ${fxClip.length} effect${fxClip.length > 1 ? 's' : ''}`, true); },
  fxdup: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l || l.fx[i] == null) return; l.fx.splice(i + 1, 0, JSON.parse(JSON.stringify(l.fx[i]))); S.pop = null; commit('Duplicate effect'); redraw([l]); renderAll(); },
  fxmv: (el) => { const l = lay(S.sel), i = S.pop && S.pop.i, j = i + +el.dataset.v; if (!l || j < 0 || j >= l.fx.length) return; const [x] = l.fx.splice(i, 1); l.fx.splice(j, 0, x); S.pop = null; commit('Reorder effects'); redraw([l]); renderAll(); },
  fxsolo: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l) return; l.fx.forEach((e, j) => { e.on = j === i; }); l.fxOff = false; S.pop = null; commit('Solo effect'); redraw([l]); renderAll(); toast(`Only ${l.fx[i].name} is on`, true); },
  addfx: () => { S.pop = { type: 'fx' }; renderPop(); },
  fxadd: (el) => { const l = lay(S.sel); const id = el.dataset.v, D = FXDEF[id], e = fxDefaults({ id, name: D.name, on: true }); l.fx.push(e); S.pop = null; commit('Add effect'); redraw([l]); renderAll(); },
  fxbake: () => { const l = lay(S.sel); if (l) bakeLayer(l); },
  fxon: (el) => { const l = lay(S.sel); const e = l.fx[+el.dataset.v]; e.on = !e.on; commit('Toggle effect'); redraw([l]); renderRight(); },
  fxdel: (el) => { const l = lay(S.sel); const was = hasShader(l); l.fx.splice(+el.dataset.v, 1); S.pop = null; renderPop(); commit('Remove effect'); redraw([l], was); renderRight(); },
};
