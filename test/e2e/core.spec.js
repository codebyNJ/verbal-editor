import { test, expect } from '../../playwright.config.js';

const open = async (page, id) => {
  await page.goto(`/#/${id}`);
  await page.locator('[data-content]').first().waitFor();
};
/** Block ids rendered since the last call (the demo feeds this from the binding's onRender hook). */
const renders = (page) =>
  page.evaluate(() => {
    const ids = window.__renderIds;
    window.__renders = 0;
    window.__renderIds = [];
    return ids;
  });
const tops = (page) => page.evaluate(() => editor.getDoc().blocks.doc.children);
const textOf = (page, id) => page.evaluate((id) => editor.getDoc().blocks[id].content.map((r) => r.text).join(''), id);
const caret = (page, id, offset) => page.evaluate(([block, offset]) => editor.select({ anchor: { block, offset }, focus: { block, offset } }), [id, offset]);
const snapshot = (page) => page.evaluate(() => JSON.stringify([editor.getDoc(), editor.selection]));
const ids = (page) => page.evaluate(() => Object.keys(editor.getDoc().blocks));

test('G-4 gate: typing, deleting and selecting cost 0 React renders', async ({ page }) => {
  await open(page, 'bench');
  const [, id] = await tops(page);
  const base = await textOf(page, id);
  await caret(page, id, 5);
  await renders(page);
  const typed = 'the quick brown fox jumps over the lazy dog';
  await page.keyboard.type(typed);
  for (let i = 0; i < 10; i++) await page.keyboard.press('Backspace');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ArrowRight');
  expect(await renders(page)).toEqual([]);
  expect(await textOf(page, id)).toBe(base.slice(0, 5) + typed.slice(0, -10) + base.slice(5));
});

test('G-4 gate: a structural edit renders only the block whose children or props changed', async ({ page }) => {
  await open(page, 'welcome');
  const [a, b] = await tops(page);
  const known = new Set(await ids(page));
  const existing = async () => (await renders(page)).filter((id) => known.has(id));

  await caret(page, a, (await textOf(page, a)).length);
  await renders(page);
  await page.keyboard.press('Enter');
  const created = (await ids(page)).filter((id) => !known.has(id));
  expect(created).toHaveLength(1);
  expect(await existing()).toEqual(['doc']);

  await page.keyboard.press('Backspace');
  expect(await existing()).toEqual(['doc']);

  await caret(page, b, 0);
  await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  expect(await existing()).toEqual(['doc']);
  expect((await tops(page)).slice(0, 2)).toEqual([b, a]);
});

test('F-22: a cross-parent move renders each changed container once and nothing else', async ({ page }) => {
  await open(page, 'welcome');
  const all = await tops(page);
  const [a, b] = all;
  await caret(page, b, 0);
  await renders(page);
  await page.keyboard.press('Tab');
  expect((await renders(page)).sort()).toEqual([a, b, 'doc'].sort());
  expect(await page.evaluate(([a, b]) => editor.getDoc().blocks[a].children[0] === b, [a, b])).toBe(true);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await tops(page)).toEqual(all);
  expect(await page.evaluate(() => editor.selection.focus)).toEqual({ block: b, offset: 0 });
});

test('F-03: undo and redo restore the model and the selection exactly, step by step', async ({ page }) => {
  await open(page, 'welcome');
  const [a, b] = await tops(page);
  const states = [await snapshot(page)];
  await caret(page, b, 4);
  states[0] = await snapshot(page);
  const steps = [
    () => page.keyboard.type('typed words '),
    () => page.keyboard.press('Enter'),
    () => page.keyboard.press('Tab'),
    () => page.keyboard.press('Shift+Tab'),
    () => page.keyboard.press('Backspace'),
    () => page.keyboard.press('ControlOrMeta+Shift+ArrowUp'),
    () => caret(page, a, 0).then(() => page.keyboard.press('Enter')),
  ];
  for (const step of steps) {
    await step();
    await page.waitForTimeout(1100);
    states.push(await snapshot(page));
  }
  for (let i = states.length - 2; i >= 0; i--) {
    await page.keyboard.press('ControlOrMeta+z');
    const [docNow] = JSON.parse(await snapshot(page));
    expect(docNow).toEqual(JSON.parse(states[i])[0]);
  }
  expect(JSON.parse(await snapshot(page))[1]).toEqual(JSON.parse(states[0])[1]);
  for (let i = 1; i < states.length; i++) {
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(JSON.parse(await snapshot(page))[0]).toEqual(JSON.parse(states[i])[0]);
  }
});

