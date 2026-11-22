import { CH, CW, DUR, FPS, layers, markers, saveProj, setComp, setDUR, setFPS } from '../model/project';
import { S } from '../state/state';
import { commit, resetHistory } from '../state/history';
import { buildCanvas, layoutStage } from '../render/stage';
import { sizeRaster } from '../drawing/raster';
import { renderAll } from '../ui/layout';
import { renderDialog } from '../ui/dialog';
import { toast } from '../ui/toast';

/** Composition size presets: [label, width, height]. */
export const SIZES: [string, number, number][] = [['HD 1920 × 1080', 1920, 1080], ['4K 3840 × 2160', 3840, 2160], ['720p 1280 × 720', 1280, 720], ['Square 1080 × 1080', 1080, 1080], ['Vertical 1080 × 1920', 1080, 1920], ['Portrait 1080 × 1350', 1080, 1350]];
export const FPS_PRESETS = [24, 25, 30, 50, 60];
const even = (v: number) => Math.max(64, Math.min(8192, Math.round(v / 2) * 2));

/** Changes the composition size. Layers keep their pixel positions and sizes, so move or scale them if the new frame needs it. */
export function applyCompSize(w: number, h: number) {
  w = even(w); h = even(h);
  if (!isFinite(w) || !isFinite(h) || (w === CW && h === CH)) { renderAll(); return; }
  setComp(w, h); sizeRaster(); saveProj();
  buildCanvas(); layoutStage(); renderAll(); renderDialog();
  toast(`Composition is now ${w} × ${h}. Layers keep their positions.`, true);
}

/** Changes the frame rate and keeps the real time of everything: keyframes, trims, cels, markers and the length move to the nearest frame. */
export function applyFps(n: number) {
  n = Math.round(n);
  if (!isFinite(n) || n < 1 || n > 120 || n === FPS) { renderAll(); return; }
  const k = n / FPS, r = (v: number) => Math.round(v * k);
  layers.forEach((l: any) => {
    Object.values(l.p || {}).forEach((pr: any) => {
      if (!pr || !pr.keys) return;
      pr.keys.forEach((key) => { key.t = r(key.t); });
      pr.keys = pr.keys.filter((key, i, a) => !a[i + 1] || a[i + 1].t !== key.t); // two keys on one frame: keep the later
    });
    if (l.inP != null) l.inP = r(l.inP);
    if (l.outP != null) l.outP = r(l.outP);
    if (l.pt != null) l.pt = r(l.pt);
    (l.anims || []).forEach((a) => { a.start = r(a.start); a.stagger = +(a.stagger * k).toFixed(2); a.dur = Math.max(1, r(a.dur)); });
    (l.cels || []).forEach((c, i, all) => { c.f = r(c.f); if (i && c.f <= all[i - 1].f) c.f = all[i - 1].f + 1; });
  });
  markers.forEach((m) => { m.f = r(m.f); });
  setFPS(n); setDUR(Math.max(1, r(DUR)));
  S.wa = [r(S.wa[0]), Math.min(DUR, r(S.wa[1]))]; if (S.wa[1] <= S.wa[0]) S.wa = [0, DUR]; S.f = Math.min(DUR - 1, r(S.f)); S.keys = [];
  commit('Frame rate'); resetHistory(); saveProj();
  buildCanvas(); renderAll(); renderDialog();
  toast(`${n} fps. Timing is kept; undo history was cleared.`, true);
}
