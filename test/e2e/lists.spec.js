import { test, expect } from '../../playwright.config.js';

async function fresh(page, blocks = { x: { type: 'paragraph', content: [] } }, children = Object.keys(blocks)) {
  await page.goto('/#/play/lists');
  await page.locator('[data-content]').first().waitFor();
  await page.evaluate(([blocks, children]) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children }, ...blocks } }), [blocks, children]);
  await page.locator(`[data-block="${children[0]}"] [data-content]`).click();
  await page.evaluate(() => window.__renderIds.splice(0));
}
const tree = (page) =>
  page.evaluate(() => {
    const d = editor.getDoc();
    const show = (id) => {
      const b = d.blocks[id];
      const kids = (b.children ?? []).map(show);
      return [`${b.type}${b.props?.ordered ? '#' : ''}${b.props?.checked ? '✓' : ''}`, b.content.map((r) => r.text).join(''), ...(kids.length ? [kids] : [])];
    };
    return d.blocks.doc.children.map(show);
  });
const item = (text, ordered) => ({ type: 'list', props: { ordered }, content: [{ text, marks: [] }] });
const caret = (page, block, offset = 0) => page.evaluate(([block, offset]) => editor.select({ anchor: { block, offset }, focus: { block, offset } }), [block, offset]);

test('F-20: "- ", "* " and "1. " start lists; Enter continues; Enter on an empty item outdents, then leaves', async ({ page }) => {
  await fresh(page);
  await page.keyboard.type('- one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('1. first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('* star');
  expect(await tree(page)).toEqual([
    ['list', 'one', [['list', 'two']]],
    ['list#', 'first'],
    ['list#', 'second'],
    ['list', 'star'],
  ]);
});

test('F-20: numbering is a CSS counter that restarts per run, per nesting level, and after any reorder', async ({ page }) => {
  await fresh(page, { a: item('a', true), b: { ...item('b', true), children: ['n'] }, n: item('n', true), c: item('c', true), p: { type: 'paragraph', content: [] }, d: item('d', true) }, ['a', 'b', 'c', 'p', 'd']);
  const starts = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-type=list]')].map((el) => [el.dataset.block, getComputedStyle(el).counterSet !== 'none', getComputedStyle(el).counterIncrement !== 'none']),
    );
  expect(await starts(page)).toEqual([['a', true, true], ['b', false, true], ['n', true, true], ['c', false, true], ['d', true, true]]);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-block=b] > [data-children]')).counterReset)).toMatch(/v-list/);
  await caret(page, 'c');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  expect(await starts(page)).toEqual([['c', true, true], ['a', false, true], ['b', false, true], ['n', true, true], ['d', true, true]]);
  expect(await page.evaluate(() => window.__renderIds)).toEqual(['doc', 'doc']);
});

test('F-21: the checkbox toggles with no React render and never moves the caret; ⌘⏎ and "[] " work; undo restores', async ({ page }) => {
  await fresh(page, { t: { type: 'todo', props: { checked: false }, content: [{ text: 'task', marks: [] }] }, x: { type: 'paragraph', content: [{ text: 'caret here', marks: [] }] } });
  await caret(page, 'x', 5);
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.locator('[data-block="t"] [role=checkbox]').click();
  expect(await page.evaluate(() => [editor.getDoc().blocks.t.props.checked, window.__renderIds.splice(0), editor.view.read().focus])).toEqual([true, [], { block: 'x', offset: 5 }]);
  await expect(page.locator('[data-block="t"] [role=checkbox]')).toHaveAttribute('aria-checked', 'true');
  await caret(page, 't', 2);
  await page.keyboard.press('ControlOrMeta+Enter');
  expect(await page.evaluate(() => editor.getDoc().blocks.t.props.checked)).toBe(false);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => editor.getDoc().blocks.t.props.checked)).toBe(true);
  await caret(page, 'x', 10);
  await page.keyboard.press('Enter');
  await page.keyboard.type('[x] done');
  await page.keyboard.press('Enter');
  await page.keyboard.type('next');
  expect((await tree(page)).slice(2)).toEqual([['todo✓', 'done'], ['todo', 'next']]);
});

test('F-12: "> " makes a quote that nests other blocks inside its border', async ({ page }) => {
  await fresh(page);
  await page.keyboard.type('> wise words');
  await page.keyboard.press('Enter');
  await page.keyboard.type('nested');
  await page.keyboard.press('Tab');
  expect(await tree(page)).toEqual([['quote', 'wise words', [['paragraph', 'nested']]]]);
  const inside = await page.evaluate(() => {
    const q = document.querySelector('[data-type=quote]');
    const n = q.querySelector('[data-type=paragraph]');
    return n.getBoundingClientRect().left > q.getBoundingClientRect().left + parseFloat(getComputedStyle(q).borderLeftWidth);
  });
  expect(inside).toBe(true);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await tree(page)).toEqual([['quote', 'wise words'], ['paragraph', 'nested']]);
});
