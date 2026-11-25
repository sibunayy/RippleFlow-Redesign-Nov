import { S } from '../../state/state';
import { renderStrips } from '../../ui/strips';
import { renderFloats } from '../../ui/floats';
import { drawOverlay } from '../../drawing/overlay';

/** Rig tool options. Keys are data-act names. */
export const rigActions = {
  rigmode: (el) => { S.rigMode = el.dataset.v; renderFloats(); drawOverlay(); },
  rigdone: () => { S.tool = 'select'; renderStrips(); renderFloats(); drawOverlay(); },
};