test('F-05: unknown or unhandled input types are prevented and never mutate the document', async ({ page }) => {
  await open(page, 'welcome');
  const before = await snapshot(page);
  const result = await page.evaluate(() => {
    const el = document.querySelector('[data-content]');
    const fire = (inputType) => {
      const e = new InputEvent('beforeinput', { inputType, data: 'x', bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    const blocked = ['formatUnderline', 'insertOrderedList', 'insertHorizontalRule', 'formatJustifyCenter', 'insertLink', 'insertFromDrop', 'formatFontColor', 'someFutureType'];
    return { blocked: blocked.map(fire), passed: ['insertText', 'deleteContentBackward', 'insertCompositionText'].map(fire) };
  });
  expect(result.blocked.every(Boolean)).toBe(true);
  expect(result.passed.some(Boolean)).toBe(false);
  expect(await snapshot(page)).toBe(before);
});

test('F-05: insertParagraph from a virtual keyboard splits like Enter', async ({ page }) => {
  await open(page, 'welcome');
  const [a] = await tops(page);
  await caret(page, a, 6);
  await page.evaluate(() => document.activeElement.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertParagraph', bubbles: true, cancelable: true })));
  const [x, y] = await tops(page);
  expect([x, await textOf(page, x), (await textOf(page, y)).slice(0, 3)]).toEqual([a, 'Verbal', ' is']);
});

test('F-04: model ⇄ DOM selection round-trips in top-level and nested blocks', async ({ page }) => {
  await open(page, 'welcome');
  const [, b] = await tops(page);
  await caret(page, b, 0);
  await page.keyboard.press('Tab');
  const out = await page.evaluate(() => {
    const bad = [];
    for (const [id, blk] of Object.entries(editor.getDoc().blocks)) {
      if (!blk.content) continue;
      const len = blk.content.map((r) => r.text).join('').length;
      for (const [a, f] of [[0, 0], [len >> 1, len >> 1], [len, len], [1, len - 1], [len - 1, 2]]) {
        const sel = { anchor: { block: id, offset: a }, focus: { block: id, offset: f } };
        editor.select(sel);
        if (JSON.stringify(editor.view.read()) !== JSON.stringify(sel)) bad.push([id, a, f, editor.view.read()]);
      }
    }
    return bad;
  });
  expect(out).toEqual([]);
});

test('F-06: core with zero registered modules still edits paragraphs', async ({ page }) => {
  await open(page, 'core');
  expect(await page.evaluate(() => Object.keys(editor.registry.blocks))).toEqual(['paragraph']);
  const [a] = await tops(page);
  await caret(page, a, 4);
  await page.keyboard.type('!!');
  await page.keyboard.press('Enter');
  await page.keyboard.type('next');
  const [x, y] = await tops(page);
  expect([(await textOf(page, x)).slice(0, 6), (await textOf(page, y)).slice(0, 6)]).toEqual(['This!!', 'next e']);
});

test('F-44: conflicting shortcuts and duplicate types are rejected at registration', async ({ page }) => {
  await open(page, 'core');
  const errors = await page.evaluate(() => {
    const E = editor.constructor;
    const tryNew = (o) => { try { new E(o); return null; } catch (e) { return e.message; } };
    const key = (type) => ({ type, schema: { content: 'inline' }, create: () => ({ type }), input: { shortcuts: { 'Mod-k': () => {} } } });
    return [
      tryNew({ marks: [{ type: 'x', tags: ['X'], shortcut: 'Mod-z' }] }),
      tryNew({ blocks: [key('a'), key('b')] }),
      tryNew({ blocks: [key('a'), key('a')] }),
      tryNew({ blocks: [key('a')] }),
    ];
  });
  expect(errors[0]).toMatch(/Mod-z.*core.*x/);
  expect(errors[1]).toMatch(/Mod-k.*a.*b/);
  expect(errors[2]).toMatch(/registered twice/);
  expect(errors[3]).toBeNull();
});

test('arrow keys cross block boundaries; Escape selects blocks; select-all then delete leaves one empty paragraph', async ({ page }) => {
  await open(page, 'welcome');
  const all = await tops(page);
  const [a, b, c] = all;
  const focus = () => page.evaluate(() => editor.view.read()?.focus);
  await caret(page, a, (await textOf(page, a)).length);
  await page.keyboard.press('ArrowRight');
  await expect.poll(focus).toEqual({ block: b, offset: 0 });
  await page.keyboard.press('ArrowLeft');
  await expect.poll(focus).toEqual({ block: a, offset: (await textOf(page, a)).length });
  await caret(page, c, 0);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await focus())?.block).toBe(b);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: [b] });
  await page.keyboard.press('Shift+ArrowUp');
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: [a, b] });
  await caret(page, a, 0);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+a');
  expect(await page.evaluate(() => editor.selection)).toEqual({ blocks: all });
  await page.keyboard.press('Backspace');
  const [only, ...rest] = await tops(page);
  expect(rest).toEqual([]);
  await page.keyboard.type('fresh');
  expect(await textOf(page, only)).toBe('fresh');
});

