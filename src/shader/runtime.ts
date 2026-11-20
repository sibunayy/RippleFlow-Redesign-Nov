import { $$ } from '../core/dom';
import { FPS, layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { buildCanvas, stage, updateCanvas } from '../render/stage';
import { SH, SHP, SH_GLSL_POST, SH_GLSL_PRE, SH_WGSL_POST, SH_WGSL_PRE, shLang, shPresetCode } from './presets';
import { renderRight } from '../ui/inspector/index';
import { renderDialog } from '../ui/dialog';

export let gpuState = (navigator as any).gpu ? 'pending' : 'none', gpuDev = null, gpuFmt = null;
if ((navigator as any).gpu) {
  (navigator as any).gpu.requestAdapter().then((a) => (a ? a.requestDevice() : null)).then((d) => {
    gpuDev = d; gpuState = d ? 'ok' : 'none'; if (d) { gpuFmt = (navigator as any).gpu.getPreferredCanvasFormat(); d.lost.then(() => { gpuState = 'none'; gpuDev = null; }); }
    if (layers.some((l) => l.type === 'shader' || l.fx.some((e) => e.id === 'shader'))) { for (const k in SH) delete SH[k]; buildCanvas(); renderRight(); }
  }).catch(() => { gpuState = 'none'; });
}
export function shSource(l) {
  if (l.code) return { lang: shLang(l.code), code: l.code };
  const lang = gpuState === 'ok' ? 'wgsl' : 'glsl';
  return { lang, code: shPresetCode(l.preset || 'liquid', lang) };
}
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
function shUniforms(l, f, w, h) {
  const t = Math.max(0, f - (l.inP ?? 0)) / FPS * ((l.spd ?? 100) / 100);
  return { w, h, t, frame: Math.round(f), params: [l.sp0 ?? .5, l.sp1 ?? .5, l.sp2 ?? .5, l.sp3 ?? .5], c1: hexRgb(l.hue), c2: hexRgb(l.hue2 || '#ff5ea8'), opaque: l.opaque === false ? 0 : 1 };
}
let shNoiseData = null;
function shNoise() { if (!shNoiseData) { shNoiseData = new Uint8Array(256 * 256 * 4); let s = 1234567; for (let i = 0; i < shNoiseData.length; i++) { s = (s * 1103515245 + 12345) >>> 0; shNoiseData[i] = s >>> 24; } } return shNoiseData; }
function shBuildGl(rt, code) {
  const gl = rt.canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
  if (!gl) { rt.err = 'This browser cannot run GLSL shaders (WebGL2 is unavailable).'; return; }
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = mk(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }');
  const pre = SH_GLSL_PRE.split('\n').length - 1, fs = mk(gl.FRAGMENT_SHADER, SH_GLSL_PRE + code + SH_GLSL_POST);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    rt.err = (gl.getShaderInfoLog(fs) || 'Compile error').split('\n').filter(Boolean).slice(0, 6).map((ln) => ln.replace(/ERROR: 0:(\d+):/, (m, n) => `Line ${Math.max(1, n - pre)}:`)).join('\n');
    return;
  }
  const pg = gl.createProgram(); gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.bindAttribLocation(pg, 0, 'p'); gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { rt.err = gl.getProgramInfoLog(pg) || 'Link error'; return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, shNoise());
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const U: any = {}; ['iResolution', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iMouse', 'iDate', 'iParams', 'iColor1', 'iColor2', 'iOpaque', 'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3', 'iChannelResolution', 'iSampleRate'].forEach((n) => { U[n] = gl.getUniformLocation(pg, n); });
  rt.draw = (q) => {
    gl.viewport(0, 0, q.w, q.h); gl.useProgram(pg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let k = 0; k < 4; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, tex); if (U['iChannel' + k]) gl.uniform1i(U['iChannel' + k], k); }
    if (U.iChannelResolution) gl.uniform3fv(U.iChannelResolution, [256, 256, 1, 256, 256, 1, 256, 256, 1, 256, 256, 1]);
    gl.uniform3f(U.iResolution, q.w, q.h, 1); gl.uniform1f(U.iTime, q.t); gl.uniform1f(U.iTimeDelta, 1 / FPS); gl.uniform1f(U.iFrameRate, FPS); gl.uniform1i(U.iFrame, q.frame);
    gl.uniform4f(U.iMouse, 0, 0, 0, 0); gl.uniform4f(U.iDate, 2026, 0, 1, q.t); gl.uniform1f(U.iSampleRate, 44100);
    gl.uniform4fv(U.iParams, q.params); gl.uniform3fv(U.iColor1, q.c1); gl.uniform3fv(U.iColor2, q.c2); gl.uniform1f(U.iOpaque, q.opaque);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  rt.ok = true;
}
async function shBuildGpu(rt, code) {
  if (gpuState !== 'ok') { rt.err = gpuState === 'pending' ? 'Starting WebGPU…' : 'This browser cannot run WGSL shaders (WebGPU is unavailable). Use a GLSL shader instead.'; return; }
  const dev = gpuDev, ctx = rt.canvas.getContext('webgpu');
  ctx.configure({ device: dev, format: gpuFmt, alphaMode: 'premultiplied' });
  const pre = SH_WGSL_PRE.split('\n').length - 1, mod = dev.createShaderModule({ code: SH_WGSL_PRE + code + SH_WGSL_POST });
  const info = await mod.getCompilationInfo(), errs = info.messages.filter((m) => m.type === 'error');
  if (errs.length) { rt.err = errs.slice(0, 6).map((m) => `Line ${Math.max(1, m.lineNum - pre)}: ${m.message}`).join('\n'); return; }
  let pipe;
  try { pipe = await dev.createRenderPipelineAsync({ layout: 'auto', vertex: { module: mod, entryPoint: 'shVs_' }, fragment: { module: mod, entryPoint: 'shFs_', targets: [{ format: gpuFmt }] }, primitive: { topology: 'triangle-list' } }); }
  catch (e) { rt.err = (e && e.message) || 'Pipeline error. Check that mainImage(fragCoord: vec2f) -> vec4f exists.'; return; }
  const ubuf = dev.createBuffer({ size: 96, usage: (globalThis as any).GPUBufferUsage.UNIFORM | (globalThis as any).GPUBufferUsage.COPY_DST });
  const bind = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const data = new Float32Array(24);
  rt.draw = (q) => {
    data.set([q.w, q.h, q.t, q.frame, ...q.params, ...q.c1, 1, ...q.c2, 1, 0, 0, 0, 0, q.opaque, 1 / FPS, 0, 0]);
    dev.queue.writeBuffer(ubuf, 0, data);
    const enc = dev.createCommandEncoder(), pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
    pass.setPipeline(pipe); pass.setBindGroup(0, bind); pass.draw(3); pass.end(); dev.queue.submit([enc.finish()]);
  };
  rt.ok = true;
}
/* The shader draws on a GPU canvas that is never put on the page. Each frame is copied onto plain 2D canvases inside
   the layer (one per duplicator copy). Safari draws a GPU canvas inside the SVG at screen size and outside the
   composition; a plain canvas follows the layer's position, size and the composition edge like any other layer. */
function shRuntime(l) {
  const src = shSource(l), key = src.lang + '|' + gpuState + '|' + src.code;
  let rt = SH[l.id];
  if (rt && rt.key === key) return rt;
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  rt = SH[l.id] = { key, lang: src.lang, canvas: cv, views: rt ? rt.views : [], ok: false, err: '', draw: null };
  if (src.lang === 'wgsl') shBuildGpu(rt, src.code).then(() => { if (SH[l.id] === rt) { updateCanvas(); if (S.sel === l.id) renderRight(); if (S.dialog === 'shader') renderDialog(); } });
  else shBuildGl(rt, src.code);
  return rt;
}
function newView() {
  const v = document.createElement('canvas'); v.className = 'shcv';
  // willReadFrequently keeps this canvas off the GPU, so Safari composites it with the SVG like an image.
  v.getContext('2d', { willReadFrequently: true } as any);
  return v;
}
function blit(rt) {
  for (const v of rt.views) {
    if (!v.isConnected) continue;
    if (v.width !== rt.canvas.width || v.height !== rt.canvas.height) { v.width = rt.canvas.width; v.height = rt.canvas.height; }
    const g = v.getContext('2d', { willReadFrequently: true } as any); if (!g) continue;
    g.clearRect(0, 0, v.width, v.height); g.drawImage(rt.canvas, 0, 0);
  }
}
export function renderShader(l, f, w?, h?, show = true) {
  const rt = shRuntime(l); if (!rt.ok || !rt.draw) return rt;
  w = w || 1280; h = h || 720;
  if (rt.canvas.width !== w || rt.canvas.height !== h) { rt.canvas.width = w; rt.canvas.height = h; }
  try { rt.draw(shUniforms(l, f, w, h)); if (show) blit(rt); } catch (e) { rt.ok = false; rt.err = (e && e.message) || String(e); }
  return rt;
}

/* ---- Shader fill effect: a shader preset painted inside any layer's shape (Effects tab › Add effect › Shader fill) ---- */
export const fxShaderId = (l, j) => `${l.id}~fx${j}`;
/** The shader settings for a layer's Shader fill effect, in the same form as a shader layer. */
export function fxShaderLayer(l, j) {
  const e = l.fx[j], P = SHP[e.preset] || SHP.liquid, o: any = { id: fxShaderId(l, j), preset: e.preset || 'liquid', hue: e.c1 || P.c[0], hue2: e.c2 || P.c[1], spd: e.speed ?? 100, inP: l.inP ?? 0, opaque: true };
  P.def.forEach((v, k) => { o['sp' + k] = v; });
  return o;
}
/** The layer a shader canvas element belongs to: a shader layer, or the shader fill effect of a layer. */
export function shaderOf(fo) {
  if (fo.dataset.sh) return lay(fo.dataset.sh);
  const [id, j] = String(fo.dataset.fx || '').split('~fx'), l = lay(id);
  return l && l.fx[+j] && l.fx[+j].id === 'shader' ? fxShaderLayer(l, +j) : null;
}
export const fxShaderSize = 960;
export function mountShaders() {
  const seen: Record<string, number> = {};
  $$('foreignObject.shfo, foreignObject.shfx', stage).forEach((fo) => {
    const l = shaderOf(fo); if (!l) return; const rt = shRuntime(l), k = seen[l.id] = (seen[l.id] ?? -1) + 1;
    const v = rt.views[k] || (rt.views[k] = newView());
    if (v.parentNode !== fo) fo.appendChild(v);
  });
  for (const id in SH) if (SH[id].views) SH[id].views.length = Math.min(SH[id].views.length, (seen[id] ?? -1) + 1);
}
