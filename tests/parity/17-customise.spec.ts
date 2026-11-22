import { test, expect, type Page } from '@playwright/test';
import { openApp } from './helpers';

test.skip(process.env.RF_TARGET === 'legacy', 'app only');

const rootVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const inlineVar = (page: Page, name: string) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);
const setInput = (page: Page, sel: string, value: string) => page.locator(sel).evaluate((el: HTMLInputElement, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
async function openCustomise(page: Page) {
  await page.locator('#top [data-act=menu]').click();
  await page.locator('[data-act=customise]').click();
  await expect(page.getByRole('dialog', { name: 'Customise' })).toBeVisible();
}
async function darkMode(page: Page) { await page.locator('[data-act=pfmode][data-v=dark]').click(); }

test('navy is the default dark theme and adds no inline overrides', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  expect(await rootVar(page, '--surface')).toBe('#1a2744');
  expect(await rootVar(page, '--bg')).toBe('#101a30');
  expect(await inlineVar(page, '--surface')).toBe('');
});

test('a custom colour applies live, keeps the dialog in place, saves and resets', async ({ page }) => {
  await openApp(page);
  await openCustomise(page);
  await darkMode(page);
  await page.locator('[data-pfc=panel]').evaluate((el) => { (el as any).__same = true; });
  await setInput(page, '[data-pfc=panel]', '#334455');
  expect(await rootVar(page, '--surface')).toBe('#334455');
  expect(await page.locator('[data-pfc=panel]').evaluate((el) => (el as any).__same)).toBe(true); // not rebuilt
  await expect(page.locator('[data-pfh=panel]')).toHaveValue('#334455');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rfp-prefs')!).colors.dark.panel)).toBe('#334455');
  await page.locator('[data-act=pfcolorreset][data-v=panel]').click();
  expect(await inlineVar(page, '--surface')).toBe('');
});

test('a theme preset sets dark mode, and the accent tint still works afterwards', async ({ page }) => {
  await openApp(page);
  await openCustomise(page);
  await page.locator('[data-act=pfpreset][data-v=forest]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await rootVar(page, '--acc')).toBe('79 208 143');
  await page.locator('[data-act=close]').last().click();
  await page.locator('#top [data-act=menu]').click();
  await page.locator('[data-act=tint][data-v=warm]').click();
  expect(await rootVar(page, '--acc')).toBe('38 198 232');
});

test('interface and workflow options take effect, and reset needs two taps', async ({ page }) => {
  await openApp(page);
  await openCustomise(page);
  await page.locator('[data-act=cztab][data-v=interface]').click();
  await page.locator('[data-act=pfset][data-k=textSize][data-v="120"]').click();
  expect(await rootVar(page, '--fs-m')).toBe('16.8px');
  await page.locator('[data-act=pfset][data-k=grid][data-v=none]').click();
  expect(await page.locator('#vp').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
  await setInput(page, '[data-pfn=nameW]', '300');
  expect(await rootVar(page, '--name')).toBe('300px');

  await page.locator('[data-act=cztab][data-v=workflow]').click();
  await page.locator('[data-act=pftog][data-k=loop]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rfp-prefs')!).loop)).toBe(false);

  const reset = page.locator('#cz-reset');
  await reset.click();
  expect(await rootVar(page, '--name')).toBe('300px');
  await reset.click();
  expect(await inlineVar(page, '--name')).toBe('');
  expect(await inlineVar(page, '--fs-m')).toBe('');
});

test('the dialog fits the screen and its body scrolls', async ({ page }) => {
  await openApp(page);
  await openCustomise(page);
  await page.locator('[data-act=cztab][data-v=workflow]').click();
  const d = (await page.locator('.dlg-cz').boundingBox())!, vp = page.viewportSize()!;
  expect(d.y).toBeGreaterThanOrEqual(0);
  expect(d.y + d.height).toBeLessThanOrEqual(vp.height);
  await expect(page.locator('.dlg-cz [data-act=close]')).toBeInViewport();
  const m = await page.locator('#cz-body').evaluate((el) => ({ w: el.scrollWidth - el.clientWidth }));
  expect(m.w).toBeLessThanOrEqual(0);
});
