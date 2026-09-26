import { test, expect } from '../../playwright.config.js';

const cell = (text) => ({ type: 'paragraph', content: text ? [{ text, marks: [] }] : [] });
/** A 3×3 table "t" (header row a b c) followed by a bar chart "k" of it. */
async function fresh(page) {
  await page.goto('/#/play/tables');
  await page.locator('[data-type=table]').first().waitFor();
  const texts = ['name', 'x', 'y', 'one', '1', '2', 'two', '3', '4'];
  const ids = texts.map((_, i) => `c${i}`);
  await page.evaluate(
    ([texts, ids]) =>
      editor.setDoc({
        root: 'doc',
        blocks: {
          doc: { type: 'doc', children: ['p', 't', 'k'] },
          p: { type: 'paragraph', content: [{ text: 'before', marks: [] }] },
          t: { type: 'table', props: { cols: 3, header: true }, children: ids },
          k: { type: 'chart', props: { table: 't', kind: 'bar' } },
          ...Object.fromEntries(ids.map((id, i) => [id, { type: 'paragraph', content: texts[i] ? [{ text: texts[i], marks: [] }] : [] }])),
        },
      }),
    [texts, ids],
  );
  await page.locator('[data-block="c4"] [data-content]').click();
  await page.evaluate(() => window.__renderIds.splice(0));
  return ids;
}
const focus = (page) => page.evaluate(() => editor.view.read()?.focus.block);
const kids = (page) => page.evaluate(() => editor.get('t').children);
const caret = (page, block, offset = 0) => page.evaluate(([block, offset]) => editor.select({ anchor: { block, offset }, focus: { block, offset } }), [block, offset]);

test('F-33: Tab, ⇧Tab, Enter and arrows move between cells; Backspace and Delete never merge cells', async ({ page }) => {
  await fresh(page);
  await caret(page, 'c4', 0);
  await page.keyboard.press('Tab');
  await expect.poll(() => focus(page)).toBe('c5');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => focus(page)).toBe('c3');
  await page.keyboard.press('Enter');
  await expect.poll(() => focus(page)).toBe('c6');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => focus(page)).toBe('c0');
  await caret(page, 'c4', 0);
  await page.keyboard.press('Backspace');
  await caret(page, 'c4', 1);
  await page.keyboard.press('Delete');
  expect(await kids(page)).toHaveLength(9);
  expect(await page.evaluate(() => editor.get('c4').content[0].text)).toBe('1');
  await caret(page, 'c8', 1);
  await page.keyboard.press('Tab');
  expect(await kids(page)).toHaveLength(12);
});

test('F-33: adding and removing rows and columns is one undo step each and renders only the table', async ({ page }) => {
  const ids = await fresh(page);
  const bar = page.getByRole('toolbar', { name: 'Table' });
  const known = new Set([...ids, 't', 'k', 'p', 'doc']);
  const step = async (name, cols, count) => {
    await caret(page, 'c4');
    await page.evaluate(() => window.__renderIds.splice(0));
    await bar.getByRole('button', { name }).click();
    expect(await page.evaluate(() => [editor.get('t').props.cols, editor.get('t').children.length])).toEqual([cols, count]);
    expect((await page.evaluate(() => window.__renderIds.splice(0))).filter((id) => known.has(id))).toEqual(['t']);
    await caret(page, 'c0');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await kids(page)).toEqual(ids);
    expect(await page.evaluate(() => editor.get('t').props.cols)).toBe(3);
    await page.evaluate(() => window.__renderIds.splice(0));
  };
  await step('+ Row', 3, 12);
  await step('+ Column', 4, 12);
  await step('− Row', 3, 6);
  await step('− Column', 2, 6);
});

test('F-33: dragging a column edge resizes live without React, then commits one prop change', async ({ page }) => {
  await fresh(page);
  const grip = page.locator('[data-block="t"] i[data-col="0"]');
  const box = await grip.boundingBox();
  const x = box.x + box.width - 1;
  const y = box.y + 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 5 });
  expect(await page.evaluate(() => window.__renderIds.length)).toBe(0);
  const live = await page.evaluate(() => document.querySelector('[data-block="t"]').style.getPropertyValue('--cols'));
  await page.mouse.up();
  const widths = await page.evaluate(() => editor.get('t').props.widths);
  expect(widths).toHaveLength(3);
  expect(live).toBe(widths.map((w) => `${w}px`).join(' '));
  expect(widths[0] - widths[1]).toBeGreaterThan(40);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual(['t']);
});

test('F-33: cells are not draggable blocks, and slash menus or markdown rules do not fire inside them', async ({ page }) => {
  await fresh(page);
  const c = await page.locator('[data-block="c4"]').boundingBox();
  await page.mouse.move(c.x + 20, c.y + 10);
  const handle = await page.getByRole('button', { name: 'Drag to move' }).boundingBox();
  const table = await page.locator('[data-block="t"]').boundingBox();
  expect(Math.abs(handle.x + 24 - table.x)).toBeLessThan(2);
  await caret(page, 'c4', 1);
  await page.keyboard.type(' /');
  await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeHidden();
  await caret(page, 'c3', 0);
  await page.keyboard.type('# ');
  expect(await page.evaluate(() => [editor.get('c3').type, editor.get('t').children.length])).toEqual(['paragraph', 9]);
});

test('F-35: the chart draws from its table, redraws on cell edits with 0 React renders, and follows the theme', async ({ page }) => {
  await fresh(page);
  const bars = () => page.evaluate(() => [...document.querySelectorAll('[data-block="k"] rect')].map((r) => Math.round(+r.getAttribute('height'))));
  const before = await bars();
  expect(before).toHaveLength(4);
  await caret(page, 'c7', 1);
  await page.keyboard.type('0');
  await expect.poll(bars).not.toEqual(before);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  await page.locator('[data-block="k"] select').selectOption('line');
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  await expect(page.locator('[data-block="k"] polyline')).toHaveCount(2);
  const color = () =>
    page.evaluate(() => {
      const line = document.querySelector('[data-block="k"] polyline');
      const probe = document.createElement('div');
      probe.style.color = 'var(--v-chart-1)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(line).stroke, want];
    });
  const [shown, want] = await color();
  expect(shown).toBe(want);
  await page.getByRole('button', { name: /Theme:/ }).click();
  const [other] = await color();
  expect(other).not.toBe(shown);
});
