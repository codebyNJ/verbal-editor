import { test, expect } from '../../playwright.config.js';

const r = (text) => [{ text, marks: [] }];
async function fresh(page, blocks, children = Object.keys(blocks)) {
  await page.goto('/#/play/welcome');
  await page.locator('[data-content]').first().waitFor();
  await page.evaluate(([blocks, children]) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children }, ...blocks } }), [blocks, children]);
  await page.locator(`[data-block="${children.at(-1)}"] [data-content]`).click();
  await page.evaluate(() => window.__renderIds.splice(0));
}
const menu = (page) => page.getByRole('listbox', { name: 'Insert block' });
const labels = (page) => menu(page).getByRole('option').evaluateAll((els) => els.map((e) => e.lastChild.textContent));
const types = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id).type));
const order = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children);

test('F-40: "/" lists every registered module entry; label and keyword filtering; keyboard picks', async ({ page }) => {
  await fresh(page, { a: { type: 'paragraph', content: r('first') }, x: { type: 'paragraph', content: [] } });
  await page.keyboard.type('/');
  await expect(menu(page)).toBeVisible();
  expect(await labels(page)).toEqual(await page.evaluate(() => editor.registry.slash.map((e) => e.label)));
  await page.keyboard.type('ul');
  const matching = await page.evaluate(() => editor.registry.slash.filter((e) => [e.label, ...(e.keywords ?? [])].some((w) => w.toLowerCase().includes('ul'))).map((e) => e.label));
  await expect.poll(async () => (await labels(page))[0]).toBe('Bulleted list');
  expect((await labels(page)).toSorted()).toEqual(matching.toSorted());
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('head');
  await expect.poll(() => labels(page)).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('option', { name: 'Heading 2' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => editor.get('x'))).toEqual({ type: 'heading', props: { level: 2 }, content: [] });
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => editor.get('x'))).toEqual({ type: 'paragraph', content: r('/head') });
});

test('F-40: voids insert after with a paragraph to type in; mouse works; Escape and mid-word slashes do not open', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [] } });
  await page.keyboard.type('/divi');
  await menu(page).getByRole('option', { name: 'Divider' }).click();
  expect(await types(page)).toEqual(['divider', 'paragraph']);
  await page.keyboard.type('and/or');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.type(' /');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.type('zzz ');
  await expect(menu(page)).toBeHidden();
});

async function dragHandle(page, from, to, below) {
  const src = await page.locator(`[data-block="${from}"]`).boundingBox();
  const dst = await page.locator(`[data-block="${to}"]`).boundingBox();
  await page.mouse.move(src.x + 40, src.y + 8);
  await page.mouse.move(src.x - 14, src.y + 12, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(dst.x + 80, below ? dst.y + dst.height - 3 : dst.y + 3, { steps: 6 });
}

test('F-41: a pointer drag shows the drop line and lands as one undoable moveBlock that renders one block', async ({ page }) => {
  await fresh(page, { a: { type: 'paragraph', content: r('a') }, b: { type: 'paragraph', content: r('b') }, c: { type: 'paragraph', content: r('c') } });
  await dragHandle(page, 'a', 'c', true);
  await expect(page.locator('[data-block="a"]')).toHaveAttribute('data-moving', '');
  expect(await page.evaluate(() => !document.querySelector('.v-dnd-line').hidden)).toBe(true);
  await page.mouse.up();
  expect(await order(page)).toEqual(['b', 'c', 'a']);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual(['doc']);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-block]')].some((h) => h.style.translate))).toBe(false);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await order(page)).toEqual(['a', 'b', 'c']);
});

test('F-41: dropping onto a nested block moves across parents; ⌘⇧↑ reorders by keyboard', async ({ page }) => {
  await fresh(page, {
    l: { type: 'list', props: { ordered: false }, content: r('list'), children: ['n'] },
    n: { type: 'list', props: { ordered: false }, content: r('nested') },
    p: { type: 'paragraph', content: r('para') },
  }, ['l', 'p']);
  await dragHandle(page, 'p', 'n', true);
  await page.mouse.up();
  expect(await page.evaluate(() => editor.get('l').children)).toEqual(['n', 'p']);
  await page.evaluate(() => editor.select({ anchor: { block: 'p', offset: 0 }, focus: { block: 'p', offset: 0 } }));
  await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  expect(await page.evaluate(() => editor.get('l').children)).toEqual(['p', 'n']);
});

test('F-41: works with touch (Pointer Events from a real touch sequence)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'touch input is dispatched through the Chromium DevTools protocol');
  await fresh(page, { a: { type: 'paragraph', content: r('a') }, b: { type: 'paragraph', content: r('b') } });
  const src = await page.locator('[data-block="a"]').boundingBox();
  await page.mouse.move(src.x + 40, src.y + 8);
  const h = await page.getByRole('button', { name: 'Drag to move' }).boundingBox();
  const dst = await page.locator('[data-block="b"]').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', h.x + 10, h.y + 12);
  for (let i = 1; i <= 6; i++) await touch('touchMove', h.x + 10 + i * 20, h.y + 12 + ((dst.y + dst.height - 3 - h.y - 12) * i) / 6);
  await touch('touchEnd');
  expect(await order(page)).toEqual(['b', 'a']);
});

