import { test, expect, type Page } from '@playwright/test';
import { openApp, ptr, savedProject, settle } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const spot = async (page: Page) => { const v = (await page.locator('#vp').boundingBox())!; return (x: number, y: number) => [v.x + x, v.y + y] as const; };
const tap = async (page: Page, x: number, y: number) => { await ptr(page, 'pointerdown', x, y); await ptr(page, 'pointerup', x, y); };
const dragTo = async (page: Page, a: readonly number[], b: readonly number[]) => {
  await ptr(page, 'pointerdown', a[0], a[1]);
  for (let i = 1; i <= 6; i++) await ptr(page, 'pointermove', a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6);
  await ptr(page, 'pointerup', b[0], b[1]);
};
const newest = async (page: Page) => { const p = await savedProject(page); return p.layers.find((l: any) => l.type === 'path' && l.name.startsWith('Path')) || p.layers.find((l: any) => l.type === 'path'); };

test('Marquee is its own tool directly below Select', async ({ page }) => {
  const tools = page.locator('#lstrip [data-act="tool"]');
  await expect(tools.nth(0)).toHaveAttribute('data-v', 'select');
  await expect(tools.nth(1)).toHaveAttribute('data-v', 'marquee');
  await tools.nth(1).click();
  await expect(tools.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(tools.nth(0)).toHaveAttribute('aria-pressed', 'false');
});

test('dragging while drawing makes a curve', async ({ page }) => {
  const at = await spot(page);
  await page.locator('#lstrip [data-v="pen"]').click();
  await tap(page, ...at(120, 120));
  await dragTo(page, at(260, 120), at(300, 190));
  await tap(page, ...at(380, 140));
  await page.keyboard.press('Enter');
  await expect(page.locator('#lname')).toHaveValue(/Path/);
  const l = await newest(page);
  expect(l.pts).toHaveLength(3);
  expect(Math.abs(l.pts[1][4]) + Math.abs(l.pts[1][5])).toBeGreaterThan(10); // out handle
  expect(l.pts[1][2]).toBe(-l.pts[1][4]); // in handle mirrors it
  await expect(page.locator(`#stage g[data-id="${l.id}"] path`).first()).toHaveAttribute('d', /C/);
});

test('a second finger cancels the new point, and undo removes the last one', async ({ page }) => {
  const at = await spot(page);
  await page.locator('#lstrip [data-v="pen"]').click();
  await tap(page, ...at(120, 120));
  await tap(page, ...at(220, 120));
  const dots = page.locator('#ovl circle.mpd');
  await expect(dots).toHaveCount(2);
  // A two-finger tap: the first finger places a point, the second takes it back.
  const [x, y] = at(320, 160);
  await page.evaluate(([px, py]) => {
    const vp = document.querySelector('#vp')!;
    const ev = (t: string, id: number) => new PointerEvent(t, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: px + id, clientY: py, isPrimary: id === 11 });
    vp.setPointerCapture = () => {};
    vp.dispatchEvent(ev('pointerdown', 11)); vp.dispatchEvent(ev('pointerdown', 12)); vp.dispatchEvent(ev('pointerup', 11)); vp.dispatchEvent(ev('pointerup', 12));
  }, [x, y]);
  await expect(dots).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(dots).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(dots).toHaveCount(2);
});

test('a shape becomes editable: move a point, add one, keep its look', async ({ page }) => {
  const at = await spot(page);
  await page.locator('#lstrip [data-v="pen"]').click();
  await tap(page, ...at(120, 120)); await tap(page, ...at(300, 120)); await tap(page, ...at(300, 240));
  await page.keyboard.press('Enter');
  await page.locator('#qbar [data-act="peedit"]').dispatchEvent('click');
  await expect(page.locator('#ovl rect.mpd')).toHaveCount(3);
  await dragTo(page, at(300, 240), at(340, 280));
  await expect.poll(async () => (await newest(page)).pts[2][0]).toBeGreaterThan((await newest(page)).pts[1][0]);
  await tap(page, ...at(210, 120)); // on the first line: adds a point
  await expect(page.locator('#ovl rect.mpd')).toHaveCount(4);
  await page.locator('#qbar [data-act="pedone"]').dispatchEvent('click');
  await settle(page);
  await expect(page.locator('#ovl rect.mpd')).toHaveCount(0);
  await expect(page.locator('#selbox')).toBeVisible();
});

test('a rectangle turns into a path only when a point changes', async ({ page }) => {
  const at = await spot(page);
  await page.locator('#lstrip [data-v="rect"]').click();
  await dragTo(page, at(120, 120), at(320, 260));
  await page.locator('#qbar [data-act="peedit"]').dispatchEvent('click');
  const dot = page.locator('#ovl rect.mpd').first();
  await expect(dot).toBeAttached();
  const before = (await savedProject(page)).layers.filter((l: any) => l.type === 'rect').length;
  const v = (await page.locator('#vp').boundingBox())!, cx = +(await dot.getAttribute('x'))! + 5 + v.x, cy = +(await dot.getAttribute('y'))! + 5 + v.y;
  await dragTo(page, [cx, cy], [cx - 20, cy - 20]);
  await expect.poll(async () => (await savedProject(page)).layers.filter((l: any) => l.type === 'rect').length).toBe(before - 1);
});
