import { test, expect } from '@playwright/test';
import { openApp, insertLayer, openRight, isPortrait, settle } from './helpers';

test.skip(process.env.RF_TARGET === 'legacy', 'app only');

test('landscape: the right panel stays open until it covers 60% of the dragged layer', async ({ page }) => {
  await openApp(page);
  test.skip(await isPortrait(page), 'landscape only');
  await insertLayer(page, 'text');
  await openRight(page, 'Properties');
  await settle(page);
  const app = page.locator('#app');
  const sel = (await page.locator('#selbox').boundingBox())!, panel = (await page.locator('#rpanel').boundingBox())!;
  const x = sel.x + sel.width / 2, y = sel.y + sel.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y, { steps: 3 });
  await page.waitForTimeout(80);
  await expect(app).toHaveClass(/folding/);
  await expect(app).not.toHaveClass(/fold-right/);

  // Just under the limit: 40% of the layer is over the panel.
  const at = (share: number) => x + (panel.x - sel.x - sel.width * (1 - share));
  await page.mouse.move(at(.4), y, { steps: 4 });
  await page.waitForTimeout(80);
  await expect(app).not.toHaveClass(/fold-right/);

  await page.mouse.move(at(.7), y, { steps: 4 });
  await expect(app).toHaveClass(/fold-right/);

  await page.mouse.move(x, y, { steps: 4 });
  await expect(app).not.toHaveClass(/fold-right/);
  await page.mouse.up();
  await expect(app).not.toHaveClass(/folding/);
});
