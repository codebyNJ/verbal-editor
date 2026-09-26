import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ load: (url, ctx, next) => (url.endsWith('.css') ? { format: 'module', source: 'export default {}', shortCircuit: true } : next(url, ctx)) });
const { blocks, marks, ui } = await import('../../src/preset.js');
const { registry } = await import('../../src/core/registry.js');
const { build, fromMarkdown, inline, inlineHTML, inlineMD, write } = await import('../../src/core/clipboard.js');
const { text } = await import('../../src/core/model.js');
const paragraph = (await import('../../src/blocks/paragraph/index.js')).default;

const reg = registry([paragraph, ...blocks], marks, ui);
const r = (t, ...m) => ({ text: t, marks: m.map((type) => (typeof type === 'string' ? { type } : type)) });
const link = { type: 'link', href: 'https://example.com/a?b=1&c="2"' };

test('inlineMD nests marks properly and escapes literal delimiters outside code', () => {
  assert.equal(inlineMD([r('a', 'bold'), r('b', 'bold', 'italic'), r(' 2*3_x '), r('*raw*', 'code')], reg), '**a_b_** 2\\*3\\_x `*raw*`');
  assert.equal(inlineMD([r('docs', link)], reg), `[docs](${link.href})`);
});

test('inlineMD keeps delimiters valid when marked text starts or ends with spaces', () => {
  const md = inlineMD([r('say '), r('bold ', 'bold'), r(' both', 'bold', 'italic'), r(' end')], reg);
  assert.equal(md, 'say **bold  _both_** end');
  assert.deepEqual(inline(md, reg), [r('say '), r('bold  ', 'bold'), r('both', 'bold', 'italic'), r(' end')]);
});

test('inline parses markdown back into the same runs', () => {
  const runs = [r('a', 'bold'), r('b', 'bold', 'italic'), r(' 2*3_x '), r('*raw*', 'code'), r(' '), r('docs', link)];
  assert.deepEqual(inline(inlineMD(runs, reg), reg), runs);
  assert.deepEqual(inline('~~gone~~ and *it*', reg), [r('gone', 'strike'), r(' and '), r('it', 'italic')]);
  assert.deepEqual(inline('unclosed **bold and a lone * star', reg), [r('unclosed **bold and a lone * star')]);
});

test('inlineHTML escapes text and attributes and nests tags', () => {
  assert.equal(
    inlineHTML([r('<b>&', 'bold'), r('x', 'bold', link)], reg),
    '<strong>&#60;b&#62;&#38;</strong><a href="https://example.com/a?b=1&#38;c=&#34;2&#34;"><strong>x</strong></a>',
  );
  assert.equal(inlineHTML([r('line\nbreak')], reg), 'line<br>break');
});

test('fromMarkdown maps each line through module rules and nests by indentation', () => {
  const md = ['# Title', '', 'plain **text**', '- one', '    - nested', '1. first', '- [x] done', '- [ ] todo', '> quoted', '---', '### H6 clamps? ###### no'].join('\n');
  const out = fromMarkdown(md, reg).map(({ type, props, content, children }) => [type, props ?? null, content && text(content), children.length]);
  assert.deepEqual(out, [
    ['heading', { level: 1 }, 'Title', 0],
    ['paragraph', null, 'plain text', 0],
    ['list', { ordered: false }, 'one', 1],
    ['list', { ordered: true }, 'first', 0],
    ['todo', { checked: true }, 'done', 0],
    ['todo', { checked: false }, 'todo', 0],
    ['quote', null, 'quoted', 0],
    ['divider', null, undefined, 0],
    ['heading', { level: 3 }, 'H6 clamps? ###### no', 0],
  ]);
});

test('write puts the exact blocks in data-verbal, semantic HTML beside them, and markdown as text', () => {
  const frag = [
    { type: 'heading', props: { level: 2 }, content: [r('Hi', 'bold')] },
    { type: 'list', props: { ordered: false }, content: [r('a')], children: [{ type: 'list', props: { ordered: true }, content: [r('b')] }] },
  ];
  const { html, text: md } = write(frag, reg);
  const payload = /data-verbal="([^"]*)"/.exec(html)[1].replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
  assert.deepEqual(JSON.parse(payload), frag);
  assert.ok(html.endsWith('<h2><strong>Hi</strong></h2><ul><li>a<ol><li>b</li></ol></li></ul></div>'));
  assert.equal(md, '## **Hi**\n- a\n    1. b');
});

test('build sanitizes: unknown types degrade to paragraphs, unsafe links are dropped, ids are fresh', () => {
  const f = build(
    [
      { type: 'widget', content: [r('kept text')] },
      { type: 'paragraph', content: [r('x', { type: 'link', href: 'javascript:alert(1)' }), r('y', { type: 'nope' })] },
      { type: 'heading', props: { level: 7, onclick: 'x' }, content: [r('h')] },
    ],
    reg,
  );
  const list = f.blocks.f.children.map((id) => f.blocks[id]);
  assert.deepEqual(list, [
    { type: 'paragraph', content: [r('kept text')] },
    { type: 'paragraph', content: [r('xy')] },
    { type: 'heading', content: [r('h')] },
  ]);
  assert.ok(f.blocks.f.children.every((id) => /^b_/.test(id)));
});
