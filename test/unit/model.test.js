import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, mapMarks, norm, order, parentOf, parse, serialize, slice, splice, subtree, text } from '../../src/core/model.js';

const bold = { type: 'bold' };
const link = { type: 'link', href: '/docs' };
const reg = {
  blocks: {
    paragraph: { type: 'paragraph', schema: { content: 'inline' } },
    heading: { type: 'heading', schema: { props: { level: [1, 2, 3] }, content: 'inline' } },
    divider: { type: 'divider', schema: { content: 'none' } },
  },
  marks: { bold: { type: 'bold' }, link: { type: 'link', valid: (m) => typeof m.href === 'string' } },
};
const doc = () => ({
  version: 1,
  root: 'doc',
  blocks: {
    doc: { type: 'doc', children: ['a', 'b'] },
    a: { type: 'heading', props: { level: 1 }, content: [{ text: 'Ship it', marks: [] }] },
    b: { type: 'paragraph', content: [{ text: 'See ', marks: [] }, { text: 'the docs', marks: [link] }], children: ['c'] },
    c: { type: 'divider' },
  },
});

test('norm merges equal neighbours and drops empty runs', () => {
  assert.deepEqual(norm([{ text: 'a', marks: [] }, { text: '', marks: [bold] }, { text: 'b', marks: [] }, { text: 'c', marks: [bold] }]), [
    { text: 'ab', marks: [] },
    { text: 'c', marks: [bold] },
  ]);
});

test('slice and splice address characters across runs', () => {
  const runs = doc().blocks.b.content;
  assert.deepEqual(slice(runs, 2, 6), [{ text: 'e ', marks: [] }, { text: 'th', marks: [link] }]);
  assert.equal(text(splice(runs, 4, 8, [{ text: 'our', marks: [link] }])), 'See ourdocs');
  assert.deepEqual(splice(runs, 0, 4), [{ text: 'the docs', marks: [link] }]);
  assert.deepEqual(slice(runs, 6, 6), []);
});

test('mapMarks rewrites only the range and renormalizes', () => {
  const out = mapMarks([{ text: 'hello', marks: [] }], 1, 3, (m) => [...m, bold]);
  assert.deepEqual(out, [{ text: 'h', marks: [] }, { text: 'el', marks: [bold] }, { text: 'lo', marks: [] }]);
});

test('flat map lookups: parent, subtree, document order', () => {
  const d = doc();
  assert.equal(parentOf(d, 'c'), 'b');
  assert.deepEqual(Object.keys(subtree(d, 'b')), ['c']);
  assert.deepEqual(order(d), ['a', 'b', 'c']);
});

test('clean enforces the schema; unknown types degrade to paragraphs with their text', () => {
  assert.deepEqual(clean({ type: 'heading', props: { level: 9, junk: 1 }, content: [{ text: 'x', marks: [{ type: 'nope' }, bold] }] }, reg), {
    type: 'heading',
    content: [{ text: 'x', marks: [bold] }],
  });
  assert.deepEqual(clean({ type: 'widget', content: [{ text: 'kept' }] }, reg), { type: 'paragraph', content: [{ text: 'kept', marks: [] }] });
  assert.deepEqual(clean({ type: 'divider', content: [{ text: 'x' }] }, reg), { type: 'divider' });
});

test('parse(serialize(doc)) is the identity and drops orphans and cycles', () => {
  const d = doc();
  assert.deepEqual(parse(serialize(d), reg), d);
  const messy = doc();
  messy.blocks.orphan = { type: 'paragraph', content: [] };
  messy.blocks.c.children = ['b'];
  assert.deepEqual(parse(messy, reg).blocks, { ...d.blocks, c: { type: 'divider' } });
});
