import { test, expect } from '../../playwright.config.js';

const p = (text = '') => ({ type: 'paragraph', content: text ? [{ text, marks: [] }] : [] });
async function fresh(page, blocks = { a: p('first'), b: p() }) {
  await page.goto('/#/play/media');
  await page.locator('[data-type=image]').first().waitFor();
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), blocks);
  await page.locator(`[data-block="${Object.keys(blocks)[0]}"]`).waitFor();
  await page.evaluate(() => window.__renderIds.splice(0));
}
const caret = (page, block, offset = 0) => page.evaluate(([block, offset]) => editor.select({ anchor: { block, offset }, focus: { block, offset } }), [block, offset]);
const types = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id).type));
/** Dispatches a paste or drop carrying a small PNG file on the block's element. */
const file = (page, kind, block, name = 'red box.png') =>
  page.evaluate(
    async ([kind, block, name]) => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
      const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
      const init = { bubbles: true, cancelable: true };
      const target = editor.view.el(block);
      const e = kind === 'paste' ? new ClipboardEvent('paste', { ...init, clipboardData: new DataTransfer() }) : new DragEvent('drop', { ...init, dataTransfer: new DataTransfer() });
      (e.clipboardData ?? e.dataTransfer).items.add(new File([blob], name, { type: 'image/png' }));
      if (kind === 'drop') {
        const over = new DragEvent('dragover', { ...init, dataTransfer: e.dataTransfer });
        target.dispatchEvent(over);
        if (!over.defaultPrevented) return 'dragover not accepted';
      }
      target.dispatchEvent(e);
    },
    [kind, block, name],
  );
const image = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id)).find((b) => b.type === 'image'));

test('F-37: a pasted image file becomes an image block with no upload hook — a data URL — as one undo step', async ({ page }) => {
  await fresh(page);
  await caret(page, 'a', 5);
  await file(page, 'paste', 'a');
  await expect.poll(() => types(page)).toEqual(['paragraph', 'image', 'paragraph']);
  const b = await image(page);
  expect(b.props.src).toMatch(/^data:image\/png;base64,/);
  expect(b.props.alt).toBe('red box');
  await expect(page.locator('[data-type=image] img')).toHaveJSProperty('complete', true);
  expect((await page.evaluate(() => window.__renderIds.splice(0))).filter((id) => ['a', 'b'].includes(id))).toEqual([]);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await types(page)).toEqual(['paragraph', 'paragraph']);
});

test('F-37: uploads go through the host hook when one is configured', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => {
    window.__uploaded = [];
    editor.options.upload = async (f) => (window.__uploaded.push(f.name), 'data:image/gif;base64,R0lGODlhAQABAAAAACw=');
  });
  await caret(page, 'b');
  await file(page, 'paste', 'b', 'shot.png');
  await expect.poll(() => image(page)).toMatchObject({ props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'shot' } });
  expect(await page.evaluate(() => window.__uploaded)).toEqual(['shot.png']);
  expect(await types(page)).toEqual(['paragraph', 'image', 'paragraph']);
});

test('F-37: a file dropped on a block lands after that block, not at the caret', async ({ page }) => {
  await fresh(page, { a: p('one'), b: p('two'), c: p('three') });
  await caret(page, 'a');
  expect(await file(page, 'drop', 'b')).toBeUndefined();
  await expect.poll(() => page.evaluate(() => editor.getDoc().blocks.doc.children.map((id) => editor.get(id).type[0] + (editor.get(id).content?.[0]?.text ?? '')))).toEqual(['pone', 'ptwo', 'i', 'pthree']);
});

test('F-37: "/image" opens the file picker and inserts what is chosen', async ({ page }) => {
  await fresh(page);
  // Waiting before typing lets Playwright finish intercepting file choosers before the picker opens.
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-block="b"] [data-content]').click();
  await page.keyboard.type('/image');
  await page.keyboard.press('Enter');
  const png = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 4, height: 4 });
    return (await new Promise((done) => canvas.toBlob(done, 'image/png'))).arrayBuffer().then((b) => [...new Uint8Array(b)]);
  });
  await (await chooser).setFiles({ name: 'chosen.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await expect.poll(() => image(page)).toMatchObject({ props: { alt: 'chosen' } });
  expect(await page.evaluate(() => editor.get('a').content[0].text)).toBe('first');
});

