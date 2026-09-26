import { test, expect } from '../../playwright.config.js';

const r = (text, ...marks) => ({ text, marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m)) });
const rich = {
  h: { type: 'heading', props: { level: 2 }, content: [r('Title')] },
  l: { type: 'list', props: { ordered: false }, content: [r('one')], children: ['n'] },
  n: { type: 'list', props: { ordered: true }, content: [r('nested', 'italic')] },
  t: { type: 'todo', props: { checked: true }, content: [r('done')] },
  q: { type: 'quote', content: [r('said')], children: ['c'] },
  c: { type: 'paragraph', content: [r('inside')] },
  p: { type: 'paragraph', content: [r('see '), r('the docs', 'bold', { type: 'link', href: '/docs' }), r(' 2*3')] },
  d: { type: 'divider' },
};

async function fresh(page, blocks = { x: { type: 'paragraph', content: [] } }, children = Object.keys(blocks)) {
  await page.goto('/#/play/formatting');
  await page.locator('[data-content]').first().waitFor();
  await page.evaluate(([blocks, children]) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children }, ...blocks } }), [blocks, children]);
  await page.locator('[data-block] [data-content]').first().click();
}
/** Clipboard events carry the event's own DataTransfer (Firefox ignores one passed to the constructor). */
const copy = (page, type = 'copy') =>
  page.evaluate((type) => {
    const e = new ClipboardEvent(type, { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(e);
    return { html: e.clipboardData.getData('text/html'), text: e.clipboardData.getData('text/plain') };
  }, type);
const paste = (page, data) =>
  page.evaluate((data) => {
    const e = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    for (const [k, v] of Object.entries(data)) e.clipboardData.setData(k, v);
    document.activeElement.dispatchEvent(e);
  }, data);
/** The document as nested literals without ids. */
const tree = (page) =>
  page.evaluate(() => {
    const d = editor.getDoc();
    const lit = (id) => {
      const { children, ...b } = d.blocks[id];
      return children ? { ...b, children: children.map(lit) } : b;
    };
    return d.blocks.doc.children.map(lit);
  });
const select = (page, block, from, to = from) => page.evaluate(([block, from, to]) => editor.select({ anchor: { block, offset: from }, focus: { block, offset: to } }), [block, from, to]);

test('F-45: copied blocks paste back exactly — props, marks, nesting — with markdown as plain text', async ({ page }) => {
  await fresh(page, rich, ['h', 'l', 't', 'q', 'p', 'd']);
  const original = await tree(page);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+a');
  const clip = await copy(page);
  expect(clip.text).toBe('## Title\n- one\n    1. _nested_\n- [x] done\n> said\n    inside\nsee [**the docs**](/docs) 2\\*3\n---');
  await page.evaluate(() => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['x'] }, x: { type: 'paragraph', content: [] } } }));
  await page.locator('[data-block="x"] [data-content]').click();
  await paste(page, clip);
  expect(await tree(page)).toEqual(original);
  await expect(page.locator('a[href="/docs"]')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('F-45: the markdown alone rebuilds the same blocks', async ({ page }) => {
  await fresh(page, rich, ['h', 'l', 't', 'q', 'p', 'd']);
  const original = await tree(page);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+a');
  const { text } = await copy(page);
  await page.evaluate(() => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['x'] }, x: { type: 'paragraph', content: [] } } }));
  await page.locator('[data-block="x"] [data-content]').click();
  await paste(page, { 'text/plain': text });
  expect(await tree(page)).toEqual(original);
});