test('dragging across text selects whole blocks', async ({ page }) => {
  await fresh(page, { a: { type: 'paragraph', content: r('alpha') }, b: { type: 'paragraph', content: r('beta') }, c: { type: 'paragraph', content: r('gamma') } });
  const a = await page.locator('[data-block="a"] [data-content]').boundingBox();
  const c = await page.locator('[data-block="c"] [data-content]').boundingBox();
  await page.mouse.move(a.x + 10, a.y + 8);
  await page.mouse.down();
  await page.mouse.move(c.x + 10, c.y + 8, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: ['a', 'b', 'c'] });
  await page.keyboard.press('Backspace');
  expect(await types(page)).toEqual(['paragraph']);
});

const five = () => Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { type: 'paragraph', content: r(id.toUpperCase()) }]));
const settle = (page) => page.waitForFunction(() => document.getAnimations().length === 0);

test('F-41: grabbing a selected block drags the whole selection, in order, as one undo step', async ({ page }) => {
  await fresh(page, five());
  await page.evaluate(() => editor.select({ blocks: ['b', 'c'] }));
  await dragHandle(page, 'c', 'e', true);
  for (const id of ['b', 'c']) await expect(page.locator(`[data-block="${id}"]`)).toHaveAttribute('data-moving', '');
  await page.mouse.up();
  await settle(page);
  expect(await order(page)).toEqual(['a', 'd', 'e', 'b', 'c']);
  expect(await page.evaluate(() => [editor.selection, window.__renderIds.splice(0)])).toEqual([{ blocks: ['b', 'c'] }, ['doc']]);
  await page.locator('[data-block="a"] [data-content]').click();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await order(page)).toEqual(['a', 'b', 'c', 'd', 'e']);
});

test('F-41: Esc cancels a drag, a click on the handle selects its block, and a drop below the last block lands at the end', async ({ page }) => {
  await fresh(page, five());
  await dragHandle(page, 'a', 'd', true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => [document.querySelector('.v-dnd-line').hidden, !!document.querySelector('[data-moving]')])).toEqual([true, false]);
  await page.mouse.up();
  expect(await order(page)).toEqual(['a', 'b', 'c', 'd', 'e']);
  const c = await page.locator('[data-block="c"]').boundingBox();
  await page.mouse.move(c.x + 40, c.y + 8);
  await page.mouse.move(c.x - 14, c.y + 12, { steps: 3 });
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: ['c'] });
  const a = await page.locator('[data-block="a"]').boundingBox();
  const e = await page.locator('[data-block="e"]').boundingBox();
  await page.mouse.move(a.x + 40, a.y + 8);
  await page.mouse.move(a.x - 14, a.y + 12, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(e.x + 80, e.y + e.height + 40, { steps: 6 });
  expect(await page.evaluate(() => !document.querySelector('.v-dnd-line').hidden)).toBe(true);
  await page.mouse.up();
  expect(await order(page)).toEqual(['b', 'c', 'd', 'e', 'a']);
});

test('F-41: holding a dragged block at the edge scrolls the page, so it can go anywhere', async ({ page }) => {
  await page.goto('/#/play/bench');
  await page.locator('[data-block]').nth(399).waitFor();
  await settle(page);
  const ids = await order(page);
  const offscreen = await page.evaluate(() => [...document.querySelectorAll('[data-block]')].filter((h) => h.getBoundingClientRect().top > innerHeight).map((h) => h.dataset.block));
  const src = await page.locator(`[data-block="${ids[1]}"]`).boundingBox();
  await page.mouse.move(src.x + 40, src.y + 8);
  await page.mouse.move(src.x - 14, src.y + 12, { steps: 3 });
  await page.mouse.down();
  const top = () => page.evaluate(() => document.querySelector('[class*="scroll"]').scrollTop);
  const before = await top();
  await page.mouse.move(src.x + 80, page.viewportSize().height - 10, { steps: 4 });
  await expect.poll(top, { timeout: 5000 }).toBeGreaterThan(before + 600);
  await page.mouse.move(src.x + 80, page.viewportSize().height / 2, { steps: 4 });
  const held = await top();
  await page.waitForTimeout(200);
  expect(await top()).toBe(held);
  await page.mouse.up();
  const after = await order(page);
  expect(offscreen).toContain(after[after.indexOf(ids[1]) - 1]);
});

test('F-41: letting go in the gap between two blocks still drops there', async ({ page }) => {
  await fresh(page, five());
  const [c, d] = [await page.locator('[data-block="c"]').boundingBox(), await page.locator('[data-block="d"]').boundingBox()];
  const x = c.x + 80;
  // A point between c and d that belongs to neither block.
  const y = await page.evaluate(([x, from, to]) => {
    for (let y = from; y <= to; y++) if (!document.elementFromPoint(x, y)?.closest('[data-block]')) return y;
    return (from + to) / 2;
  }, [x, Math.floor(c.y + c.height - 2), Math.ceil(d.y + 2)]);
  const a = await page.locator('[data-block="a"]').boundingBox();
  await page.mouse.move(a.x + 40, a.y + 8);
  await page.mouse.move(a.x - 14, a.y + 12, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
  const after = await order(page);
  expect(after.indexOf('a')).toBeGreaterThan(after.indexOf('b'));
});

test('⇧-click extends a selection to whole blocks', async ({ page }) => {
  await fresh(page, five());
  await page.locator('[data-block="b"] [data-content]').click();
  await page.locator('[data-block="d"] [data-content]').click({ modifiers: ['Shift'] });
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: ['b', 'c', 'd'] });
  await expect(page.locator('[data-block][data-selected]')).toHaveCount(3);
});
