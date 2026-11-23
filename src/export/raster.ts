import { compBg, CW, CH } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { stage, updateCanvas } from '../render/stage';
import { postT } from '../fx/defs';
import { fxShaderDims, renderShader, shaderOf } from '../shader/runtime';
import { setExporting } from '../drawing/cels';
import { inlineImages } from '../fx/bake';

/* Draw the composition at frame f into ctx (w x h). */
export async function rasterFrame(f, w, h, ctx, transparent) {
  S.f = f; setExporting(true); updateCanvas();
  const svg = stage.querySelector('svg').cloneNode(true);
  setExporting(false);
  const bg = svg.querySelector(':scope > rect');
  if (bg) { if (transparent) bg.remove(); else { bg.removeAttribute('style'); bg.setAttribute('fill', compBg || getComputedStyle(document.documentElement).getPropertyValue('--comp-bg').trim() || '#15120f'); } }
  svg.querySelectorAll('foreignObject.shfo, foreignObject.shfx').forEach((fo) => {
    const sl = shaderOf(fo), owner = fo.dataset.sh ? sl : lay(String(fo.dataset.fx || '').split('~fx')[0]);
    const rt = sl && owner && owner.vis ? (fo.dataset.sh ? renderShader(sl, postT(owner, f), Math.min(CW, w), Math.min(CH, h), false) : renderShader(sl, postT(owner, f), ...fxShaderDims(), false)) : null;
    if (rt && rt.ok) { const im = document.createElementNS('http://www.w3.org/2000/svg', 'image'); ['x', 'y', 'width', 'height'].forEach((k) => im.setAttribute(k, fo.getAttribute(k))); im.setAttribute('preserveAspectRatio', 'none'); im.setAttribute('href', rt.canvas.toDataURL('image/png')); fo.replaceWith(im); } else fo.remove();
  });
  if (svg.querySelector('image[href^="blob:"]')) await inlineImages(svg); // blob links do not load inside an SVG picture
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', w); svg.setAttribute('height', h);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  } finally { URL.revokeObjectURL(url); }
}
