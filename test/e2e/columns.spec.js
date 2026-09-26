import { test, expect } from '../../playwright.config.js';

const p = (text) => ({ type: 'paragraph', content: [{ text, marks: [] }] });
async function fresh(page) {
  await page.goto('/#/play/layout');
  await page.locator('[data-type=columns]').first().waitFor();
  const blocks = {
    doc: { type: 'doc', children: ['row', 'after'] },
    row: { type: 'columns', children: ['l', 'r'] },
    l: { type: 'column', children: ['a', 'b'] },
    r: { type: 'column', children: ['c'] },
    a: p('alpha'),
    b: p('beta'),
    c: p('gamma'),
    after: p('after'),
  };
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks }), blocks);
  await page.evaluate(() => window.__renderIds.splice(0));
}
const cols = (page) => page.evaluate(() => ['l', 'r'].map((c) => editor.get(c)?.children ?? []));
async function drag(page, from, to, below = true) {
  const s = await page.locator(`[data-block="${from}"]`).boundingBox();
  const d = await page.locator(`[data-block="${to}"]`).boundingBox();
  await page.mouse.move(s.x + 30, s.y + 8);
  await page.mouse.move(s.x - 14, s.y + 12, { steps: 4 });
  await page.mouse.down();
  await page.mouse.move(d.x + d.width / 2, below ? d.y + d.height - 4 : d.y + 4, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

test('F-23: "/2 columns" inserts a grid of two columns, each ready to type in, as one undo step', async ({ page }) => {
  await page.goto('/#/play/layout');
  await page.locator('[data-type=columns]').first().waitFor();
  await page.evaluate(() => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['x'] }, x: { type: 'paragraph', content: [] } } }));
  await page.locator('[data-block="x"] [data-content]').click();
  await page.keyboard.type('/2 col');
  await page.keyboard.press('Enter');
  await page.keyboard.type('left side');
  const shape = await page.evaluate(() => {
    const [row] = editor.getDoc().blocks.doc.children;
    return [editor.get(row).type, editor.get(row).children.map((c) => [editor.get(c).type, editor.get(c).children.map((id) => editor.len(id))])];
  });
  expect(shape).toEqual(['columns', [['column', [9]], ['column', [0]]]]);
  const box = await page.evaluate(() => [...document.querySelectorAll('[data-type=column]')].map((c) => Math.round(c.getBoundingClientRect().top)));
  expect(box[0]).toBe(box[1]);
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id).type))).toEqual(['paragraph']);
});

test('F-23: blocks drag between columns — one undoable move, rendering only the two columns', async ({ page }) => {
  await fresh(page);
  await drag(page, 'b', 'c');
  expect(await cols(page)).toEqual([['a'], ['c', 'b']]);
  expect((await page.evaluate(() => window.__renderIds.splice(0))).sort()).toEqual(['b', 'l', 'r']);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await cols(page)).toEqual([['a', 'b'], ['c']]);
});

test('F-23: an emptied column still takes a drop, and clicking it starts a paragraph', async ({ page }) => {
  await fresh(page);
  await drag(page, 'c', 'b');
  expect(await cols(page)).toEqual([['a', 'b', 'c'], []]);
  await expect(page.locator('[data-block="r"]')).toBeVisible();
  await drag(page, 'a', 'r');
  expect(await cols(page)).toEqual([['b', 'c'], ['a']]);
  await drag(page, 'a', 'c');
  await page.locator('[data-block="r"]').click();
  const [, right] = await cols(page);
  expect(right).toHaveLength(1);
  expect(await page.evaluate((id) => editor.selection.focus.block === id, right[0])).toBe(true);
});

test('F-23: Backspace at the start of a column never merges across columns', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => editor.select({ anchor: { block: 'c', offset: 0 }, focus: { block: 'c', offset: 0 } }));
  await page.keyboard.press('Backspace');
  expect(await cols(page)).toEqual([['a', 'b'], ['c']]);
  expect(await page.evaluate(() => editor.get('c').content[0].text)).toBe('gamma');
});

test('F-23: columns stack into one on narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await fresh(page);
  const [l, r] = await page.evaluate(() => ['l', 'r'].map((c) => document.querySelector(`[data-block="${c}"]`).getBoundingClientRect().toJSON()));
  expect(r.top).toBeGreaterThanOrEqual(l.bottom - 1);
  expect(Math.round(r.left)).toBe(Math.round(l.left));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('F-23: columns stack when the editor itself is narrow, whatever the window size', async ({ page }) => {
  await fresh(page);
  const tops = () => page.evaluate(() => ['l', 'r'].map((c) => Math.round(document.querySelector(`[data-block="${c}"]`).getBoundingClientRect().top)));
  const [l, r] = await tops();
  expect(l).toBe(r);
  await page.evaluate(() => (document.querySelector('[data-verbal]').style.width = '360px'));
  const [l2, r2] = await tops();
  expect(r2).toBeGreaterThan(l2);
});
