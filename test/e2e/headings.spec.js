import { test, expect } from '../../playwright.config.js';

async function fresh(page, blocks = { x: { type: 'paragraph', content: [] } }) {
  await page.goto('/#/play/structure');
  await page.locator('[data-content]').first().waitFor();
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), blocks);
  await page.locator('[data-block] [data-content]').first().click();
  await page.evaluate(() => window.__renderIds.splice(0));
}
const block = (page, id = 'x') => page.evaluate((id) => editor.getDoc().blocks[id], id);
const tag = (page, id = 'x') => page.evaluate((id) => editor.view.content(id)?.tagName, id);
const renders = (page) => page.evaluate(() => window.__renderIds.splice(0));
const kids = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.getDoc().blocks[id].type));
const focus = (page) => page.evaluate(() => editor.view.read()?.focus);

test('F-11: "#", "##", "###" + space convert in place, render one block, and undo as one step', async ({ page }) => {
  for (const level of [1, 2, 3]) {
    await fresh(page);
    await page.keyboard.type(`${'#'.repeat(level)} Title`);
    expect(await block(page)).toEqual({ type: 'heading', props: { level }, content: [{ text: 'Title', marks: [] }] });
    expect(await tag(page)).toBe(`H${level}`);
    expect(await renders(page)).toEqual(['x']);
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await block(page)).toEqual({ type: 'paragraph', content: [{ text: `${'#'.repeat(level)} `, marks: [] }] });
  }
});

test('F-11: ⌘⌥1–3 set the level and ⌘⌥0 reverts; the element is recreated only when the level changes', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [{ text: 'Hello', marks: [] }] } });
  await page.keyboard.press('ControlOrMeta+Alt+2');
  expect(await tag(page)).toBe('H2');
  expect(await renders(page)).toEqual(['x']);
  const kept = await page.evaluate(() => {
    const el = editor.view.content('x');
    editor.dispatch(editor.tx().setType('x', 'heading', { level: 2 }));
    return el === editor.view.content('x');
  });
  expect(kept).toBe(true);
  await page.keyboard.press('ControlOrMeta+Alt+3');
  expect(await tag(page)).toBe('H3');
  expect(await focus(page)).toEqual({ block: 'x', offset: 5 });
  await page.keyboard.press('ControlOrMeta+Alt+0');
  expect(await block(page)).toEqual({ type: 'paragraph', content: [{ text: 'Hello', marks: [] }] });
});

test('F-11: Enter after a heading starts a paragraph; Backspace at its start turns it into text', async ({ page }) => {
  await fresh(page, { x: { type: 'heading', props: { level: 1 }, content: [{ text: 'Head', marks: [] }] } });
  await page.evaluate(() => editor.select({ anchor: { block: 'x', offset: 4 }, focus: { block: 'x', offset: 4 } }));
  await page.keyboard.press('Enter');
  await page.keyboard.type('body');
  expect(await kids(page)).toEqual(['heading', 'paragraph']);
  await page.evaluate(() => editor.select({ anchor: { block: 'x', offset: 0 }, focus: { block: 'x', offset: 0 } }));
  await page.keyboard.press('Backspace');
  expect(await kids(page)).toEqual(['paragraph', 'paragraph']);
});

test('F-13: "---" makes a non-editable divider that arrows traverse and Backspace removes', async ({ page }) => {
  await fresh(page, { a: { type: 'paragraph', content: [{ text: 'above', marks: [] }] }, x: { type: 'paragraph', content: [] } });
  await page.locator('[data-block="x"] [data-content]').click();
  await page.keyboard.type('---');
  expect(await kids(page)).toEqual(['paragraph', 'divider', 'paragraph']);
  const [, hr, below] = await page.evaluate(() => editor.getDoc().blocks.doc.children);
  expect(await page.evaluate((hr) => editor.view.el(hr).tagName + editor.view.el(hr).isContentEditable, hr)).toBe('HRfalse');
  await page.keyboard.type('below');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await focus(page))?.block).toBe('a');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await focus(page))?.block).toBe(below);
  await page.evaluate((id) => editor.select({ anchor: { block: id, offset: 0 }, focus: { block: id, offset: 0 } }), below);
  await page.keyboard.press('Backspace');
  expect(await kids(page)).toEqual(['paragraph', 'paragraph']);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await kids(page)).toEqual(['paragraph', 'divider', 'paragraph']);
  await page.locator(`[data-block="${hr}"]`).click();
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: [hr] });
  await page.keyboard.press('Backspace');
  expect(await kids(page)).toEqual(['paragraph', 'paragraph']);
});
