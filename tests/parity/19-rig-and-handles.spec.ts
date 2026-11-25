import { test, expect, type Page } from '@playwright/test';
import { openApp, ptr, savedProject, center, layerG, isPortrait, settle } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const spot = async (page: Page) => { const v = (await page.locator('#vp').boundingBox())!; return (x: number, y: number) => [v.x + x, v.y + y] as const; };
const tap = async (page: Page, x: number, y: number) => { await ptr(page, 'pointerdown', x, y); await ptr(page, 'pointerup', x, y); };
const dragTo = async (page: Page, a: readonly number[], b: readonly number[], o: any = {}) => {
  await ptr(page, 'pointerdown', a[0], a[1], o);
  for (let i = 1; i <= 6; i++) await ptr(page, 'pointermove', a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6, o);
  await ptr(page, 'pointerup', b[0], b[1], o);
};
const project = (page: Page) => savedProject(page);

/* ---- curve handles: both move together by default, Separate pulls one ---- */
async function pathInEditMode(page: Page) {
  const at = await spot(page);
  await page.locator('#lstrip [data-v="pen"]').click();
  await tap(page, ...at(120, 300));
  await dragTo(page, at(260, 300), at(330, 300)); // level handles, clear of the quick bar
  await tap(page, ...at(420, 280));
  await page.keyboard.press('Enter');
  await page.locator('#qbar [data-act="peedit"]').click();
  await tap(page, ...at(260, 300)); // select the middle point: its two handles show
  await expect(page.locator('#ovl circle.mpd')).toHaveCount(2);
  return at;
}
const handles = async (page: Page) => {
  const c = page.locator('#ovl circle.mpd'), a = (await c.nth(0).boundingBox())!, b = (await c.nth(1).boundingBox())!;
  return a.x > b.x ? [a, b] : [b, a]; // [right (out), left (in)]
};
const mid = async (page: Page) => { const p = await project(page), l = p.layers.find((x: any) => x.type === 'path'); return l.pts[1]; };

test('dragging a handle moves the other one the opposite way by default', async ({ page }) => {
  await pathInEditMode(page);
  const before = await mid(page);
  const [out] = await handles(page), x = out.x + out.width / 2, y = out.y + out.height / 2;
  await dragTo(page, [x, y], [x + 30, y + 40]);
  const p = await mid(page);
  expect(p[5]).not.toBe(before[5]); // the out handle moved
  expect(p[2]).toBe(-p[4]); expect(p[3]).toBe(-p[5]); // and the in handle went the opposite way, as far
});

test('Separate pulls only the handle that is held', async ({ page }) => {
  await pathInEditMode(page);
  const before = await mid(page);
  await page.locator('#qbar [data-act="pesplit"]').click();
  await expect(page.locator('#qbar [data-act="pesplit"]')).toHaveAttribute('aria-pressed', 'true');
  const [out] = await handles(page), x = out.x + out.width / 2, y = out.y + out.height / 2;
  await dragTo(page, [x, y], [x + 30, y + 40]);
  const p = await mid(page);
  expect([p[2], p[3]]).toEqual([before[2], before[3]]); // the in handle stayed
  expect(p[5]).not.toBe(before[5]);
});

/* ---- Pencil with Mod held ---- */
test('a Pencil touch and the finger on Mod are not a two-finger tap', async ({ page }) => {
  const count = () => page.locator('#stage g[data-id]').count(), n0 = await count();
  await page.evaluate(() => {
    const b = document.querySelector('#modbtn')!, v = document.querySelector('#vp')!;
    const touch = (target: Element, id: number, type: string) => new Touch({ identifier: id, target, clientX: 400 + id, clientY: 300, touchType: type } as any);
    const fire = (type: string, target: Element, list: Touch[], changed: Touch[]) => window.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list, changedTouches: changed, targetTouches: list }));
    const f = touch(b, 1, 'direct'), s = touch(v, 2, 'stylus');
    fire('touchstart', b, [f], [f]); fire('touchstart', v, [f, s], [s]); fire('touchend', v, [f], [s]); fire('touchend', b, [], [f]);
  });
  await page.waitForTimeout(100);
  expect(await count()).toBe(n0);
  await expect(page.locator('#lstrip [data-act="undo"]')).toBeDisabled(); // nothing changed, and no undo ran
});

/* ---- rubber hose ---- */
test('the Rubber hose tool adds a hose with three joints, and dragging the hand bends it', async ({ page }) => {
  const at = await spot(page);
  await page.keyboard.press('u');
  await expect(page.locator('#shapebtn')).toHaveAttribute('data-v', 'hose');
  await dragTo(page, at(200, 300), at(500, 300));
  const p = await project(page), hose = p.layers.find((l: any) => l.type === 'hose');
  expect(hose.joints).toHaveLength(3);
  const joints = hose.joints.map((id: string) => p.layers.find((l: any) => l.id === id));
  expect(joints.every((j: any) => j.joint && j.type === 'null')).toBe(true);
  expect(joints[1].parent).toBe(joints[0].id); expect(joints[2].parent).toBe(joints[1].id);
  const d0 = await page.locator(`#stage g[data-id="${hose.id}"] path.hf`).getAttribute('d');
  expect(d0).toMatch(/^M.*C/);
  // The hand dot is the third joint dot. Dragging it turns the elbow, so the forearm swings.
  const dots = page.locator('#ovl circle.rg-j'); await expect(dots).toHaveCount(3);
  const b = (await dots.nth(2).boundingBox())!, x = b.x + b.width / 2, y = b.y + b.height / 2;
  await dragTo(page, [x, y], [x, y + 120]);
  const q = await project(page), elbow = q.layers.find((l: any) => l.id === joints[1].id);
  expect(Math.abs(elbow.p.rot.v)).toBeGreaterThan(10);
  expect(await page.locator(`#stage g[data-id="${hose.id}"] path.hf`).getAttribute('d')).not.toBe(d0);
});

test('the Rig tool adds a chain of joints and attaches a layer to a joint', async ({ page }) => {
  if (await isPortrait(page)) { await page.locator('#rstrip [aria-label="Properties"]').click(); await settle(page); }
  const at = await spot(page);
  await page.keyboard.press('j');
  await expect(page.locator('#qbar [data-act="rigmode"][aria-pressed="true"]')).toHaveText('Joints');
  await tap(page, ...at(150, 450)); await tap(page, ...at(260, 450));
  let p = await project(page);
  const js = p.layers.filter((l: any) => l.joint);
  expect(js).toHaveLength(2);
  expect(js.find((j: any) => j.parent)).toBeTruthy();
  // Attach: the newest joint is selected; tap a layer to make it follow that joint.
  await page.locator('#qbar [data-act="rigmode"][data-v="attach"]').click();
  const [cx, cy] = await center(layerG(page, 'core'));
  await tap(page, cx, cy);
  p = await project(page);
  const core = p.layers.find((l: any) => l.id === 'core');
  expect(core.parent).toBe(p.layers.find((l: any) => l.joint && l.parent).id);
});
