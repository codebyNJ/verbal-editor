import { test, expect } from '../../playwright.config.js';

async function fresh(page, blocks) {
  await page.goto('/#/play/math');
  await page.locator('math').first().waitFor();
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), blocks);
  await page.evaluate(() => window.__renderIds.splice(0));
}
const eq = (latex) => ({ type: 'math', props: { latex } });

test('F-34: block equations render as native MathML; unsupported commands show a visible error', async ({ page }) => {
  await fresh(page, { a: eq('\\frac{a}{b} + \\sqrt{x}'), b: eq('x + \\nope{y}') });
  await expect(page.locator('[data-block="a"] math mfrac')).toHaveCount(1);
  await expect(page.locator('[data-block="a"] math msqrt')).toHaveCount(1);
  await expect(page.locator('[data-block="b"] [role=alert]')).toHaveText('Unsupported command \\nope');
  await expect(page.locator('[data-block="b"] merror')).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('script')].some((s) => /katex|mathjax/i.test(s.src)))).toBe(false);
});

test('F-34: the popover previews live, Enter commits one change, Esc restores', async ({ page }) => {
  await fresh(page, { a: eq('x^2') });
  await page.locator('[data-block="a"] math').click();
  const area = page.getByRole('textbox', { name: 'LaTeX' });
  await expect(area).toBeFocused();
  await area.fill('\\alpha^2');
  await expect(page.locator('[data-block="a"] math')).toContainText('α');
  expect(await page.evaluate(() => editor.get('a').props.latex)).toBe('x^2');
  await area.press('Enter');
  expect(await page.evaluate(() => [editor.get('a').props.latex, window.__renderIds.splice(0)])).toEqual(['\\alpha^2', []]);
  await page.keyboard.press('Enter');
  await expect(area).toBeFocused();
  await area.fill('\\broken');
  await area.press('Escape');
  expect(await page.evaluate(() => editor.get('a').props.latex)).toBe('\\alpha^2');
  await expect(page.locator('[data-block="a"] [role=alert]')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => editor.get('a').props.latex)).toBe('x^2');
});

test('F-34: inline equations — "$…$" converts, renders in place, shows source under the caret, and maps offsets exactly', async ({ page }) => {
  await fresh(page, { p: { type: 'paragraph', content: [] } });
  await page.locator('[data-block="p"] [data-content]').click();
  await page.keyboard.type('Area $\\pi r^2$ of a circle');
  expect(await page.evaluate(() => editor.get('p').content)).toEqual([
    { text: 'Area ', marks: [] },
    { text: '\\pi r^2', marks: [{ type: 'math' }] },
    { text: ' of a circle', marks: [] },
  ]);
  await expect(page.locator('[data-block="p"] [data-math] [data-skip] math')).toContainText('π');
  expect(await page.evaluate(() => editor.view.content('p').textContent.includes('π'))).toBe(true);
  await page.evaluate(() => editor.select({ anchor: { block: 'p', offset: 8 }, focus: { block: 'p', offset: 8 } }));
  await expect(page.locator('[data-block="p"] [data-math]')).toHaveClass(/editing/);
  const bad = await page.evaluate(() => {
    const out = [];
    for (let o = 0; o <= 24; o++) {
      const s = { anchor: { block: 'p', offset: o }, focus: { block: 'p', offset: o } };
      editor.select(s);
      if (JSON.stringify(editor.view.read()) !== JSON.stringify(s)) out.push(o);
    }
    return out;
  });
  expect(bad).toEqual([]);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
});

test('F-34: "$$ " opens the new equation\'s editor too; undoing and redoing it does not', async ({ page }) => {
  await fresh(page, { p: { type: 'paragraph', content: [] } });
  await page.locator('[data-block="p"] [data-content]').click();
  await page.keyboard.type('$$ ');
  const area = page.getByRole('textbox', { name: 'LaTeX' });
  await expect(area).toBeFocused();
  await area.fill('x^2');
  await area.press('Enter');
  const math = () => page.evaluate(() => editor.getDoc().blocks.doc.children.filter((id) => editor.get(id).type === 'math').map((id) => editor.get(id).props.latex));
  expect(await math()).toEqual(['x^2']);
  await page.locator('[data-content]').first().click();
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect(await math()).toEqual(['']);
  await expect(area).toHaveCount(0);
});

test('F-34: "/equation" inserts an empty block and opens its editor', async ({ page }) => {
  await fresh(page, { p: { type: 'paragraph', content: [] } });
  await page.locator('[data-block="p"] [data-content]').click();
  await page.keyboard.type('/equation');
  await page.keyboard.press('Enter');
  const area = page.getByRole('textbox', { name: 'LaTeX' });
  await expect(area).toBeFocused();
  await area.fill('\\sum_{i=1}^n i');
  await area.press('Enter');
  const types = await page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => [editor.get(id).type, editor.get(id).props?.latex ?? null]));
  expect(types[0]).toEqual(['math', '\\sum_{i=1}^n i']);
  await expect(page.locator('math munderover')).toHaveCount(1);
});
