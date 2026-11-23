import { commit, redo, undo } from '../../state/history';
import { S } from '../../state/state';
import { renderTop } from '../../ui/topbar';
import { renderPop } from '../../ui/popovers';
import { renderStrips } from '../../ui/strips';
import { renderDialog } from '../../ui/dialog';
import { exportJob } from '../../export/dialog';
import { A } from '../index';
import { $, app } from '../../core/dom';
import { applyLayout, applyTheme, persist, renderAll } from '../../ui/layout';
import { renderLeft } from '../../ui/left-panel';
import { renderRight } from '../../ui/inspector/index';
import { toast } from '../../ui/toast';
import { DUR, FPS, layers, markers, setDUR } from '../../model/project';
import { buildCanvas, layoutStage } from '../../render/stage';
import { store } from '../../core/store';
import { showLibrary } from '../../library/page';
import { resetOpenProject } from '../../library/projects';
import { czTab, openCustomise, pfColorReset, pfMode, pfPreset, pfResetAll, pfSet, pfToggle } from '../../ui/customise';
import { modKeyToggle } from '../../state/modifier';
import { clearAccent } from '../../ui/prefs';

/** App shell: history, menus, dialogs, panels, theme and settings. Keys are data-act names. */
export const appActions = {
  undo,
  redo,
  mod: (_el, e) => { if (e && e.detail === 0) modKeyToggle(); }, // pointer taps are read in state/modifier.ts; this is the keyboard path
  menu: () => { S.pop = S.pop === 'menu' ? null : 'menu'; renderTop(); renderPop(); },
  insert: () => { S.pop = S.pop === 'insert' ? null : 'insert'; renderStrips(); renderPop(); },
  export: () => { S.dialog = 'export'; S.pop = null; renderPop(); renderDialog(); },
  settings: () => { S.dialog = 'settings'; S.pop = null; renderPop(); renderDialog(); },
  help: () => { S.dialog = 'help'; S.pop = null; renderPop(); renderDialog(); },
  close: () => { S.shDraft = null; S.shImport = false; if (exportJob && exportJob.status === 'run') exportJob.cancel = true; S.dialog = null; renderDialog(); },
  scrimclose: (el, e) => { if (e.target === el) A.close(); },
  left: (el) => { const v = el.dataset.v; S.left = S.left === v ? null : v; if (S.left && app.classList.contains('portrait')) S.right = null; S.pop = null; renderAll(); },
  right: (el) => { const v = el.dataset.v; S.right = S.right === v ? null : v; if (S.right && app.classList.contains('portrait')) S.left = null; if (S.right && !app.classList.contains('portrait') && S.left && app.clientWidth - 96 - 576 < 520) S.left = null; S.pop = null; renderAll(); },
  acat: (el) => { S.acat = el.dataset.v; renderLeft(); },
  cat: (el) => { S.cat = el.dataset.v; renderRight(); },
  info: (el) => { const same = S.pop && S.pop.type === 'info' && S.pop.text === el.dataset.t; if (same) { S.pop = null; renderPop(); return; } const r = el.getBoundingClientRect(); S.pop = { type: 'info', text: el.dataset.t, x: r.left, y: r.bottom, top: r.top }; renderPop(); },
  sec: (el) => { const v = el.dataset.v; S.collapsed.has(v) ? S.collapsed.delete(v) : S.collapsed.add(v); renderRight(); persist(); },
  toast: (el) => toast(el.dataset.v),
  theme: (el) => { S.themePref = el.dataset.v; applyTheme(); renderPop(); },
  glow: () => { S.glow = S.glow === 'soft' ? 'full' : 'soft'; applyTheme(); renderPop(); },
  tint: (el) => { S.tint = el.dataset.v; clearAccent(); applyTheme(); renderPop(); },
  customise: openCustomise,
  cztab: czTab,
  pfset: pfSet,
  pftog: pfToggle,
  pfmode: pfMode,
  pfpreset: pfPreset,
  pfcolorreset: pfColorReset,
  pfresetall: pfResetAll,
  perf: () => { S.perf = !S.perf; $('#hud').hidden = !S.perf; $('#hud').textContent = `60 fps · ${layers.length} layers · frame ${Math.floor(S.f)}`; renderPop(); },
  mb: () => { S.mb = !S.mb; renderPop(); toast(S.mb ? 'Motion blur preview on' : 'Motion blur preview off'); },
  pp: () => { S.portraitPreview = !S.portraitPreview; S.pop = null; renderAll(); setTimeout(() => { applyLayout(); layoutStage(); }, 260); },
  autofold: () => { S.autoFold = !S.autoFold; store.set('autofold', S.autoFold); renderPop(); },
  setdur: (el) => {
    const old = DUR; setDUR(+el.dataset.v * FPS);
    layers.forEach((l) => { if (l.outP != null && (l.outP >= old || l.outP > DUR)) delete l.outP; if (l.inP != null && l.inP >= DUR) l.inP = 0; });
    markers.forEach((m) => { m.f = Math.min(m.f, DUR - 1); });
    S.wa = [0, DUR]; S.f = Math.min(S.f, DUR - 1);
    commit('Duration'); buildCanvas(); renderAll(); renderDialog(); toast(`Duration ${DUR / FPS} s`);
  },
  library: () => showLibrary(),
  resetproj: () => { if (!S.resetArm) { S.resetArm = true; renderDialog(); return; } if (resetOpenProject()) return; try { localStorage.removeItem('rfp-project'); } catch { /* ignore */ } location.reload(); },
};
