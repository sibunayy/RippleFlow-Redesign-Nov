/* ---- Bundled shader pack: original GLSL shaders, written for this app. They run on WebGL2 and use the same four sliders and two colours as the first presets. ---- */
const sh = (name: string, ps: string[], def: number[], c: [string, string], body: string) => ({ name, ps, def, c, glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n${body}\n}` });
const UV = '  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;';
export const PACK: Record<string, any> = {
  waves: sh('Waves', ['Frequency', 'Amplitude', 'Layers', 'Brightness'], [.4, .4, .5, .5], ['#0a2a6b', '#4fd1ff'], `${UV}
  float t = iTime * 0.5, f = mix(2.0, 12.0, iParams.x), a = mix(0.02, 0.25, iParams.y), n = floor(mix(2.0, 8.0, iParams.z));
  vec3 col = iColor1 * 0.4;
  for (float i = 0.0; i < 8.0; i++) { if (i >= n) break; float y = (i / n - 0.5) * 1.4 + a * sin(uv.x * f + t + i * 1.7); col = mix(col, mix(iColor1, iColor2, i / n), smoothstep(0.0, 0.01, y - uv.y + 0.1)); }
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);`),
  ripples: sh('Ripples', ['Ring count', 'Speed', 'Sharpness', 'Brightness'], [.4, .5, .5, .5], ['#08263d', '#7df3e1'], `${UV}
  float r = length(uv), k = mix(4.0, 30.0, iParams.x);
  float w = 0.5 + 0.5 * sin(r * k - iTime * mix(1.0, 8.0, iParams.y));
  w = pow(w, mix(1.0, 8.0, iParams.z)) * smoothstep(1.2, 0.1, r);
  fragColor = vec4(mix(iColor1, iColor2, w) * mix(0.6, 1.4, iParams.w), 1.0);`),
  checker: sh('Warped checker', ['Tiles', 'Warp', 'Speed', 'Contrast'], [.4, .4, .4, .6], ['#1a1a2e', '#f5f0e6'], `${UV}
  float t = iTime * mix(0.0, 1.0, iParams.z);
  vec2 p = uv * mix(2.0, 14.0, iParams.x);
  p += mix(0.0, 1.5, iParams.y) * vec2(sin(p.y * 0.7 + t), cos(p.x * 0.7 + t));
  float c = mod(floor(p.x) + floor(p.y), 2.0);
  fragColor = vec4(mix(iColor1, iColor2, mix(0.5, c, mix(0.3, 1.0, iParams.w))), 1.0);`),
  stripes: sh('Moving stripes', ['Count', 'Angle', 'Speed', 'Softness'], [.4, .2, .4, .2], ['#ff4d6d', '#ffe5ec'], `${UV}
  float ang = iParams.y * 3.14159, s = mix(0.0, 1.0, iParams.z);
  float d = dot(uv, vec2(cos(ang), sin(ang))) * mix(3.0, 30.0, iParams.x) - iTime * s * 3.0;
  float e = mix(0.02, 0.5, iParams.w);
  fragColor = vec4(mix(iColor1, iColor2, smoothstep(0.5 - e, 0.5 + e, abs(fract(d) - 0.5) * 2.0)), 1.0);`),
  halftone: sh('Halftone dots', ['Dot count', 'Size', 'Wave', 'Brightness'], [.4, .5, .5, .5], ['#101020', '#ffb703'], `${UV}
  float n = mix(8.0, 50.0, iParams.x);
  vec2 g = uv * n, id = floor(g), f = fract(g) - 0.5;
  float wv = 0.5 + 0.5 * sin(length(id) * 0.35 - iTime * 2.0 * iParams.z * 2.0);
  float r = mix(0.1, 0.5, iParams.y) * mix(0.3, 1.0, wv);
  float m = smoothstep(r, r - 0.06, length(f));
  fragColor = vec4(mix(iColor1, iColor2, m) * mix(0.6, 1.4, iParams.w), 1.0);`),
  lava: sh('Lava blobs', ['Blob count', 'Size', 'Speed', 'Glow'], [.5, .5, .4, .5], ['#ff2e63', '#ffd166'], `${UV}
  float n = floor(mix(3.0, 9.0, iParams.x)), s = 0.0, t = iTime * mix(0.1, 1.0, iParams.z);
  for (float i = 0.0; i < 9.0; i++) { if (i >= n) break; vec2 c = 0.45 * vec2(sin(t * (0.7 + 0.13 * i) + i * 2.1), cos(t * (0.5 + 0.17 * i) + i * 1.3)); s += mix(0.01, 0.06, iParams.y) / (dot(uv - c, uv - c) + 0.002); }
  float m = smoothstep(0.8, 1.2, s);
  vec3 col = mix(iColor1 * 0.15, mix(iColor1, iColor2, clamp((s - 1.0) * 0.5, 0.0, 1.0)), m);
  col += iColor1 * 0.15 * mix(0.0, 1.5, iParams.w) * clamp(s, 0.0, 1.0);
  fragColor = vec4(col, 1.0);`),
  stars: sh('Starfield', ['Density', 'Speed', 'Twinkle', 'Brightness'], [.5, .4, .5, .6], ['#02030a', '#cfe4ff'], `${UV}
  vec3 col = iColor1;
  for (float l = 0.0; l < 4.0; l++) {
    float z = fract(l * 0.25 + iTime * mix(0.02, 0.3, iParams.y));
    vec2 p = uv * mix(4.0, 14.0, l / 3.0 + 0.2) * (1.0 + (1.0 - z) * 0.0) + l * 17.3, id = floor(p), f = fract(p) - 0.5;
    float h = hash(id + l), on = step(1.0 - mix(0.04, 0.35, iParams.x), h);
    vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5; o *= 0.6;
    float s = smoothstep(0.08, 0.0, length(f - o)) * on;
    s *= mix(1.0, 0.5 + 0.5 * sin(iTime * 3.0 + h * 40.0), iParams.z);
    col += iColor2 * s * mix(0.5, 1.5, iParams.w) * (0.4 + 0.6 * l / 3.0);
  }
  fragColor = vec4(col, 1.0);`),
  fire: sh('Flames', ['Height', 'Turbulence', 'Speed', 'Heat'], [.5, .5, .5, .5], ['#ff3d00', '#ffd23f'], `  vec2 uv = fragCoord / iResolution.xy; uv.x = (uv.x - 0.5) * iResolution.x / iResolution.y;
  float t = iTime * mix(0.3, 2.0, iParams.z);
  vec2 p = vec2(uv.x * 3.0, uv.y * 2.0 - t);
  float n = fbm(p + mix(0.0, 2.0, iParams.y) * vec2(fbm(p + t * 0.3), fbm(p * 1.3 - t * 0.2)));
  float h = n * 1.4 - uv.y * mix(2.5, 0.8, iParams.x) + 0.35 - abs(uv.x) * 0.5;
  float f = smoothstep(0.0, 0.6, h);
  vec3 col = mix(vec3(0.02, 0.0, 0.0), iColor1, smoothstep(0.0, 0.3, f));
  col = mix(col, iColor2, smoothstep(0.4, 1.0, f * mix(0.8, 1.8, iParams.w)));
  fragColor = vec4(col, 1.0);`),
  clouds: sh('Clouds', ['Scale', 'Coverage', 'Speed', 'Contrast'], [.4, .5, .3, .5], ['#3a7bd5', '#ffffff'], `  vec2 uv = fragCoord / iResolution.y;
  float t = iTime * mix(0.01, 0.15, iParams.z);
  float n = fbm(uv * mix(1.0, 6.0, iParams.x) + vec2(t, t * 0.5));
  float c = smoothstep(mix(0.7, 0.3, iParams.y), mix(0.9, 0.7, iParams.y) + 0.1 * (1.0 - iParams.w), n);
  fragColor = vec4(mix(iColor1, iColor2, c), 1.0);`),
  rain: sh('Rain', ['Density', 'Speed', 'Length', 'Brightness'], [.5, .5, .5, .5], ['#0b1020', '#9fc4ff'], `  vec2 uv = fragCoord / iResolution.y;
  vec3 col = iColor1 * (0.6 + 0.4 * uv.y);
  for (float l = 0.0; l < 3.0; l++) {
    vec2 p = uv * vec2(mix(20.0, 60.0, iParams.x) * (1.0 + l * 0.5), 1.0);
    float id = floor(p.x), sp = (0.6 + hash(vec2(id, l))) * mix(0.5, 3.0, iParams.y);
    float y = fract(p.y * 0.5 + iTime * sp + hash(vec2(id, l + 5.0)));
    float streak = smoothstep(mix(0.02, 0.25, iParams.z), 0.0, y) * smoothstep(0.5, 0.2, abs(fract(p.x) - 0.5));
    col += iColor2 * streak * mix(0.3, 1.0, iParams.w) * (0.5 + 0.2 * l);
  }
  fragColor = vec4(col, 1.0);`),
  truchet: sh('Truchet tiles', ['Tiles', 'Line width', 'Speed', 'Brightness'], [.4, .3, .3, .5], ['#14213d', '#fca311'], `${UV}
  vec2 p = uv * mix(3.0, 14.0, iParams.x) + vec2(iTime * mix(0.0, 1.0, iParams.z), 0.0), id = floor(p), f = fract(p);
  if (hash(id) > 0.5) f.x = 1.0 - f.x;
  float d = min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5));
  float w = mix(0.03, 0.2, iParams.y);
  fragColor = vec4(mix(iColor1, iColor2, smoothstep(w, w - 0.03, d)) * mix(0.6, 1.4, iParams.w), 1.0);`),
  spiral: sh('Spiral', ['Arms', 'Tightness', 'Speed', 'Softness'], [.3, .4, .4, .3], ['#240046', '#ff9e00'], `${UV}
  float r = length(uv), a = atan(uv.y, uv.x);
  float arms = floor(mix(1.0, 8.0, iParams.x));
  float v = sin(a * arms + log(r + 0.001) * mix(2.0, 14.0, iParams.y) * 2.0 - iTime * mix(0.0, 4.0, iParams.z));
  float e = mix(0.05, 1.0, iParams.w);
  fragColor = vec4(mix(iColor1, iColor2, smoothstep(-e, e, v)) * smoothstep(0.0, 0.15, r), 1.0);`),
  kaleido: sh('Kaleidoscope', ['Segments', 'Zoom', 'Speed', 'Brightness'], [.4, .4, .4, .5], ['#6a00f4', '#00f5d4'], `${UV}
  float n = floor(mix(3.0, 12.0, iParams.x)), seg = 6.28318 / n, a = atan(uv.y, uv.x), r = length(uv);
  a = abs(mod(a, seg) - seg * 0.5) + iTime * mix(0.0, 0.5, iParams.z);
  vec2 p = r * vec2(cos(a), sin(a)) * mix(2.0, 8.0, iParams.y);
  float v = 0.5 + 0.5 * sin(p.x * 2.0 + sin(p.y * 2.0 + iTime));
  fragColor = vec4(mix(iColor1, iColor2, v) * mix(0.6, 1.4, iParams.w), 1.0);`),
  grain: sh('Film grain', ['Grain size', 'Amount', 'Flicker', 'Brightness'], [.3, .5, .6, .5], ['#1c1c1c', '#8a8a8a'], `  vec2 uv = fragCoord / iResolution.y;
  float g = hash(floor(uv * mix(400.0, 60.0, iParams.x)) + floor(iTime * 24.0) * 1.37);
  float fl = 1.0 + (hash(vec2(floor(iTime * 24.0), 1.0)) - 0.5) * iParams.z * 0.4;
  vec3 col = mix(iColor1, iColor2, 0.5 + (g - 0.5) * mix(0.0, 1.0, iParams.y)) * fl;
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);`),
  rays: sh('Sunburst rays', ['Ray count', 'Speed', 'Sharpness', 'Glow'], [.5, .3, .5, .5], ['#ff8c00', '#fff1b8'], `${UV}
  float a = atan(uv.y, uv.x), r = length(uv);
  float n = floor(mix(6.0, 40.0, iParams.x));
  float ray = pow(0.5 + 0.5 * sin(a * n + iTime * mix(0.0, 3.0, iParams.y)), mix(1.0, 10.0, iParams.z));
  float glow = exp(-r * mix(4.0, 1.0, iParams.w));
  fragColor = vec4(mix(iColor1, iColor2, ray * glow + glow * 0.5), 1.0);`),
  caustics: sh('Water caustics', ['Scale', 'Speed', 'Sharpness', 'Brightness'], [.4, .4, .5, .5], ['#006d77', '#e0fbfc'], `  vec2 p = fragCoord / iResolution.y * mix(3.0, 12.0, iParams.x);
  float t = iTime * mix(0.1, 1.2, iParams.y), v = 0.0;
  vec2 q = p;
  for (int i = 0; i < 4; i++) { q += vec2(sin(q.y * 1.3 + t), cos(q.x * 1.1 - t)) * 0.6; v += 1.0 / (0.3 + abs(sin(q.x + q.y + t))) * 0.1; }
  v = pow(clamp(v * 0.5, 0.0, 1.0), mix(1.0, 4.0, iParams.z));
  fragColor = vec4(mix(iColor1, iColor2, v) * mix(0.6, 1.4, iParams.w), 1.0);`),
  mesh: sh('Soft mesh gradient', ['Softness', 'Speed', 'Spread', 'Brightness'], [.6, .3, .5, .5], ['#ff6bcb', '#4cc9f0'], `  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * mix(0.0, 0.8, iParams.y), s = mix(0.3, 0.9, iParams.z);
  vec3 col = vec3(0.0); float wt = 0.0;
  for (float i = 0.0; i < 5.0; i++) {
    vec2 c = 0.5 + s * 0.5 * vec2(sin(t + i * 2.4), cos(t * 0.8 + i * 1.7));
    float w = exp(-dot(uv - c, uv - c) * mix(30.0, 4.0, iParams.x));
    col += mix(iColor1, iColor2, fract(i * 0.37 + 0.1)) * w; wt += w;
  }
  fragColor = vec4(col / max(wt, 0.0001) * mix(0.6, 1.4, iParams.w), 1.0);`),
  scan: sh('Scanlines', ['Line count', 'Roll speed', 'Noise', 'Brightness'], [.5, .4, .3, .5], ['#001a12', '#39ff88'], `  vec2 uv = fragCoord / iResolution.xy;
  float l = 0.5 + 0.5 * sin((uv.y - iTime * mix(0.0, 0.3, iParams.y)) * mix(100.0, 700.0, iParams.x));
  float n = hash(fragCoord + floor(iTime * 30.0)) * iParams.z;
  float v = mix(0.3, 1.0, l) * (0.7 + 0.3 * sin(uv.y * 3.0 - iTime)) + n * 0.4;
  fragColor = vec4(mix(iColor1, iColor2, clamp(v, 0.0, 1.0)) * mix(0.6, 1.4, iParams.w), 1.0);`),
  bokeh: sh('Bokeh lights', ['Count', 'Size', 'Drift', 'Brightness'], [.5, .5, .4, .6], ['#150b2e', '#ffb3ec'], `${UV}
  vec3 col = iColor1;
  for (float i = 0.0; i < 14.0; i++) {
    if (i >= mix(4.0, 14.0, iParams.x)) break;
    vec2 c = vec2(hash(vec2(i, 1.0)) - 0.5, hash(vec2(i, 2.0)) - 0.5) * vec2(1.6, 1.0);
    c += 0.1 * vec2(sin(iTime * mix(0.1, 1.0, iParams.z) + i), cos(iTime * mix(0.1, 1.0, iParams.z) * 0.8 + i * 2.0));
    float r = mix(0.04, 0.2, iParams.y) * (0.5 + hash(vec2(i, 3.0)));
    float d = length(uv - c);
    col += mix(iColor1 * 2.0, iColor2, hash(vec2(i, 4.0))) * (smoothstep(r, r * 0.85, d) * 0.35 + smoothstep(r * 1.1, r * 0.95, d) * 0.15) * mix(0.5, 1.6, iParams.w);
  }
  fragColor = vec4(col, 1.0);`),
  marble: sh('Marble', ['Scale', 'Veining', 'Speed', 'Contrast'], [.4, .5, .3, .5], ['#f1ece4', '#2b2d42'], `  vec2 p = fragCoord / iResolution.y * mix(1.0, 5.0, iParams.x);
  float t = iTime * mix(0.0, 0.3, iParams.z);
  float n = fbm(p + fbm(p * 1.5 + t) * mix(0.5, 4.0, iParams.y));
  float v = abs(sin((p.x + n * mix(1.0, 4.0, iParams.y)) * 3.0));
  float e = mix(0.6, 0.05, iParams.w);
  fragColor = vec4(mix(iColor2, iColor1, smoothstep(0.0, e + 0.1, v)), 1.0);`),
  hexgrid: sh('Hex grid', ['Cell count', 'Border', 'Pulse', 'Brightness'], [.4, .3, .5, .5], ['#0d1b2a', '#5bc0eb'], `${UV}
  vec2 p = uv * mix(4.0, 16.0, iParams.x), r = vec2(1.0, 1.7320508), h = r * 0.5;
  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;
  float d = max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y)) ;
  float edge = smoothstep(0.5 - mix(0.02, 0.2, iParams.y), 0.5, d);
  float pulse = 0.5 + 0.5 * sin(length(id) * 0.8 - iTime * 3.0 * iParams.z * 2.0 + hash(floor(id)) * 6.0);
  fragColor = vec4(mix(iColor1 * (0.4 + 0.6 * pulse), iColor2, edge) * mix(0.6, 1.4, iParams.w), 1.0);`),
};
