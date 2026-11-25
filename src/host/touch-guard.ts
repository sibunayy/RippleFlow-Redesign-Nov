/* Safari touch guards and on-screen keyboard handling (iPad and iPhone).
 *
 * 1. Page zoom: Safari's own pinch-zoom (gesturestart/gesturechange) and double-tap zoom are blocked, so two-finger
 *    pinch only zooms the canvas.
 * 2. Back swipe: a touch that starts within 24 px of the left or right screen edge is held by the page, so Safari does
 *    not treat it as a back or forward swipe. Text fields and the left rail still get their taps.
 * 3. Callouts and text selection: long presses outside text fields don't open the copy / look-up callout.
 * 4. Keyboard: when the on-screen keyboard opens, the app is resized to the visible area above it, so the field being
 *    edited and the canvas text stay in view. It goes back to full height when the keyboard closes.
 */
import { fingers } from '../state/modifier';

const editable = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');

export function guardTouch() {
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  document.addEventListener('gesturestart', stop as any, { passive: false } as any);
  document.addEventListener('gesturechange', stop as any, { passive: false } as any);
  document.addEventListener('gestureend', stop as any, { passive: false } as any);

  document.addEventListener('touchstart', (e) => {
    if (editable(e.target) || (e.target as HTMLElement).closest?.('button, [data-act], .fld')) return; // buttons keep their tap
    const t = e.touches[0]; if (!t) return;
    if (e.touches.length === 1 && (t.clientX < 24 || t.clientX > innerWidth - 24) && e.cancelable) e.preventDefault();
  }, { passive: false });
  // More than one finger outside a scrolling list: never let Safari scroll or zoom the page.
  document.addEventListener('touchmove', (e) => { if (fingers(e).length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });

  // Double-tap zoom is switched off in CSS (touch-action: manipulation in 12-edits.css).
  document.addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });

  // On-screen keyboard: fit the app to the visible area.
  const vv = window.visualViewport; if (!vv) return;
  const root = document.documentElement;
  const fit = () => {
    const hidden = innerHeight - vv.height; // height covered by the keyboard (and the bar above it)
    const open = hidden > 120 && editable(document.activeElement);
    if (open === root.classList.contains('kb-open') && (!open || root.style.height === vv.height + 'px')) return;
    root.classList.toggle('kb-open', open);
    if (open) { root.style.height = vv.height + 'px'; document.body.style.height = vv.height + 'px'; window.scrollTo(0, 0); }
    else { root.style.height = ''; document.body.style.height = ''; }
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', () => { if (root.classList.contains('kb-open')) window.scrollTo(0, 0); });
  document.addEventListener('focusout', () => setTimeout(fit, 50));
  document.addEventListener('focusin', () => setTimeout(fit, 350));
}
