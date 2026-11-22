import { hsl, isFilterFx, rippleBF } from './defs';
import { CH, CW } from '../model/project';

/* A small PNG whose red channel runs left to right and green top to bottom. Used as a displacement map, it scales
   the image about its centre, which gives the lens-style chromatic aberration. A raster PNG (not SVG) is used because
   Safari draws PNG images inside filters reliably. */
let lensMap = '';
function lensPng() {
  if (lensMap) return lensMap;
  try {
    const n = 64, cv = document.createElement('canvas'); cv.width = n; cv.height = n; const g = cv.getContext('2d'); if (!g) return '';
    const im = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4; im.data[o] = Math.round(x / (n - 1) * 255); im.data[o + 1] = Math.round(y / (n - 1) * 255); im.data[o + 2] = 128; im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0); lensMap = cv.toDataURL('image/png');
  } catch { lensMap = ''; }
  return lensMap;
}
// Error function (Abramowitz and Stegun 7.1.26), for the halftone dot field.
const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + .3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-a * a)); };
// Brightness of a blurred grid of square dots (size d, spacing c, blur s) at offset x from a dot centre, along one axis.
const dotField = (x, c, d, s) => { let v = 0; for (let i = -4; i <= 4; i++) v += .5 * (erf((x - i * c + d / 2) / (Math.SQRT2 * s)) - erf((x - i * c - d / 2) / (Math.SQRT2 * s))); return v; };
// Seeded random numbers, so a glitch looks the same every time it is drawn.
const rnd = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const f3 = (v) => (+v).toFixed(3);

// Pixel-grid effects (pixelate, halftone) need absolute positions, so they use the composition area plus a margin
// as their filter area. It is kept small on purpose: Safari skips a filter whose area is too large to allocate.
const compRegion = () => `filterUnits="userSpaceOnUse" x="-240" y="-240" width="${CW + 480}" height="${CH + 480}"`;

