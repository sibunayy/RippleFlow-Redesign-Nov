import { test, expect, type Page } from '@playwright/test';
import { insertLayer } from './helpers';

// The library is new, so it only runs against the app (the legacy prototype has none).
test.skip(process.env.RF_TARGET === 'legacy', 'app only');

async function fresh(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__lib')) return;
    sessionStorage.setItem('__lib', '1'); localStorage.clear();
  });
  await page.goto(process.env.RF_URL!);
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('rippleflow-library'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await page.reload();
  await expect(page.locator('#library')).toBeVisible();
}
const back = async (page: Page) => { await page.locator('#top [aria-label="Back to library"]').click(); await expect(page.locator('#library')).toBeVisible(); };
const card = (page: Page, name: string) => page.locator('#library .lib-card-open', { hasText: name });
const more = (page: Page, name: string) => page.locator(`#library [aria-label="More for ${name}"]`);

test('opens on the library, and a blank project starts empty', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-lib="blank"]').click();
  await expect(page.locator('#library')).toBeHidden();
  await expect(page.locator('#pname')).toHaveValue('Untitled');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(0);
});

test('projects keep their own work through save, reload and reopen', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-lib="new"]').click();
  await page.locator('#lib-name').fill('First');
  await page.locator('[data-lib="dur"][data-v="10"]').click();
  await expect(page.locator('#lib-name')).toHaveValue('First');
  await page.locator('#library .dlg .primary').click();
  await expect(page.locator('#pname')).toHaveValue('First');
  await insertLayer(page, 'star');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(1);
  await back(page);

  await page.locator('[data-lib="blank"]').click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(0);
  await back(page);
  await page.reload();
  await expect(card(page, 'First')).toBeVisible();
  await card(page, 'First').click();
  await expect(page.locator('#pname')).toHaveValue('First');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(1);
  await expect(page.locator('#tl .time')).toContainText('00:10:00');

  // A reload while editing comes back to the same project.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('#library')).toBeHidden();
  await expect(page.locator('#pname')).toHaveValue('First');
});

test('rename, duplicate and delete', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-lib="sample"]').click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
  await back(page);
  await more(page, 'Logo sting').click();
  await page.locator('[data-lib="m-rename"]').click();
  await page.locator('#lib-name').fill('<b>Renamed</b>');
  await page.locator('#library .dlg .primary').click();
  await expect(card(page, '<b>Renamed</b>')).toBeVisible(); // shown as text
  await more(page, '<b>Renamed</b>').click();
  await page.locator('[data-lib="m-dup"]').click();
  await expect(card(page, '<b>Renamed</b> copy')).toBeVisible();
  await more(page, '<b>Renamed</b> copy').click();
  await page.locator('[data-lib="m-del"]').click();
  await expect(card(page, '<b>Renamed</b> copy')).toBeVisible(); // first tap only arms
  await page.locator('[data-lib="m-del"]').click();
  await expect(card(page, '<b>Renamed</b> copy')).toHaveCount(0);
});

test('a project already on the device becomes the first card', async ({ page }) => {
  const layer = { id: 'a', name: 'a', type: 'rect', hue: '#ff0000', vis: true, lock: false, fx: [], w: 100, h: 100, p: { x: { v: 960 }, y: { v: 540 }, scale: { v: 100 }, rot: { v: 0 }, op: { v: 100 }, ax: { v: 0 }, ay: { v: 0 }, ts: { v: 0 }, te: { v: 100 } } };
  await page.goto(process.env.RF_URL!);
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('rippleflow-library'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('rfp-project', JSON.stringify({ layers: [l], markers: [], dur: 90, name: 'Existing work' })); }, layer);
  await page.reload();
  await card(page, 'Existing work').click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(1);
});

test('an imported picture survives reopening, and bad project files are refused', async ({ page }) => {
  await fresh(page);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC';
  const l = { id: 'pic', name: 'pic', type: 'image', mediaId: 'mtest1', src: 'blob:old', hue: '#fff', vis: true, lock: false, fx: [], w: 100, h: 100, p: { x: { v: 960 }, y: { v: 540 }, scale: { v: 100 }, rot: { v: 0 }, op: { v: 100 }, ax: { v: 0 }, ay: { v: 0 }, ts: { v: 0 }, te: { v: 100 } } };
  const file = (o: unknown, name: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
  await page.locator('#lib-file').setInputFiles(file({ app: 'RippleFlow', format: 1, doc: { layers: [l], markers: [], dur: 90, name: 'With picture' }, media: { mtest1: 'data:image/png;base64,' + png } }, 'pic.ripple.json'));
  await card(page, 'With picture').click();
  await expect(page.locator('#stage image')).toHaveAttribute('href', /^blob:/);
  await back(page);
  await page.locator('#lib-file').setInputFiles(file({ hello: 1 }, 'nope.json'));
  await expect(page.locator('.lib-toast')).toContainText('not a RippleFlow project');
  await page.locator('#lib-file').setInputFiles(file({ app: 'RippleFlow', format: 1, doc: { layers: [{ ...l, mediaId: undefined, src: 'x" onload="alert(1)' }], name: 'Bad' } }, 'bad.json'));
  await expect(page.locator('.lib-toast')).toContainText('cannot open');
  await expect(card(page, 'Bad')).toHaveCount(0);
});

test('editor shortcuts do nothing while the library is showing', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-lib="sample"]').click();
  await back(page);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  await card(page, 'Logo sting').click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
});
