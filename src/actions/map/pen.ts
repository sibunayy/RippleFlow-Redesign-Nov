import { toast } from '../../ui/toast';
import { penFinish } from '../../gestures/canvas';
import { EDITABLE, peCloseToggle, peDelete, peEnter, peExit, peSetType, peToggle, penClearRedo, penUndo } from '../../gestures/path-edit';
import { S } from '../../state/state';
import { drawOverlay } from '../../drawing/overlay';
import { renderFloats } from '../../ui/floats';
import { lay } from '../../anim/interpolate';
import { commit } from '../../state/history';
import { buildCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';

/** Pen tool and path options. Keys are data-act names. */
export const penActions = {
  pendone: () => penFinish(false),
  penclose: () => penFinish(true),
  penundo: () => penUndo(),
  pencancel: () => { S.penPts = []; penClearRedo(); drawOverlay(); renderFloats(); },
  peedit: () => { const l = lay(S.sel); if (l && EDITABLE.includes(l.type)) peEnter(l); },
  pedone: () => peExit(),
  petype: (el) => (el && el.dataset.v ? peSetType(el.dataset.v) : peToggle()),
  pesplit: () => { S.peSplit = !S.peSplit; renderFloats(); toast(S.peSplit ? 'Separate handles. Dragging a handle moves only that handle.' : 'Handles move together, away from each other'); },
  pedel: () => peDelete(),
  peclose: () => peCloseToggle(),
  // Hand-shaped curves and automatic smoothing are two ways to curve a path, so switching this replaces the hand-shaped ones.
  pathsm: () => { const l: any = lay(S.sel); if (!l) return; l.pts = (l.pts || []).map((p) => [p[0], p[1]]); l.smooth = !l.smooth; commit('Smooth path'); buildCanvas(); renderRight(); },
  pathcl: () => { const l = lay(S.sel); if (!l) return; l.closed = !l.closed; if (!l.closed) l.fill = false; commit('Close path'); buildCanvas(); renderRight(); },
  pathfill: () => { const l = lay(S.sel); if (!l) return; l.fill = !(l.fill === true); commit('Path fill'); buildCanvas(); renderRight(); },
};