test('F-36: allow-listed providers show a click-to-load facade; nothing third-party loads, and the frame is sandboxed', async ({ page }) => {
  await fresh(page, { y: { type: 'embed', props: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' } }, v: { type: 'embed', props: { url: 'https://vimeo.com/76979871' } } });
  await expect(page.getByRole('button', { name: '► Load YouTube' })).toBeVisible();
  await expect(page.getByRole('button', { name: '► Load Vimeo' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  const frame = await page.evaluate(() => {
    const el = editor.registry.blocks.embed.view.create({ type: 'embed', props: { url: 'https://youtu.be/aqz-KE-bpKQ' } }, editor);
    el.querySelector('button').click();
    const f = el.querySelector('iframe');
    return [f.src, f.getAttribute('sandbox'), f.title];
  });
  expect(frame).toEqual(['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'allow-scripts allow-same-origin allow-popups', 'YouTube']);
});

test('F-36: any other link is a card that never gets a frame; unsafe URLs render nothing clickable', async ({ page }) => {
  await fresh(page, {
    k: { type: 'embed', props: { url: 'https://example.org/some/page' } },
    x: { type: 'embed', props: { url: 'javascript:alert(1)' } },
  });
  const card = page.locator('[data-block="k"] a');
  await expect(card).toHaveAttribute('href', 'https://example.org/some/page');
  await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(card).toContainText('example.org');
  await expect(page.locator('[data-block="x"] a')).toHaveCount(0);
  await expect(page.locator('[data-block="x"] input')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.evaluate(() => (editor.options.unfurl = async (url) => ({ title: `Title of ${url.split('/').pop()}` })));
  await page.evaluate(() => editor.setDoc(editor.getDoc()));
  await expect(page.locator('[data-block="k"] strong')).toHaveText('Title of page');
});

test('F-36: a provider link pasted on an empty line embeds; elsewhere it stays text; in a table cell it goes after the table', async ({ page }) => {
  await fresh(page, {
    a: p('text'),
    b: p(),
    t: { type: 'table', props: { cols: 2, header: false }, children: ['c1', 'c2'] },
    c1: p(),
    c2: p(),
  });
  const paste = (block, text) =>
    page.evaluate(
      ([block, text]) => {
        const e = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
        e.clipboardData.setData('text/plain', text);
        editor.view.content(block).dispatchEvent(e);
      },
      [block, text],
    );
  const url = 'https://youtu.be/aqz-KE-bpKQ';
  await caret(page, 'a', 4);
  await paste('a', ` ${url}`);
  expect(await page.evaluate(() => editor.get('a').content.map((r) => r.text).join(''))).toBe(`text ${url}`);
  await caret(page, 'b');
  await paste('b', url);
  await expect.poll(() => types(page)).toEqual(['paragraph', 'embed', 'paragraph', 'table']);
  await caret(page, 'c1');
  await paste('c1', url);
  await expect.poll(() => types(page)).toEqual(['paragraph', 'embed', 'paragraph', 'table', 'embed', 'paragraph']);
  expect(await page.evaluate(() => editor.get('t').children)).toEqual(['c1', 'c2']);
});

test('F-36: "/embed" focuses a link field; Enter commits the link and selects the embed', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-block="b"] [data-content]').click();
  await page.keyboard.type('/embed');
  await page.keyboard.press('Enter');
  const field = page.getByPlaceholder('Paste a link and press Enter');
  await expect(field).toBeFocused();
  await field.fill('not a link');
  await field.press('Enter');
  await expect(field).toBeVisible();
  await field.fill('https://vimeo.com/76979871');
  await field.press('Enter');
  await expect(page.getByRole('button', { name: '► Load Vimeo' })).toBeVisible();
  const id = await page.evaluate(() => editor.getDoc().blocks.doc.children.find((id) => editor.get(id).type === 'embed'));
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: [id] });
});

test('F-43: the emoji index loads on the first ":", ranks prefix matches first, and inserts with zero renders', async ({ page }) => {
  const index = [];
  page.on('request', (r) => /\/data(-[\w-]{8})?\.json$/.test(r.url()) && index.push(r.url()));
  await fresh(page);
  await page.locator('[data-block="a"] [data-content]').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' 10:30 done');
  expect(index).toEqual([]);
  await expect(page.getByRole('listbox', { name: 'Emoji' })).toBeHidden();
  await page.keyboard.type(' :rock');
  const menu = page.getByRole('listbox', { name: 'Emoji' });
  await expect(menu).toBeVisible();
  expect(index).toHaveLength(1);
  expect(new URL(index[0]).origin).toBe(new URL(page.url()).origin);
  await expect(menu.getByRole('option')).toHaveText(['🪨rock', '🚀rocket', '☘️shamrock']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => editor.get('a').content.map((r) => r.text).join(''))).toBe('first 10:30 done 🚀');
  expect(await page.evaluate(() => [editor.selection.focus.offset, editor.len('a')])).toEqual([19, 19]);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  await page.keyboard.type(' :sparkles');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  expect(index).toHaveLength(1);
});
