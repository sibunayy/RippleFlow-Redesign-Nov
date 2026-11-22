import { test, expect, type Page } from '@playwright/test';

// The full frame-by-frame workspace is newer than the prototype, so it only runs against the app.
test.skip(process.env.RF_TARGET === 'legacy', 'app only');

async function blank(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__fbf')) return;
    sessionStorage.setItem('__fbf', '1'); localStorage.clear();
  });
  await page.goto(process.env.RF_URL!);
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('rippleflow-library'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await page.reload();
  await page.locator('[data-lib="blank"]').click();
  await expect(page.locator('#library')).toBeHidden();
}
const act = (page: Page, name: string) => page.locator(`#tl [data-act="${name}"]`).first();
const cels = (page: Page) => page.locator('#tl .fcel');
const lefts = (page: Page) => cels(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).style.left.replace(/\D/g, '')));
async function start(page: Page) {
  await page.locator('[data-act="fbf"]').click();
  await expect(page.locator('.app')).toHaveClass(/\bfbf\b/);
  await act(page, 'fnewlayer').click();
  await expect(page.locator('#tl .frow')).toHaveCount(1);
}

test('adds, copies, shifts, holds and deletes frames, with undo', async ({ page }) => {
  await blank(page);
  await start(page);
  await act(page, 'fadd').click();
  await act(page, 'fadd').click();
  await act(page, 'fdup').click();
  await expect(cels(page)).toHaveCount(3);
  expect(await lefts(page)).toEqual(['0', '1', '2']);
  await expect(page.locator('#fcount')).toHaveText('Frame 3');

  await page.locator('#tl [data-act="step"][data-v="-1"]').click();
  await act(page, 'fholdp').click();
  expect(await lefts(page)).toEqual(['0', '1', '3']);
  await act(page, 'fmovel').click();
  await expect(page.locator('#fcount')).toHaveText('Frame 1');
  await act(page, 'fdel').click();
  await expect(cels(page)).toHaveCount(2);
  await page.locator('#lstrip [data-act="undo"]').click();
  await expect(cels(page)).toHaveCount(3);
});

test('dragging a cel and its hold edge changes timing', async ({ page }) => {
  await blank(page);
  await start(page);
  await act(page, 'fadd').click();
  await act(page, 'fadd').click();
  const last = await cels(page).nth(1).boundingBox();
  await page.mouse.move(last!.x + 6, last!.y + 10);
  await page.mouse.down();
  await page.mouse.move(last!.x + 6 + 34 * 3, last!.y + 10, { steps: 6 });
  await page.mouse.up();
  expect(await lefts(page)).toEqual(['0', '4']);
  const hold = await page.locator('#tl .fcel').first().locator('.fh').boundingBox();
  await page.mouse.move(hold!.x + 7, hold!.y + 10);
  await page.mouse.down();
  await page.mouse.move(hold!.x + 7 + 34 * 2, hold!.y + 10, { steps: 4 });
  await page.mouse.up();
  expect(await lefts(page)).toEqual(['0', '6']);
});

test('leaving restores the editor, and frames survive a reload', async ({ page }) => {
  await blank(page);
  await start(page);
  await act(page, 'fadd').click();
  await act(page, 'fadd').click();
  await page.locator('[data-act="fbf"]').click();
  await expect(page.locator('.app')).not.toHaveClass(/\bfbf\b/);
  await expect(page.locator('#tl .ftl')).toHaveCount(0);
  await expect(page.locator('#lstrip [data-act="insert"]')).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('#library')).toBeHidden();
  await page.locator('[data-act="fbf"]').click();
  await expect(cels(page)).toHaveCount(2);
});