/** The layer's filter. `box` (a local area) is used when baking: the filter then covers exactly that area. */
export function fxDefs(l, box = null) {
  const X0 = box ? box.x : -240, Y0 = box ? box.y : -240, CX = box ? box.x + box.w / 2 : CW / 2, CY = box ? box.y + box.h / 2 : CH / 2;
  let out = '';
  if (l.type === 'shader') out += `<radialGradient id="shd-${l.id}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${l.hue}"/><stop offset=".55" stop-color="#0f2a4a"/><stop offset="1" stop-color="#0c0a08"/></radialGradient>`;
  const on = l.fxOff ? [] : l.fx.map((e, j) => [e, j]).filter(([e]) => isFilterFx(e));
  if (!on.length) return out;
  let body = '', src = 'SourceGraphic', reach = 0; // reach: how far (in px) an effect pushes pixels outside the layer
  on.forEach(([e, j], i) => {
    const R = e.radius ?? 10, A = e.amount ?? 50;
    if (e.id === 'glow') {
      const k = (A / 50).toFixed(2);
      if ((e.tint || 'own') === 'col') body += `<feGaussianBlur in="${src}" stdDeviation="${R / 2}" result="b${i}"/><feFlood flood-color="${e.col || '#ffd166'}" result="gf${i}"/><feComposite in="gf${i}" in2="b${i}" operator="in" result="gc${i}"/><feColorMatrix in="gc${i}" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${k} 0" result="c${i}"/><feMerge result="r${i}"><feMergeNode in="c${i}"/><feMergeNode in="${src}"/></feMerge>`;
      else body += `<feGaussianBlur in="${src}" stdDeviation="${R / 2}" result="b${i}"/><feColorMatrix in="b${i}" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${k} 0" result="c${i}"/><feMerge result="r${i}"><feMergeNode in="c${i}"/><feMergeNode in="${src}"/></feMerge>`;
    }
    else if (e.id === 'blur') body += `<feGaussianBlur in="${src}" stdDeviation="${R / 3}" result="r${i}"/>`;
    else if (e.id === 'shadow') {
      const d = e.dist ?? R / 2, a = (e.ang ?? 90) * Math.PI / 180;
      body += `<feDropShadow in="${src}" dx="${(Math.cos(a) * d).toFixed(1)}" dy="${(Math.sin(a) * d).toFixed(1)}" stdDeviation="${R / 2}" flood-color="${e.col || '#000000'}" flood-opacity="${A / 100}" result="r${i}"/>`;
      reach = Math.max(reach, d);
    }
    else if (e.id === 'outline') body += `<feMorphology in="${src === 'SourceGraphic' ? 'SourceAlpha' : src}" operator="dilate" radius="${R}" result="d${i}"/><feFlood flood-color="${e.col || '#ffffff'}" flood-opacity="${A / 100}" result="fl${i}"/><feComposite in="fl${i}" in2="d${i}" operator="in" result="o${i}"/><feMerge result="r${i}"><feMergeNode in="o${i}"/><feMergeNode in="${src}"/></feMerge>`;
    else if (e.id === 'dirblur') { const a = A * Math.PI / 180; body += `<feGaussianBlur in="${src}" stdDeviation="${(R * Math.abs(Math.cos(a)) / 3).toFixed(2)} ${(R * Math.abs(Math.sin(a)) / 3).toFixed(2)}" result="r${i}"/>`; }
    else if (e.id === 'ripple') { const bf = rippleBF(e); body += `<feTurbulence id="rt-${l.id}-${j}" type="fractalNoise" baseFrequency="${bf.toFixed(5)}" numOctaves="1" seed="3" result="t${i}"/><feDisplacementMap in="${src}" in2="t${i}" scale="${(A * 0.9).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`; }
    else if (e.id === 'hue') body += `<feColorMatrix in="${src}" type="hueRotate" values="${A}" result="r${i}"/>`;
    else if (e.id === 'sat') body += `<feColorMatrix in="${src}" type="saturate" values="${(A / 100).toFixed(2)}" result="r${i}"/>`;
    else if (e.id === 'bright') { const s = (A / 100).toFixed(2); body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="linear" slope="${s}"/><feFuncG type="linear" slope="${s}"/><feFuncB type="linear" slope="${s}"/></feComponentTransfer>`; }
    else if (e.id === 'bloom') { const th = (e.thresh ?? 55) / 100, sl = 1 / Math.max(.02, 1 - th); body += `<feComponentTransfer in="${src}" result="bt${i}"><feFuncR type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/><feFuncG type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/><feFuncB type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/></feComponentTransfer><feGaussianBlur in="bt${i}" stdDeviation="${(R / 2).toFixed(1)}" result="bb${i}"/><feComposite in="bb${i}" in2="${src}" operator="arithmetic" k2="${(A / 100).toFixed(2)}" k3="1" result="r${i}"/>`; }
    else if (e.id === 'halftone') {
      // A grid of soft round dots is made from one small square (tiled, then blurred) and compared with the layer's
      // brightness: brighter areas get bigger dots (they never merge into a solid area). No external image is needed.
      const c = Math.max(4, Math.round(R)), d = c * .5, s = c * .28, x0 = X0, y0 = Y0;
      const hi = dotField(0, c, d, s) ** 2, lo = dotField(c / 2, c, d, s) ** 2, sl = 1 / Math.max(1e-4, hi - lo), k = A / 100;
      body += `<feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0" result="hl${i}"/><feComposite in="hl${i}" in2="${src}" operator="in" result="hm${i}"/>`
        + `<feFlood x="${f3(x0 + (c - d) / 2)}" y="${f3(y0 + (c - d) / 2)}" width="${f3(d)}" height="${f3(d)}" flood-color="#000" result="hf${i}"/><feOffset in="hf${i}" x="${x0}" y="${y0}" width="${c}" height="${c}" result="hc${i}"/><feTile in="hc${i}" result="htl${i}"/>`
        + `<feGaussianBlur in="htl${i}" stdDeviation="${f3(s)}" result="hb${i}"/><feComponentTransfer in="hb${i}" result="ht${i}"><feFuncA type="linear" slope="${f3(sl)}" intercept="${f3(-lo * sl)}"/></feComponentTransfer>`
        + `<feComposite in="ht${i}" in2="hm${i}" operator="arithmetic" k2="1" k3="${f3(.32 * k)}" k4="-.97" result="hs${i}"/><feComponentTransfer in="hs${i}" result="hd${i}"><feFuncA type="linear" slope="14" intercept="0"/></feComponentTransfer><feComposite in="${src}" in2="hd${i}" operator="in" result="r${i}"/>`;
    }
    else if (e.id === 'roughen') {
      const st = e.style || 'jagged', bf = 0.4 / (1 + (R * .2));
      if (st === 'smooth') body += `<feTurbulence id="rf-${l.id}-${j}" type="fractalNoise" baseFrequency="${(bf * .6).toFixed(4)}" numOctaves="1" seed="1" result="rn${i}"/><feDisplacementMap in="${src}" in2="rn${i}" scale="${A}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`;
      else if (st === 'torn') body += `<feTurbulence id="rf-${l.id}-${j}" type="turbulence" baseFrequency="${(bf * 1.6).toFixed(4)}" numOctaves="4" seed="1" result="rn${i}"/><feComponentTransfer in="rn${i}" result="rq${i}"><feFuncR type="discrete" tableValues="0 .2 .45 .55 .8 1"/><feFuncG type="discrete" tableValues="0 .3 .5 .7 1"/></feComponentTransfer><feDisplacementMap in="${src}" in2="rq${i}" scale="${(A * 1.2).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="rd${i}"/><feComponentTransfer in="rd${i}" result="r${i}"><feFuncA type="linear" slope="3" intercept="-1"/></feComponentTransfer>`;
      else body += `<feTurbulence id="rf-${l.id}-${j}" type="turbulence" baseFrequency="${bf.toFixed(4)}" numOctaves="2" seed="1" result="rn${i}"/><feDisplacementMap in="${src}" in2="rn${i}" scale="${A}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`;
    }
    else if (e.id === 'rgbsplit') {
      const red = (x) => `<feColorMatrix in="${x}" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cr${i}"/>`;
      const grn = `<feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cg${i}"/>`;
      const blu = (x) => `<feColorMatrix in="${x}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cb${i}"/>`;
      const join = `<feComposite in="cr${i}" in2="cg${i}" operator="arithmetic" k2="1" k3="1" result="rg${i}"/><feComposite in="rg${i}" in2="cb${i}" operator="arithmetic" k2="1" k3="1" result="r${i}"/>`;
      const map = e.style === 'linear' ? '' : lensPng();
      if (map) {
        // Lens: red is pulled out from the centre and blue pushed in, more towards the edges.
        const s = (-R * 3).toFixed(1);
        body += `<feImage href="${map}" preserveAspectRatio="none" result="lm${i}"/><feDisplacementMap in="${src}" in2="lm${i}" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="sr${i}"/><feDisplacementMap in="${src}" in2="lm${i}" scale="${-(+s)}" xChannelSelector="R" yChannelSelector="G" result="sb${i}"/>` + red(`sr${i}`) + grn + blu(`sb${i}`) + join;
      } else {
        const a = A * Math.PI / 180, dx = (R * Math.cos(a)).toFixed(1), dy = (R * Math.sin(a)).toFixed(1);
        body += `<feOffset in="${src}" dx="${dx}" dy="${dy}" result="sr${i}"/><feOffset in="${src}" dx="${-dx}" dy="${-dy}" result="sb${i}"/>` + red(`sr${i}`) + grn + blu(`sb${i}`) + join;
      }
    }
    else if (e.id === 'grain') body += `<feTurbulence id="rf-${l.id}-${j}" type="fractalNoise" baseFrequency="${(2.2 / (1 + R * .06)).toFixed(3)}" numOctaves="1" seed="1" result="gn${i}"/><feColorMatrix in="gn${i}" type="saturate" values="0" result="gg${i}"/><feComposite in="gg${i}" in2="${src}" operator="in" result="gi${i}"/><feComposite in="gi${i}" in2="${src}" operator="arithmetic" k2="${(A / 100 * 1.4).toFixed(2)}" k3="1" k4="${(-A / 100 * .7).toFixed(3)}" result="gm${i}"/><feComposite in="gm${i}" in2="${src}" operator="in" result="r${i}"/>`;
    else if (e.id === 'posterize') { const n = Math.max(2, Math.round(A)), tv = Array.from({ length: n }, (_, k) => (k / (n - 1)).toFixed(3)).join(' '); body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="discrete" tableValues="${tv}"/><feFuncG type="discrete" tableValues="${tv}"/><feFuncB type="discrete" tableValues="${tv}"/></feComponentTransfer>`; }
    else if (e.id === 'invert') { const k = A / 100; body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="table" tableValues="${k} ${1 - k}"/><feFuncG type="table" tableValues="${k} ${1 - k}"/><feFuncB type="table" tableValues="${k} ${1 - k}"/></feComponentTransfer>`; }
    else if (e.id === 'duotone') { const a = hsl(e.hue1 ?? 250, .7, .2), b = hsl(e.hue2 ?? 40, .9, .75), m = A / 100; body += `<feColorMatrix in="${src}" type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="dl${i}"/><feComponentTransfer in="dl${i}" result="dt${i}">${['R', 'G', 'B'].map((c, k) => `<feFunc${c} type="table" tableValues="${a[k].toFixed(3)} ${b[k].toFixed(3)}"/>`).join('')}</feComponentTransfer><feComposite in="dt${i}" in2="${src}" operator="arithmetic" k2="${m}" k3="${(1 - m).toFixed(3)}" result="r${i}"/>`; }
    else if (e.id === 'tint') { const c = hsl(e.hue1 ?? 200, .8, .55), m = A / 100, row = (k) => [0, 1, 2].map((j) => ((1 - m) * (j === k ? 1 : 0) + m * c[k] * [.2126, .7152, .0722][j] * 1.6).toFixed(3)).join(' ') + ' 0 0'; body += `<feColorMatrix in="${src}" type="matrix" values="${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0" result="r${i}"/>`; }
    else if (e.id === 'pixelate') {
      // One sample square per block (a fifth of the block, so it survives Safari drawing the filter at a lower
      // resolution when zoomed out), grown slightly past the block so no gaps show when Safari rounds the size at low zoom.
      const c = Math.max(2, Math.round(R)), d = Math.max(1, c * .2), x0 = X0, y0 = Y0;
      body += `<feFlood x="${f3(x0 + (c - d) / 2)}" y="${f3(y0 + (c - d) / 2)}" width="${f3(d)}" height="${f3(d)}" flood-color="#000" result="pf${i}"/><feOffset in="pf${i}" x="${x0}" y="${y0}" width="${c}" height="${c}" result="pc${i}"/><feTile in="pc${i}" result="pt${i}"/><feComposite in="${src}" in2="pt${i}" operator="in" result="pi${i}"/><feMorphology in="pi${i}" operator="dilate" radius="${f3((c - d) / 2 + Math.max(.5, c * .08))}" result="r${i}"/>`;
    }
    else if (e.id === 'glitch') {
      // Horizontal slices (or blocks) jump sideways. Strength is how many slices move, Offset how far they go.
      const st = e.style || 'slices', n = 17, str = Math.max(0, Math.min(1, A / 100)), seed = 7 + j * 13;
      const tbl = Array.from({ length: n }, (_, k) => (rnd(seed + k) < str ? rnd(seed + k + 50).toFixed(2) : '.5')).join(' ');
      const tblY = st === 'blocks' ? Array.from({ length: n }, (_, k) => (rnd(seed + k + 90) < str * .6 ? (.3 + rnd(seed + k + 120) * .4).toFixed(2) : '.5')).join(' ') : '.5';
      const fy = (0.2 / (1 + R * .15)).toFixed(4), fx = st === 'blocks' ? (0.04 / (1 + R * .15)).toFixed(4) : '0', sc = ((e.off ?? 60) * 2).toFixed(0);
      body += `<feTurbulence id="rf-${l.id}-${j}" type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="1" seed="1" result="gn${i}"/><feComponentTransfer in="gn${i}" result="gs${i}"><feFuncR type="discrete" tableValues="${tbl}"/><feFuncG type="discrete" tableValues="${tblY}"/></feComponentTransfer>`;
      if (st === 'rgb') body += `<feDisplacementMap in="${src}" in2="gs${i}" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="ga${i}"/><feDisplacementMap in="${src}" in2="gs${i}" scale="${-(+sc) * .6}" xChannelSelector="R" yChannelSelector="G" result="gb${i}"/><feColorMatrix in="ga${i}" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="gc${i}"/><feColorMatrix in="gb${i}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gd${i}"/><feComposite in="gc${i}" in2="gd${i}" operator="arithmetic" k2="1" k3="1" result="r${i}"/>`;
      else if (st === 'scan') body += `<feDisplacementMap in="${src}" in2="gs${i}" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="ga${i}"/><feTurbulence type="fractalNoise" baseFrequency="0 .35" numOctaves="1" seed="4" result="gl${i}"/><feComponentTransfer in="gl${i}" result="gk${i}"><feFuncA type="discrete" tableValues="1 1 .35 1 1 1 .5 1"/></feComponentTransfer><feComposite in="ga${i}" in2="gk${i}" operator="in" result="r${i}"/>`;
      else body += `<feDisplacementMap in="${src}" in2="gs${i}" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`;
      reach = Math.max(reach, e.off ?? 60);
    }
    else if (e.id === 'longshadow') { const n = Math.max(4, Math.min(48, Math.round(R / 4))), a = A * Math.PI / 180; let offs = ''; for (let k = 1; k <= n; k++) offs += `<feOffset in="SourceAlpha" dx="${(Math.cos(a) * R * k / n).toFixed(1)}" dy="${(Math.sin(a) * R * k / n).toFixed(1)}" result="lo${i}_${k}"/>`; body += offs + `<feMerge result="lm${i}">${Array.from({ length: n }, (_, k) => `<feMergeNode in="lo${i}_${k + 1}"/>`).join('')}</feMerge><feFlood flood-color="#000" flood-opacity="${((e.op ?? 35) / 100).toFixed(2)}" result="lf${i}"/><feComposite in="lf${i}" in2="lm${i}" operator="in" result="ls${i}"/><feMerge result="r${i}"><feMergeNode in="ls${i}"/><feMergeNode in="${src}"/></feMerge>`; reach = Math.max(reach, R); }
    else if (e.id === 'vignette') {
      // A light above the centre of the composition falls off towards the corners; that falloff darkens the layer.
      // Built with filter lighting, so there is no image to load and no oversized filter area.
      const z = 150 + Math.max(10, Math.min(100, R)) * 30, ic = z / Math.hypot(CW / 2, CH / 2, z), g = 1 / Math.max(.05, 1 - ic), k = A / 100;
      body += `<feDiffuseLighting in="SourceAlpha" surfaceScale="0" diffuseConstant="1" lighting-color="#fff" result="vl${i}"><fePointLight x="${CX}" y="${CY}" z="${z}"/></feDiffuseLighting>`
        + `<feColorMatrix in="vl${i}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${f3(-g * k)} 0 0 0 ${f3(g * k)}" result="va${i}"/><feComposite in="va${i}" in2="SourceAlpha" operator="in" result="vi${i}"/><feMerge result="r${i}"><feMergeNode in="${src}"/><feMergeNode in="vi${i}"/></feMerge>`;
    }
    else body += `<feOffset in="${src}" dx="0" dy="0" result="r${i}"/>`;
    const mx = (e.mix ?? 100) / 100;
    if (mx < .995) { body += `<feComposite in="r${i}" in2="${src}" operator="arithmetic" k2="${mx.toFixed(3)}" k3="${(1 - mx).toFixed(3)}" result="mx${i}"/>`; src = 'mx' + i; return; }
    src = 'r' + i;
  });
  const reg = box ? `filterUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"` : on.some(([e]) => ['halftone', 'pixelate'].includes(e.id)) ? compRegion() : reach > 120 ? 'x="-100%" y="-100%" width="300%" height="300%"' : reach > 40 ? 'x="-75%" y="-75%" width="250%" height="250%"' : 'x="-50%" y="-50%" width="200%" height="200%"';
  return out + `<filter id="fx-${l.id}" ${reg} color-interpolation-filters="sRGB">${body}</filter>`;
}
