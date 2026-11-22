import { SHP } from '../shader/presets';
import { FPS } from '../model/project';

/* ---- effects ---- */
// ps: [key, label, min, max, step per point, unit, default, show?(effect)]
// opts (dropdowns): [key, label, [[value, name], ...], default, show?(effect)]
// cols (colours): [key, label, default, show?(effect)]
const own = (e) => (e.tint || 'own') === 'col';
const linear = (e) => e.style === 'linear';
export const SHADER_FX_PRESETS = () => Object.entries(SHP).map(([k, v]: [string, any]) => [k, v.name]);
export const FXDEF: Record<string, any> = {
  glow: { name: 'Glow', ps: [['radius', 'Radius', 0, 80, .25, '', 18], ['amount', 'Amount', 0, 100, .5, '%', 70]],
    opts: [['tint', 'Colour', [['own', 'Layer colours'], ['col', 'Custom colour']], 'own']], cols: [['col', 'Glow colour', '#ffd166', own]] },
  shadow: { name: 'Drop shadow', ps: [['radius', 'Blur', 0, 80, .25, '', 20], ['amount', 'Opacity', 0, 100, .5, '%', 60], ['dist', 'Distance', 0, 300, .6, '', 10], ['ang', 'Angle', 0, 360, 1, '°', 90]],
    cols: [['col', 'Shadow colour', '#000000']] },
  outline: { name: 'Outline', ps: [['radius', 'Width', 1, 40, .15, '', 6], ['amount', 'Opacity', 0, 100, .5, '%', 100]], cols: [['col', 'Outline colour', '#ffffff']] },
  blur: { name: 'Gaussian blur', ps: [['radius', 'Radius', 0, 80, .25, '', 10]] },
  dirblur: { name: 'Directional blur', ps: [['radius', 'Length', 0, 120, .4, '', 30], ['amount', 'Angle', 0, 180, .5, '°', 0]] },
  ripple: { name: 'Ripple distort', ps: [["amount", "Strength", 0, 100, .4, "", 25], ["radius", "Size", 1, 100, .3, "", 40], ['speed', 'Speed', 0, 100, .5, '', 30]] },
  hue: { name: 'Hue shift', ps: [['amount', 'Angle', 0, 360, 1, '°', 90]] },
  sat: { name: 'Saturation', ps: [['amount', 'Amount', 0, 200, .7, '%', 130]] },
  bright: { name: 'Brightness', ps: [['amount', 'Amount', 0, 200, .7, '%', 120]] },
  bloom: { name: 'Bloom', ps: [['radius', 'Radius', 0, 100, .3, '', 30], ['amount', 'Intensity', 0, 200, .7, '%', 90], ['thresh', 'Threshold', 0, 100, .4, '%', 55]] },
  halftone: { name: 'Halftone', ps: [['radius', 'Dot size', 4, 60, .15, '', 14], ['amount', 'Density', 10, 300, .8, '%', 120]] },
  roughen: { name: 'Roughen edges', ps: [['amount', 'Border', 0, 60, .2, '', 12], ['radius', 'Scale', 1, 100, .3, '', 30], ['speed', 'Evolve', 0, 30, .1, ' fps', 0]],
    opts: [['style', 'Style', [['smooth', 'Smooth'], ['jagged', 'Jagged'], ['torn', 'Torn paper']], 'jagged']] },
  rgbsplit: { name: 'Chromatic aberration', ps: [['radius', 'Amount', 0, 60, .2, '', 8], ['amount', 'Angle', 0, 360, 1, '°', 0, linear]],
    opts: [['style', 'Style', [['lens', 'Lens (from centre)'], ['linear', 'Straight split']], 'lens']] },
  grain: { name: 'Film grain', ps: [['amount', 'Amount', 0, 100, .4, '%', 35], ['radius', 'Size', 1, 100, .3, '', 50]] },
  posterize: { name: 'Posterize colour', ps: [['amount', 'Levels', 2, 16, .06, '', 4]] },
  invert: { name: 'Invert', ps: [['amount', 'Amount', 0, 100, .5, '%', 100]] },
  duotone: { name: 'Duotone', ps: [['hue1', 'Shadow hue', 0, 360, 1, '°', 250], ['hue2', 'Highlight hue', 0, 360, 1, '°', 40], ['amount', 'Mix', 0, 100, .5, '%', 100]] },
  tint: { name: 'Tint', ps: [['hue1', 'Hue', 0, 360, 1, '°', 30], ['amount', 'Amount', 0, 100, .5, '%', 70]] },
  pixelate: { name: 'Pixelate', ps: [['radius', 'Block size', 2, 80, .2, '', 16]] },
  glitch: { name: 'Glitch', ps: [['amount', 'Strength', 0, 100, .4, '%', 60], ['off', 'Offset', 0, 400, 1, '', 60], ['radius', 'Slices', 1, 100, .3, '', 30], ['speed', 'Rate', 0, 30, .1, ' fps', 12]],
    opts: [['style', 'Style', [['slices', 'Slices'], ['blocks', 'Blocks'], ['rgb', 'RGB tear'], ['scan', 'Scanlines']], 'slices']] },
  longshadow: { name: 'Long shadow', ps: [['radius', 'Length', 0, 400, 1, '', 120], ['amount', 'Angle', 0, 360, 1, '°', 45], ['op', 'Opacity', 0, 100, .5, '%', 35]] },
  vignette: { name: 'Vignette', ps: [['amount', 'Amount', 0, 100, .5, '%', 60], ['radius', 'Size', 10, 100, .4, '%', 55]] },
  shader: { name: 'Shader fill', ps: [['speed', 'Speed', 0, 400, 1, '%', 100], ['scale', 'Scale', 20, 400, 1, '%', 100]],
    opts: [['preset', 'Shader', SHADER_FX_PRESETS, 'liquid'], ['blend', 'Blend', [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light']], 'normal']],
    cols: [['c1', 'Colour A', '#4aa8ff'], ['c2', 'Colour B', '#ff5ea8']] },
  postime: { name: 'Posterize time', ps: [['amount', 'Frame rate', 1, 30, .08, ' fps', 8]] },
};
/** Fills in any setting an effect doesn't have yet (new settings added since it was made, or a fresh effect). */
export function fxDefaults(e, force = false) {
  const D = FXDEF[e.id]; if (!D) return e;
  D.ps.forEach(([k, , , , , , def]) => { if (force || e[k] === undefined) e[k] = def; });
  (D.opts || []).forEach(([k, , , def]) => { if (force || e[k] === undefined) e[k] = def; });
  (D.cols || []).forEach(([k, , def]) => { if (force || e[k] === undefined) e[k] = def; });
  if (e.id === 'shader' && (force || !e.c1)) { const P = SHP[e.preset] || SHP.liquid; e.c1 = P.c[0]; e.c2 = P.c[1]; }
  if (force || e.mix === undefined) e.mix = 100;
  return e;
}
export const hsl = (h, s = .75, L = .55) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(L, 1 - L); return [0, 8, 4].map((n) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); };
export const postT = (l, f) => { const e = !l.fxOff && l.fx.find((x) => x.on && x.id === 'postime'); if (!e) return f; const st = FPS / Math.max(1, e.amount || 8); return Math.floor(f / st) * st; };
export const rippleBF = (e) => 0.05 / (1 + (e.radius ?? 30) * 0.12);
/** Effects drawn by the SVG filter chain. Time effects and the shader fill (a canvas inside the layer) are not. */
export const isFilterFx = (e) => e.on && e.id !== 'postime' && e.id !== 'shader';
