import { test, expect } from '@playwright/test';
import { openApp, ptr, center, layerG, isPortrait, settle } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const btn = (page) => page.locator('#modbtn');
const press = async (page, ms: number) => {
  const [x, y] = await center(btn(page));
  await ptr(page, 'pointerdown', x, y, { id: 31 }); await page.waitForTimeout(ms); await ptr(page, 'pointerup', x, y, { id: 31 });
};

test('the Modifier button is two tool buttons tall and sits above Undo and Redo', async ({ page }) => {
  const m = (await btn(page).boundingBox())!, t = (await page.locator('#selbtn').boundingBox())!, u = (await page.locator('#lstrip [data-act="undo"]').boundingBox())!;
  expect(m.width).toBeCloseTo(t.width, 0);
  expect(m.height).toBeGreaterThanOrEqual(t.height * 2);
  expect(m.y + m.height).toBeLessThanOrEqual(u.y);
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('hold turns the modifier on until release', async ({ page }) => {
  const [x, y] = await center(btn(page));
  await ptr(page, 'pointerdown', x, y, { id: 31 });
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await ptr(page, 'pointerup', x, y, { id: 31 });
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('double tap latches the modifier on and off; a single tap does not', async ({ page }) => {
  await press(page, 40); await page.waitForTimeout(500);
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'false');
  await press(page, 40); await press(page, 40);
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(btn(page)).toHaveClass(/latched/);
  await page.waitForTimeout(500);
  await press(page, 40); await press(page, 40);
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('with the modifier held, tapping a second layer adds it to the selection', async ({ page }) => {
  if (await isPortrait(page)) { await page.locator('#rstrip [aria-label="Properties"]').click(); await settle(page); }
  const [x, y] = await center(btn(page));
  await ptr(page, 'pointerdown', x, y, { id: 31 });
  const [cx, cy] = await center(layerG(page, 'core'));
  await ptr(page, 'pointerdown', cx, cy); await ptr(page, 'pointerup', cx, cy);
  await page.waitForTimeout(300);
  await ptr(page, 'pointerup', x, y, { id: 31 });
  await expect(btn(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#toast')).toContainText('layers selected');
});
