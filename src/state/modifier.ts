import { $ } from '../core/dom';
import { toast } from '../ui/toast';
import { S } from './state';

/**
 * The Modifier button. It stands in for the Shift key on a touch screen.
 * Hold it: the modifier is on until release. Double-tap it: the modifier latches on or off.
 * Gestures ask `shifted(e)`. It is true for the Shift key, a latched button or a held button.
 */
export const mod = { latched: false, held: false };
const HOLD_MS = 250, DOUBLE_MS = 350;
let downAt = 0, lastTapEnd = -Infinity, pid: number | null = null;

export const modOn = () => mod.latched || mod.held;
export const shifted = (e?: { shiftKey?: boolean }) => !!(e && e.shiftKey) || modOn();

/** What the modifier does with each tool. Shown in a toast when the modifier latches on. */
const HINT: Record<string, string> = {
  select: 'Modifier on. Tap layers to add or remove them from the selection. Drag empty space to add with a box.',
  marquee: 'Modifier on. Drag a box to add layers to the selection.',
  lasso: 'Modifier on. Draw a loop to add layers to the selection.',
  rect: 'Modifier on. Drag to draw a square.',
  line: 'Modifier on. Drag to snap the line to 15° steps.',
  pen: 'Modifier on. Tap to place points that snap to 45° steps.',
};
const hintFor = () => HINT[S.tool] || 'Modifier on. It changes what the tools do: multi-select, square shapes, angle snap.';

/** Updates the button without re-rendering the strip, so a held press survives. */
export function syncModBtn() {
  const b = $('#modbtn'); if (!b) return;
  const on = modOn();
  b.classList.toggle('on', on); b.classList.toggle('latched', mod.latched);
  b.setAttribute('aria-pressed', String(on));
}
export const modBtnHtml = (icon: string) => `<button class="sb mod ${modOn() ? 'on' : ''} ${mod.latched ? 'latched' : ''}" id="modbtn" data-act="mod" aria-label="Modifier" aria-pressed="${modOn()}" title="Modifier · hold for a temporary change, double-tap to lock on or off">${icon}<span class="modlbl">Mod</span><span class="mlock" aria-hidden="true"></span></button>`;

export function setLatched(v: boolean, say = true) {
  mod.latched = v; syncModBtn();
  if (say) toast(v ? hintFor() : 'Modifier off');
}
/** Keyboard path (Enter or Space on the focused button): toggles the latch. */
export function modKeyToggle() { setLatched(!mod.latched); }

function end(ev: PointerEvent) {
  if (ev.pointerId !== pid) return;
  pid = null; mod.held = false;
  const now = performance.now();
  if (ev.type === 'pointerup' && now - downAt < HOLD_MS) { // a short tap
    if (now - lastTapEnd < DOUBLE_MS) { lastTapEnd = -Infinity; setLatched(!mod.latched); return; }
    lastTapEnd = now;
  } else lastTapEnd = -Infinity; // a hold ends the double-tap window
  syncModBtn();
}
/** Pointer-down on the button. The release is read on the document, so a strip re-render cannot lose it. */
export function modDown(e: PointerEvent) {
  if (pid !== null) return;
  pid = e.pointerId; downAt = performance.now(); mod.held = true; syncModBtn();
}
/** Registers the document listeners for the release. main.ts calls it once. */
export function listen() {
  addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  addEventListener('blur', () => { if (pid !== null) { pid = null; mod.held = false; syncModBtn(); } });
}
