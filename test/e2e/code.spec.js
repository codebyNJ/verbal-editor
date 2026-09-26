import { test, expect } from '../../playwright.config.js';

async function fresh(page, blocks) {
  await page.goto('/#/play/code');
  await page.locator('pre').first().waitFor();
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), blocks);
  await page.locator('[data-block] [data-content]').first().click();
  await page.evaluate(() => window.__renderIds.splice(0));
}
const code = (lang, text) => ({ type: 'code', props: { lang }, content: [{ text, marks: [] }] });
const src = (page, id = 'c') => page.evaluate((id) => editor.get(id).content.map((r) => r.text).join(''), id);
const sizes = (page) => page.evaluate(() => Object.fromEntries([...CSS.highlights.keys()].filter((k) => k.startsWith('verbal-')).map((k) => [k.slice(7), CSS.highlights.get(k).size])));
const caret = (page, offset) => page.evaluate((offset) => editor.select({ anchor: { block: 'c', offset }, focus: { block: 'c', offset } }), offset);

test('F-30: colours are highlight ranges — the pre holds only text, typing costs 0 renders, highlights follow edits', async ({ page }) => {
  await fresh(page, { c: code('js', 'const answer = 42;') });
  await expect.poll(() => sizes(page)).toMatchObject({ keyword: 1, number: 1 });
  await caret(page, 18);
  await page.keyboard.type(' // "done"');
  await expect.poll(() => sizes(page)).toMatchObject({ comment: 1 });
  expect(await page.evaluate(() => document.querySelectorAll('[data-type=code] pre *:not(br)').length)).toBe(0);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  expect(await src(page)).toBe('const answer = 42; // "done"');
});

test('F-30: caret and selection map exactly at every offset, across lines, as in plain text', async ({ page }) => {
  const text = 'if (a) {\n  return "x";\n}\n';
  await fresh(page, { c: code('js', text) });
  const bad = await page.evaluate((len) => {
    const out = [];
    for (let a = 0; a <= len; a++)
      for (const f of [a, Math.min(len, a + 3)]) {
        const sel = { anchor: { block: 'c', offset: a }, focus: { block: 'c', offset: f } };
        editor.select(sel);
        if (JSON.stringify(editor.view.read()) !== JSON.stringify(sel)) out.push([a, f]);
      }
    return out;
  }, text.length);
  expect(bad).toEqual([]);
  await caret(page, 9);
  await page.keyboard.type('X');
  expect(await src(page)).toBe('if (a) {\nX  return "x";\n}\n');
});

test('F-31: a language loads on first use only', async ({ page }) => {
  const loaded = [];
  // The package ships lang/<name>.js; a site build hashes it to <name>-<hash>.js.
  const lang = /\/(?:lang\/)?(bash|css|go|html|js|json|python|rust|sql|ts)(?:-[\w-]{8})?\.js(?:\?|$)/;
  page.on('request', (r) => lang.test(r.url()) && loaded.push(lang.exec(r.url())[1]));
  await page.goto('/#/play/welcome');
  await page.locator('[data-content]').first().waitFor();
  await page.waitForTimeout(300);
  expect(loaded).toEqual([]);
  await page.evaluate(() => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['c'] }, c: { type: 'code', props: { lang: 'go' }, content: [{ text: 'func main() {}', marks: [] }] } } }));
  await expect.poll(() => loaded).toEqual(['go']);
  await page.locator('[data-block="c"] select').selectOption('rust');
  await expect.poll(() => loaded).toEqual(['go', 'rust']);
  await page.locator('[data-block="c"] select').selectOption('go');
  await page.waitForTimeout(200);
  expect(loaded).toEqual(['go', 'rust']);
});

test('F-32: Auto shows the detected language, and stays plain text when unsure', async ({ page }) => {
  await fresh(page, {
    a: code('', 'def walk(tree):\n    for node in tree:\n        print(node)\n    return None'),
    b: code('', 'SELECT id\nFROM users\nWHERE active = 1;'),
    c: code('', 'Dear team,\nthe release went out today.\nThanks!'),
  });
  const label = (id) => page.locator(`[data-block="${id}"] option`).first();
  await expect(label('a')).toHaveText('Auto · Python');
  await expect(label('b')).toHaveText('Auto · SQL');
  await expect(label('c')).toHaveText('Auto · Plain text');
});

test('keys: Enter keeps indentation, Tab/⇧Tab indent, ⌘⏎ leaves; "```py " makes a Python block', async ({ page }) => {
  await fresh(page, { p: { type: 'paragraph', content: [] } });
  await page.keyboard.type('```py ');
  expect(await page.evaluate(() => editor.get('p'))).toEqual({ type: 'code', props: { lang: 'python' }, content: [] });
  await page.keyboard.type('def f():');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('x = 1');
  await page.keyboard.press('Enter');
  await page.keyboard.type('y');
  await page.keyboard.press('Shift+Tab');
  expect(await src(page, 'p')).toBe('def f():\n  x = 1\ny');
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.keyboard.type('after');
  expect(await page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id).type))).toEqual(['code', 'paragraph']);
});

test('clipboard: pasting into code inserts plain text; copying from code gives raw text', async ({ page }) => {
  await fresh(page, { c: code('js', 'a;') });
  await caret(page, 2);
  await page.evaluate(() => {
    const e = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    e.clipboardData.setData('text/plain', '\n# not a heading **nor bold**');
    e.clipboardData.setData('text/html', '<h1>ignored</h1>');
    document.activeElement.dispatchEvent(e);
  });
  expect(await src(page)).toBe('a;\n# not a heading **nor bold**');
  await page.evaluate(() => editor.select({ anchor: { block: 'c', offset: 3 }, focus: { block: 'c', offset: 31 } }));
  const text = await page.evaluate(() => {
    const e = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(e);
    return e.clipboardData.getData('text/plain');
  });
  expect(text).toBe('# not a heading **nor bold**');
});
