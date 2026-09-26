import { test, expect } from '../../playwright.config.js';

const p = (text) => ({ type: 'paragraph', content: text ? [{ text, marks: [] }] : [] });
async function fresh(page, blocks) {
  await page.goto('/#/play/welcome');
  await page.locator('[data-block]').first().waitFor();
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), blocks);
  await page.locator(`[data-block="${Object.keys(blocks)[0]}"]`).waitFor();
  await page.waitForFunction(() => document.getAnimations().length === 0);
}
/** A finger-sized hit area: every point 21px from the control's centre still lands on it (the screen edge counts as part of it). */
const hit44 = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
    const on = (v, max) => Math.min(Math.max(v, 0), max - 1);
    return [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => el.contains(document.elementFromPoint(on(x + dx, innerWidth), on(y + dy, innerHeight))));
  });
const handle = (page) => page.getByRole('button', { name: 'Drag to move' });

test('tapping a block shows its drag handle on screen; tapping the handle selects the block', async ({ page }) => {
  await fresh(page, { a: p('Alpha'), b: p('Beta'), c: p('Gamma') });
  await page.locator('[data-block="b"] [data-content]').tap();
  await expect(handle(page)).toBeVisible();
  const box = await handle(page).boundingBox();
  const b = await page.locator('[data-block="b"]').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(Math.abs(box.y - b.y)).toBeLessThan(8);
  expect(await hit44(handle(page))).toBe(true);
  await handle(page).tap();
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: ['b'] });
});

test('a touch drag on the handle moves the block', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'touch pointer sequences are dispatched through the Chromium DevTools protocol');
  await fresh(page, { a: p('Alpha'), b: p('Beta'), c: p('Gamma') });
  await page.locator('[data-block="a"] [data-content]').tap();
  const h = await handle(page).boundingBox();
  const c = await page.locator('[data-block="c"]').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', h.x + h.width / 2, h.y + h.height / 2);
  for (let i = 1; i <= 6; i++) await touch('touchMove', h.x + 40, h.y + ((c.y + c.height - 3 - h.y) * i) / 6);
  await touch('touchEnd');
  await expect.poll(() => page.evaluate(() => editor.getDoc().blocks.doc.children)).toEqual(['b', 'c', 'a']);
});

test('controls are finger-sized, nothing hides behind hover, and fields never trigger iOS zoom', async ({ page }) => {
  await fresh(page, {
    t: { type: 'todo', props: { checked: false }, content: [{ text: 'task', marks: [] }] },
    k: { type: 'code', props: { lang: 'js' }, content: [{ text: 'let a = 1', marks: [] }] },
    g: { type: 'table', props: { cols: 2, header: true }, children: ['c1', 'c2', 'c3', 'c4'] },
    c1: p('x'), c2: p('y'), c3: p('1'), c4: p('2'),
    m: { type: 'embed', props: { url: '' } },
  });
  expect(await hit44(page.locator('[data-block="t"] [role=checkbox]'))).toBe(true);
  const bar = page.locator('[data-block="k"] select').locator('..');
  expect(await bar.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  for (const control of await page.locator('[data-block="k"] select, [data-block="k"] button').all()) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('[data-block="c3"] [data-content]').tap();
  for (const b of await page.getByRole('toolbar', { name: 'Table' }).getByRole('button').all()) expect(await hit44(b)).toBe(true);
  const small = await page.evaluate(() => [...document.querySelectorAll('[data-verbal] input, [data-verbal] select, [data-verbal] textarea')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length);
  expect(small).toBe(0);
});

test('the selection toolbar opens below the selection on touch, with finger-sized buttons', async ({ page }) => {
  await fresh(page, { a: p('Select some of these words') });
  await page.evaluate(() => editor.select({ anchor: { block: 'a', offset: 7 }, focus: { block: 'a', offset: 11 } }));
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  await expect(bar).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const text = await page.locator('[data-block="a"] [data-content]').boundingBox();
  expect((await bar.boundingBox()).y).toBeGreaterThan(text.y + text.height - 4);
  for (const b of await bar.getByRole('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('menus stay inside the visible viewport when the on-screen keyboard shrinks it', async ({ page }) => {
  await fresh(page, { a: p('first'), b: p('') });
  const b = await page.locator('[data-block="b"]').boundingBox();
  // Stand in for an open keyboard: the visible viewport ends just below the empty line.
  await page.evaluate((bottom) => {
    const real = visualViewport;
    window.__vv = real;
    window.visualViewport = Object.assign(new EventTarget(), { offsetTop: 0, height: bottom, width: innerWidth });
  }, b.y + b.height + 20);
  await page.locator('[data-block="b"] [data-content]').tap();
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'Insert block' });
  await expect(menu).toBeVisible();
  const m = await menu.boundingBox();
  expect(m.y + m.height).toBeLessThanOrEqual(b.y + 2);
  await page.keyboard.press('Escape');
});
