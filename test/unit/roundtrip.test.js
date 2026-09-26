import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ load: (url, ctx, next) => (url.endsWith('.css') ? { format: 'module', source: 'export default {}', shortCircuit: true } : next(url, ctx)) });
const { blocks, marks, ui } = await import('../../src/preset.js');
const { registry } = await import('../../src/core/registry.js');
const { parse, serialize } = await import('../../src/core/model.js');
const { build, fromMarkdown, write } = await import('../../src/core/clipboard.js');
const paragraph = (await import('../../src/blocks/paragraph/index.js')).default;

const reg = registry([paragraph, ...blocks], marks, ui);
const inline = [
  { text: 'plain ', marks: [] },
  { text: 'bold ', marks: [{ type: 'bold' }] },
  { text: 'mixed', marks: [{ type: 'bold' }, { type: 'italic' }] },
  { text: ' ', marks: [] },
  { text: 'code', marks: [{ type: 'code' }] },
  { text: ' ', marks: [] },
  { text: 'gone', marks: [{ type: 'strike' }] },
  { text: ' 2*3 ', marks: [] },
  { text: 'link', marks: [{ type: 'link', href: 'https://example.com/?q=1' }] },
];

/** Every registered block type, once per value of each enum or boolean prop. */
function variants() {
  const out = [];
  for (const mod of Object.values(reg.blocks)) {
    const specs = Object.entries(mod.schema?.props ?? {}).filter(([, s]) => s === Boolean || Array.isArray(s));
    const values = specs.flatMap(([k, s]) => (s === Boolean ? [true, false] : s).map((v) => ({ [k]: v })));
    for (const props of values.length ? values : [undefined]) {
      const b = mod.create(props);
      if (mod.schema?.content === 'inline') b.content = inline;
      if (mod.schema?.content === 'code') b.content = [{ text: 'line one\n  line two', marks: [] }];
      out.push(b);
    }
  }
  return out;
}

test('parse(serialize(doc)) deep-equals doc for every block type, nested', () => {
  const list = variants();
  const doc = { version: 1, root: 'doc', blocks: { doc: { type: 'doc', children: [] } } };
  list.forEach((b, i) => {
    doc.blocks[`b${i}`] = b;
    doc.blocks.doc.children.push(`b${i}`);
  });
  const host = list.findIndex((b) => b.content && b.type !== 'code');
  doc.blocks[`b${host}`] = { ...doc.blocks[`b${host}`], children: ['kid'] };
  doc.blocks.kid = { type: 'paragraph', content: inline };
  assert.ok(list.length >= Object.keys(reg.blocks).length);
  assert.deepEqual(parse(serialize(doc), reg), doc);
});

test('the clipboard HTML payload is lossless for every block type', () => {
  for (const b of variants()) {
    const { html } = write([b], reg);
    const payload = /data-verbal="([^"]*)"/.exec(html)[1].replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
    assert.deepEqual(JSON.parse(payload), [b], b.type);
  }
});

test('markdown round-trips every block type that declares both a markdown writer and parser', () => {
  const lit = (f) => f.blocks.f.children.map((id) => f.blocks[id]);
  let checked = 0;
  for (const b of variants()) {
    const mod = reg.blocks[b.type];
    if (!mod.serialize?.markdown || !(mod.parse?.markdown || mod.parse?.lines)) continue;
    const { text } = write([b], reg);
    if (!text) continue;
    assert.deepEqual(lit(build(fromMarkdown(text, reg), reg)), lit(build([b], reg)), `${b.type}: ${text}`);
    checked++;
  }
  assert.ok(checked >= 5);
});

test('tables round-trip through GFM markdown, with or without a header row', () => {
  const lit = (f) => {
    const out = (id) => {
      const { children, ...b } = f.blocks[id];
      return children ? { ...b, children: children.map(out) } : b;
    };
    return f.blocks.f.children.map(out);
  };
  const cell = (t, marks = []) => ({ type: 'paragraph', content: t ? [{ text: t, marks }] : [] });
  for (const header of [true, false]) {
    const table = { type: 'table', props: { cols: 3, header }, children: [cell('a'), cell('b|c'), cell('bold', [{ type: 'bold' }]), cell(''), cell('2'), cell('3')] };
    const { text } = write([table], reg);
    assert.deepEqual(lit(build(fromMarkdown(text, reg), reg)), lit(build([table], reg)), text);
  }
});

test('a code span may start or end with a space; emphasis may not', () => {
  const [p] = fromMarkdown('type `# ` or `## ` then * not bold *', reg);
  assert.deepEqual(p.content.filter((r) => r.marks.length).map((r) => [r.text, r.marks[0].type]), [['# ', 'code'], ['## ', 'code']]);
  assert.ok(p.content.at(-1).text.endsWith('then * not bold *'));
});