test('F-45: external HTML goes through module parse rules, is sanitized, and unknown elements degrade to paragraphs', async ({ page }) => {
  await fresh(page);
  await paste(page, {
    'text/html':
      '<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><h1>Title</h1>' +
      '<p><span style="font-weight:700">Bold</span> and <span style="font-style:italic">it</span> <a href="javascript:alert(1)" onclick="window.__xss=1">bad</a> <a href="https://ok.example/x">good</a></p>' +
      '<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul><ol><li>first</li></ol><ul><li><input type="checkbox" checked>done</li></ul>' +
      '<custom-widget>Custom text</custom-widget><script>window.__xss=2</script><img src="x" onerror="window.__xss=3">' +
      '<blockquote>quote</blockquote><hr><h5>small</h5></b>',
    'text/plain': 'ignored when HTML is present',
  });
  const t = await tree(page);
  expect(t).toEqual([
    { type: 'heading', props: { level: 1 }, content: [r('Title')] },
    { type: 'paragraph', content: [r('Bold', 'bold'), r(' and '), r('it', 'italic'), r(' bad '), r('good', { type: 'link', href: 'https://ok.example/x' })] },
    { type: 'list', props: { ordered: false }, content: [r('one')] },
    { type: 'list', props: { ordered: false }, content: [r('two')], children: [{ type: 'list', props: { ordered: false }, content: [r('nested')] }] },
    { type: 'list', props: { ordered: true }, content: [r('first')] },
    { type: 'todo', props: { checked: true }, content: [r('done')] },
    { type: 'paragraph', content: [r('Custom text')] },
    { type: 'image', props: { src: 'x', alt: '' } },
    { type: 'quote', content: [r('quote')] },
    { type: 'divider' },
    { type: 'heading', props: { level: 3 }, content: [r('small')] },
  ]);
  await page.locator('[data-verbal] img').evaluate((img) => img.decode().catch(() => {}));
  expect(await page.evaluate(() => [window.__xss, document.querySelectorAll('[data-verbal] script, [data-verbal] [onclick], [data-verbal] [onerror]').length])).toEqual([undefined, 0]);
});

test('F-45: a multi-line paste splits the paragraph at the caret; inline text pastes in place with 0 renders', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [r('headtail')] } });
  await select(page, 'x', 4);
  await page.evaluate(() => window.__renderIds.splice(0));
  await paste(page, { 'text/plain': ' **bold** ' });
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  expect(await tree(page)).toEqual([{ type: 'paragraph', content: [r('head '), r('bold', 'bold'), r(' tail')] }]);
  await select(page, 'x', 5);
  await paste(page, { 'text/plain': '# One\n- two' });
  const t = await tree(page);
  expect(t.map((b) => [b.type, b.content.map((x) => x.text).join('')])).toEqual([
    ['paragraph', 'head '],
    ['heading', 'One'],
    ['list', 'two'],
    ['paragraph', 'bold tail'],
  ]);
  expect(await page.evaluate(() => window.__renderIds.filter((id) => id === 'doc'))).toEqual(['doc']);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await tree(page)).toEqual([{ type: 'paragraph', content: [r('head '), r('bold', 'bold'), r(' tail')] }]);
});

test('F-45: cut removes the selection and a later paste restores it', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [r('keep '), r('this', 'bold'), r(' part')] } });
  await select(page, 'x', 5, 9);
  const clip = await copy(page, 'cut');
  expect(await tree(page)).toEqual([{ type: 'paragraph', content: [r('keep  part')] }]);
  await select(page, 'x', 5);
  await paste(page, clip);
  expect(await tree(page)).toEqual([{ type: 'paragraph', content: [r('keep '), r('this', 'bold'), r(' part')] }]);
});

test('F-15: toolbar and ⌘K link a selection; unsafe URLs are refused; rel is enforced', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [r('visit our site or else')] } });
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  await select(page, 'x', 10, 14);
  await bar.getByTitle(/Link/).click();
  const field = bar.getByRole('textbox', { name: 'URL' });
  await field.fill('example.com/a');
  await field.press('Enter');
  await expect(page.locator('[data-block="x"] a')).toHaveAttribute('href', 'https://example.com/a');
  await expect(page.locator('[data-block="x"] a')).toHaveAttribute('rel', 'noopener noreferrer');
  await select(page, 'x', 0, 5);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(field).toBeFocused();
  await field.fill('javascript:alert(1)');
  await field.press('Enter');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await field.press('Escape');
  expect((await tree(page))[0].content).toEqual([r('visit our '), r('site', { type: 'link', href: 'https://example.com/a' }), r(' or else')]);
  await select(page, 'x', 10, 14);
  await bar.getByTitle(/Link/).click();
  await expect(field).toHaveValue('https://example.com/a');
  await field.fill('');
  await field.press('Enter');
  expect((await tree(page))[0].content).toEqual([r('visit our site or else')]);
});

test('F-15: a URL pasted over a selection links it; anything else replaces it', async ({ page }) => {
  await fresh(page, { x: { type: 'paragraph', content: [r('one two three')] } });
  await select(page, 'x', 4, 7);
  await paste(page, { 'text/plain': 'https://verbal.dev/docs' });
  expect((await tree(page))[0].content).toEqual([r('one '), r('two', { type: 'link', href: 'https://verbal.dev/docs' }), r(' three')]);
  await select(page, 'x', 0, 3);
  await paste(page, { 'text/plain': 'javascript:alert(1)' });
  expect((await tree(page))[0].content[0]).toEqual(r('javascript:alert(1) '));
});
