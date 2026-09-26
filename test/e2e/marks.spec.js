import { test, expect } from '../../playwright.config.js';

/** Opens the Formatting page and replaces its document with one paragraph, id "x". */
async function fresh(page, text = '') {
  await page.goto('/#/play/formatting');
  await page.locator('[data-content]').first().waitFor();
  await page.evaluate((text) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['x'] }, x: { type: 'paragraph', content: text ? [{ text, marks: [] }] : [] } } }), text);
  await page.locator('[data-block="x"] [data-content]').click();
}
const select = (page, from, to) => page.evaluate(([from, to]) => editor.select({ anchor: { block: 'x', offset: from }, focus: { block: 'x', offset: to } }), [from, to]);
const html = (page) => page.evaluate(() => editor.view.content('x').innerHTML);
const runs = (page) => page.evaluate(() => editor.getDoc().blocks.x.content.map((r) => [r.text, r.marks.map((m) => m.type).join('+')]));
const renders = (page) => page.evaluate(() => window.__renderIds.splice(0));

test('F-10: shortcuts mark by DOM surgery with identical markup in every engine and 0 renders', async ({ page }) => {
  await fresh(page, 'abcdef');
  await renders(page);
  await select(page, 0, 4);
  await page.keyboard.press('ControlOrMeta+b');
  await select(page, 2, 6);
  await page.keyboard.press('ControlOrMeta+i');
  await select(page, 1, 3);
  await page.keyboard.press('ControlOrMeta+Shift+s');
  expect(await html(page)).toBe('<strong>a<s>b</s><em><s>c</s>d</em></strong><em>ef</em>');
  await select(page, 0, 6);
  await page.keyboard.press('ControlOrMeta+e');
  expect(await runs(page)).toEqual([['a', 'bold+code'], ['b', 'bold+code+strike'], ['c', 'bold+code+italic+strike'], ['d', 'bold+code+italic'], ['ef', 'code+italic']]);
  await page.keyboard.press('ControlOrMeta+b');
  expect(await runs(page)).toContainEqual(['def', 'bold+code+italic']);
  await page.keyboard.press('ControlOrMeta+b');
  expect((await runs(page)).some(([, m]) => m.includes('bold'))).toBe(false);
  expect(await renders(page)).toEqual([]);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ControlOrMeta+z');
  expect(await html(page)).toBe('abcdef');
  expect(await page.evaluate(() => editor.selection)).toEqual({ anchor: { block: 'x', offset: 0 }, focus: { block: 'x', offset: 4 } });
});

test('F-14: inline markdown converts when closed and one undo restores the typed characters', async ({ page }) => {
  await fresh(page);
  await page.keyboard.type('**big** and `x` then _it_ ~~no~~ *em* end');
  expect(await html(page)).toBe('<strong>big</strong> and <code>x</code> then <em>it</em> <s>no</s> <em>em</em> end');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await html(page)).toBe('<strong>big</strong> and <code>x</code> then <em>it</em> <s>no</s> *em*');
});

test('stored marks: a shortcut with a caret styles what is typed next; code does not extend past its end', async ({ page }) => {
  await fresh(page);
  await page.keyboard.type('a');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('BOLD');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('plain `code`after');
  expect(await runs(page)).toEqual([['a', ''], ['BOLD', 'bold'], ['plain ', ''], ['code', 'code'], ['after', '']]);
});

test('F-42: toolbar appears on release, stays inside the viewport, reflects and toggles marks, dismisses on collapse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await fresh(page, 'Select the very last word of this line please');
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  // Drag across the last word where it actually lands, so the line's wrap (which follows the fonts) doesn't matter.
  const word = await page.locator('[data-block="x"] [data-content]').evaluate((el) => {
    const text = [...el.childNodes].findLast((n) => n.nodeType === 3);
    const r = document.createRange();
    r.setStart(text, text.data.lastIndexOf(' ') + 1);
    r.setEnd(text, text.data.length);
    const { left, right, top, height } = r.getBoundingClientRect();
    return { left, right, y: top + height / 2 };
  });
  await page.mouse.move(word.right - 1, word.y);
  await page.mouse.down();
  await page.mouse.move(word.left + 1, word.y, { steps: 4 });
  await expect(bar).toBeHidden();
  await page.mouse.up();
  await expect(bar).toBeVisible();
  const b = await bar.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(8);
  expect(b.x + b.width).toBeLessThanOrEqual(390 - 8);
  const bold = bar.getByTitle(/Bold/);
  await expect(bold).toHaveAttribute('aria-pressed', 'false');
  await bold.click();
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  expect((await runs(page)).some(([, m]) => m === 'bold')).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(bar).toBeHidden();
});
