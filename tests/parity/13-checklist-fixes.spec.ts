import { test, expect, type Page } from '@playwright/test';
import { openApp, openRight, savedProject, layerG, drag, center, typeExact, hitPoint, ptr, settle } from './helpers';

// Fixes from the Notion testing checklist (November 2026). These cover the ported app only.

const st = (v: number) => ({ v });
const P = (x: number, y: number) => ({ x: st(x), y: st(y), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) });
const rect = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, name: id, type: 'rect', hue: '#4aa8ff', w: 300, h: 200, cr: 20, vis: true, lock: false, fx: [], p: P(x, y), ...extra });
const project = (layers: unknown[]) => ({ project: { layers, markers: [], dur: 150, name: 'Checklist' } });
const saved = async (page: Page, id: string) => (await savedProject(page)).layers.find((l: any) => l.id === id);

async function select(page: Page, id: string) {
  const [x, y] = await hitPoint(page, id);
  await ptr(page, 'pointerdown', x, y);
  await ptr(page, 'pointerup', x, y);
  await expect(page.locator('#lname')).toHaveValue(id);
}

test('a child follows a parent that has no keyframes', async ({ page }) => {
  await openApp(page, { storage: project([rect('kid', 1400, 540, { parent: 'dad', pt: 0 }), rect('dad', 700, 540)]) });
  const before = (await layerG(page, 'kid').boundingBox())!;
  await select(page, 'dad');
  await openRight(page, 'Properties');
  await typeExact(page, page.locator('#rpanel .fld[data-p="x"]').first(), '500');
  const sc = (await page.locator('#stage').boundingBox())!.width / 1920;
  await expect.poll(async () => Math.round(((await layerG(page, 'kid').boundingBox())!.x - before.x) / sc)).toBe(-200);
});

test('dash: gap and offset can be dragged before a number is typed', async ({ page }) => {
  await openApp(page, { storage: project([rect('box', 960, 540, { sw: 6, stroke: '#ffffff' })]) });
  await select(page, 'box');
  await openRight(page, 'Properties');
  const dash = page.locator('#rpanel .fld[data-k="dash"]').first();
  await dash.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const [x, y] = await center(dash);
  await drag(page, [x, y], [x + 60, y], { type: 'pen', steps: 10 });
  await expect.poll(async () => (await saved(page, 'box')).dash).toBeGreaterThan(0);
  const gap = page.locator('#rpanel .fld[data-k="dgap"]').first();
  await expect(gap).toBeVisible();
  // The gap starts from a real number (it used to be empty, so a drag did nothing).
  const g0 = Number(await gap.getAttribute('aria-valuenow'));
  expect(g0).toBeGreaterThan(0);
  const [gx, gy] = await center(gap);
  await drag(page, [gx, gy], [gx + 50, gy], { type: 'pen', steps: 10 });
  await expect.poll(async () => (await saved(page, 'box')).dgap).toBeGreaterThan(g0);
});

test('duplicator: grid lays copies out in rows', async ({ page }) => {
  await openApp(page, { storage: project([rect('box', 760, 400, { w: 80, h: 80, rep: { on: true, mode: 'linear', count: 6, dx: 120, dy: 0, rot: 0, sc: 0, rad: 160, align: true, cols: 3, fade: 0, stag: 0 } })]) });
  await select(page, 'box');
  await openRight(page, 'Duplicator');
  await page.locator('#rpanel select[data-sel="repmode"]').selectOption('grid');
  await expect.poll(async () => (await saved(page, 'box')).rep.dy).toBe(120);
  const ys = await page.locator('#stage g[data-id="box"] > .xf').evaluateAll((xs) => [...new Set(xs.map((x) => Math.round(x.getBoundingClientRect().y)))]);
  expect(ys.length).toBe(2);
});

test('effects: options, effect colours and Shader fill', async ({ page }) => {
  await openApp(page, { storage: project([rect('box', 960, 540, { fx: [{ id: 'glow', name: 'Glow', on: true, radius: 20, amount: 60 }] })]) });
  await select(page, 'box');
  await openRight(page, 'Effects');
  await page.locator('#rpanel select[data-sel="fxopt"][data-k="tint"]').selectOption('col');
  const chip = page.locator('#rpanel .cchip[data-key="fx0.col"]');
  await expect(chip).toBeVisible();
  await chip.click();
  const sw = page.locator('.pop.cp [data-act="cpsw"]').nth(2);
  const hex = (await sw.getAttribute('data-v'))!.toLowerCase();
  await sw.click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => String((await saved(page, 'box')).fx[0].col).toLowerCase()).toBe(hex);
  await expect(page.locator(`#stage filter#fx-box feFlood[flood-color="${hex}"]`)).toHaveCount(1);

  await page.locator('#rpanel [data-act="addfx"]').first().click();
  await page.locator('#layer-pop [data-act="fxadd"][data-v="shader"]').click();
  // The shader is masked to the shape, so it never spills outside it.
  await expect(page.locator('#stage g[data-id="box"] g[mask] foreignObject.shfx')).toHaveCount(1);
  expect((await saved(page, 'box')).fx[1]).toMatchObject({ id: 'shader', on: true });
});

test('effects: bake turns the layer and its effects into a picture', async ({ page }) => {
  await openApp(page, { storage: project([rect('box', 960, 540, { fx: [{ id: 'glow', name: 'Glow', on: true, radius: 20, amount: 60 }] })]) });
  await select(page, 'box');
  await openRight(page, 'Effects');
  await page.locator('#rpanel [data-act="fxbake"]').click();
  await expect.poll(async () => (await saved(page, 'box')).type).toBe('image');
  const l = await saved(page, 'box');
  expect(String(l.src)).toMatch(/^data:image\/png/);
  expect(l.fx.filter((e: any) => e.id === 'glow')).toHaveLength(0);
  expect(l.w).toBeGreaterThan(300); // the glow reaches past the shape
  await expect(layerG(page, 'box').locator('image')).toHaveCount(1);
});

test('timeline: a selected keyframe draws no box around itself', async ({ page }) => {
  const p = { ...P(400, 540), x: { keys: [{ t: 0, v: 400 }, { t: 70, v: 900 }] } };
  await openApp(page, { storage: project([rect('box', 400, 540, { p })]) });
  const expand = page.getByRole('button', { name: 'Expand timeline' });
  if (await expand.count()) await expand.click();
  await page.locator('#tlrows .dk[data-dk="agg"]').nth(1).click();
  const dk = page.locator('#tlrows .dk.sel').first();
  await expect(dk).toHaveCount(1);
  const s = await dk.evaluate((d) => { const c = getComputedStyle(d); return [c.backgroundColor, c.boxShadow]; });
  expect(s).toEqual(['rgba(0, 0, 0, 0)', 'none']);
});

test('phone portrait: the canvas sits above the settings sheet and the time readout is clear of the scrubber', async ({ page }) => {
  test.skip(test.info().project.name !== 'webkit-portrait', 'one project is enough');
  await openApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  const sb = (await page.locator('#stage').boundingBox())!, pr = await page.locator('.panel.r').boundingBox();
  if (pr && pr.height > 0) expect(sb.y + sb.height).toBeLessThanOrEqual(pr.y + 2);
  const t = (await page.locator('#tcode').boundingBox())!, s = (await page.locator('#scrub').boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(s.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