test('input latency: p95 from key event to handled input stays under one frame', async ({ page }) => {
  await open(page, 'bench');
  const [, id] = await tops(page);
  await caret(page, id, 3);
  await page.evaluate(() => {
    window.__lat = [];
    addEventListener('input', (e) => window.__lat.push(performance.now() - e.timeStamp));
    addEventListener('keydown', (e) => window.__lat.push(performance.now() - e.timeStamp));
  });
  await page.keyboard.type('fast typing across a four hundred block page, '.repeat(3));
  const lat = await page.evaluate(() => window.__lat.sort((a, b) => a - b));
  expect(lat.length).toBeGreaterThan(200);
  expect(lat[Math.floor(lat.length * 0.95)]).toBeLessThan(16);
});

test('host-app re-renders stop at <Blocks>: loading a page leaves the counter at 0', async ({ page }) => {
  await open(page, 'welcome');
  await page.waitForTimeout(300);
  expect(await renders(page)).toEqual([]);
});

test('setDoc replaces content even when block ids are reused', async ({ page }) => {
  await open(page, 'welcome');
  const set = (text) => page.evaluate((text) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: ['x'] }, x: { type: 'paragraph', content: [{ text, marks: [] }] } } }), text);
  await set('first');
  await set('second');
  await expect(page.locator('[data-block="x"] [data-content]')).toHaveText('second');
  await expect(page.locator('[data-content]')).toHaveCount(1);
});

test('G-4 gate: inserting into a nested child list renders only that parent, not its other children', async ({ page }) => {
  await open(page, 'welcome');
  await page.evaluate(() =>
    editor.setDoc({
      root: 'doc',
      blocks: {
        doc: { type: 'doc', children: ['p'] },
        p: { type: 'paragraph', content: [{ text: 'parent', marks: [] }], children: ['a', 'b', 'c'] },
        a: { type: 'paragraph', content: [{ text: 'a', marks: [] }] },
        b: { type: 'paragraph', content: [{ text: 'b', marks: [] }] },
        c: { type: 'paragraph', content: [{ text: 'c', marks: [] }] },
      },
    }),
  );
  await caret(page, 'b', 1);
  await renders(page);
  await page.keyboard.press('Enter');
  const created = (await page.evaluate(() => editor.get('p').children)).filter((id) => !['a', 'b', 'c'].includes(id));
  expect((await renders(page)).filter((id) => !created.includes(id))).toEqual(['p']);
});

test('block selections: ⇧↑/⇧↓ grow and shrink from where they started; Tab, ⇧Tab and turn-into act on every selected block in one undo step', async ({ page }) => {
  await open(page, 'welcome');
  const p = (t) => ({ type: 'paragraph', content: [{ text: t, marks: [] }] });
  await page.evaluate((blocks) => editor.setDoc({ root: 'doc', blocks: { doc: { type: 'doc', children: Object.keys(blocks) }, ...blocks } }), { a: p('A'), b: p('B'), c: p('C'), d: p('D'), e: p('E') });
  await page.evaluate(() => editor.select({ blocks: ['c'] }));
  const sel = () => page.evaluate(() => editor.selection.blocks);
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  expect(await sel()).toEqual(['c', 'd', 'e']);
  await page.keyboard.press('Shift+ArrowUp');
  expect(await sel()).toEqual(['c', 'd']);
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await sel()).toEqual(['b', 'c']);
  const tree = () => page.evaluate(() => { const d = editor.getDoc(); const t = (id) => id + (d.blocks[id].children ? `(${d.blocks[id].children.map(t).join('')})` : ''); return d.blocks.doc.children.map(t).join(''); });
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.keyboard.press('Tab');
  expect(await tree()).toBe('a(bc)de');
  expect((await page.evaluate(() => window.__renderIds.splice(0))).sort()).toEqual(['a', 'b', 'c', 'doc']);
  await page.keyboard.press('Shift+Tab');
  expect(await tree()).toBe('abcde');
  await page.keyboard.press('ControlOrMeta+Alt+2');
  expect(await page.evaluate(() => ['b', 'c', 'd'].map((id) => [editor.get(id).type, editor.get(id).props?.level ?? null]))).toEqual([['heading', 2], ['heading', 2], ['paragraph', null]]);
  expect(await sel()).toEqual(['b', 'c']);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => ['b', 'c'].map((id) => editor.get(id).type))).toEqual(['paragraph', 'paragraph']);
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await tree()).toBe('abcde');
  await page.evaluate(() => editor.setDoc(editor.getDoc()));
  await expect(page.locator('[data-selected]')).toHaveCount(0);
});
