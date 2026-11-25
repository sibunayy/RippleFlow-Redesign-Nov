import { grid2, pf } from './controls';
import { capJoin, chip, dashF, gradUi, grpHead, trimRow } from './paint';

/** Shape layers (rect, ellipse, polygon, star, line, ring): geometry; Fill & stroke or Stroke. */
export function shapeContent(l) {
  let look, title, paint, paintTitle;
  const P = { rect: [['w', 'Width', 10, 1800, 1.5], ['h', 'Height', 10, 1200, 1.5], ['cr', 'Corner', 0, 200, .5]], ellipse: [['r', 'Radius', 2, 600, 1]], ring: [['r', 'Radius', 2, 600, 1]], star: [['n', 'Points', 3, 12, .08, '', 1], ['ir', 'Inner', 5, 95, .3, '%']], polygon: [['n', 'Sides', 3, 12, .08, '', 1]], line: [['w', 'Length', 20, 1800, 1.5]] }[l.type];
  const strokeOnly = l.type === 'ring' || l.type === 'line';
  if (!l.sc) l.sc = '#ffffff';
  title = 'Shape';
  look = grid2(P.map(([k, lb, mn, mx, sp, u, int]) => pf(l, 'lp', 0, k, lb, mn, mx, sp, u || '', !!int)));
  paintTitle = strokeOnly ? 'Stroke' : 'Fill & stroke';
  const strokeBody = `<div class="fillrow">${chip(l, 'Stroke', strokeOnly ? 'hue' : 'sc')}${pf(l, 'lp', 0, 'sop', 'Opacity', 0, 100, .5, '%', true)}</div>`
    + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 80, .2)].concat(dashF(l), strokeOnly ? [] : capJoin(l))) + trimRow(l);
  paint = strokeOnly ? strokeBody
    : grpHead('Fill', 'fillon', l.fill !== false) + (l.fill !== false ? `<div class="fillrow">${chip(l, 'Fill', 'hue')}${pf(l, 'lp', 0, 'fop', 'Opacity', 0, 100, .5, '%', true)}</div>` + gradUi(l) : '')
      + `<div class="sublbl">Stroke</div>` + strokeBody;
  return { title, look, paint, paintTitle };
}

/** Rubber hose: thickness and colours. The pose comes from its joints, which are dragged on the canvas. */
export function hoseContent(l) {
  if (!l.sc) l.sc = '#1b1410';
  const look = `<p class="hint" style="padding:0">Drag a joint on the canvas to pose the hose. Hand joints swing the bone above them. The hose follows its joints, so move or turn the top joint to move it.</p>`
    + grid2([pf(l, 'lp', 0, 'w', 'Thickness', 4, 300, .5)]);
  const paint = `<div class="fillrow">${chip(l, 'Colour', 'hue')}</div><div class="sublbl">Outline</div><div class="fillrow">${chip(l, 'Outline', 'sc')}</div>` + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 40, .2)]);
  return { title: 'Rubber hose', look, paint, paintTitle: 'Colour & outline' };
}
