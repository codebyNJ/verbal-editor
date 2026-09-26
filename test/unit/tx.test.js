import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, invert, rebase, tx } from '../../src/core/tx.js';

const bold = { type: 'bold' };
const fresh = () => ({
  version: 1,
  root: 'doc',
  blocks: {
    doc: { type: 'doc', children: ['a', 'b'] },
    a: { type: 'paragraph', content: [{ text: 'Hello ', marks: [] }, { text: 'world', marks: [bold] }] },
    b: { type: 'todo', props: { checked: false }, content: [], children: ['c'] },
    c: { type: 'paragraph', content: [{ text: 'nested', marks: [] }] },
  },
});
const clone = (d) => structuredClone({ version: d.version, root: d.root, blocks: d.blocks });

/** Applies ops, checks the result, then checks invert restores the original exactly. */
function roundTrip(build, expect) {
  const d = fresh();
  const before = clone(d);
  const t = build(tx(d));
  assert.deepEqual(clone(d), before, 'builder must not touch the live doc');
  for (const op of t.ops) apply(d, op);
  expect(d.blocks);
  for (const op of invert(t.ops)) apply(d, op);
  assert.deepEqual(clone(d), before);
}

const cases = {
  insertText: [
    (t) => t.insertText('a', 6, 'big ', [bold]),
    (b) => assert.deepEqual(b.a.content, [{ text: 'Hello ', marks: [] }, { text: 'big world', marks: [bold] }]),
    { op: 'insertText', block: 'a', at: 99, text: 'x', marks: [] },
  ],
  deleteText: [
    (t) => t.deleteText('a', 3, 8),
    (b) => assert.deepEqual(b.a.content, [{ text: 'Hel', marks: [] }, { text: 'rld', marks: [bold] }]),
    { op: 'deleteText', block: 'a', at: 0, len: 2, runs: [{ text: 'Zz', marks: [] }] },
  ],
  addMark: [
    (t) => t.mark('a', 0, 11, bold),
    (b) => assert.deepEqual(b.a.content, [{ text: 'Hello world', marks: [bold] }]),
    { op: 'addMark', block: 'a', from: 6, to: 8, mark: bold },
  ],
  removeMark: [
    (t) => t.mark('a', 0, 11, bold, false),
    (b) => assert.deepEqual(b.a.content, [{ text: 'Hello world', marks: [] }]),
    { op: 'removeMark', block: 'a', from: 0, to: 2, mark: bold },
  ],
  setProps: [
    (t) => t.setProps('b', { checked: true, color: 'red' }),
    (b) => assert.deepEqual(b.b.props, { checked: true, color: 'red' }),
    { op: 'setProps', block: 'b', props: { checked: true }, prev: { checked: true } },
  ],
  setType: [
    (t) => t.setType('a', 'heading', { level: 2 }),
    (b) => assert.deepEqual([b.a.type, b.a.props, b.a.content.length], ['heading', { level: 2 }, 2]),
    { op: 'setType', block: 'a', type: 'heading', props: {}, prev: { type: 'quote' } },
  ],
  insertBlock: [
    (t) => (t.insert('b', 1, { type: 'paragraph', content: [] }, {}, 'n'), t),
    (b) => assert.deepEqual(b.b.children, ['c', 'n']),
    { op: 'insertBlock', parent: 'doc', index: 0, id: 'a', block: { type: 'paragraph' }, sub: {} },
  ],
  removeBlock: [
    (t) => t.remove('b'),
    (b) => assert.deepEqual([b.doc.children, b.b, b.c], [['a'], undefined, undefined]),
    { op: 'removeBlock', parent: 'doc', index: 0, id: 'b' },
  ],
  moveBlock: [
    (t) => t.move('c', 'doc', 0),
    (b) => assert.deepEqual([b.doc.children, b.b.children], [['c', 'a', 'b'], undefined]),
    { op: 'moveBlock', block: 'b', from: ['doc', 1], to: ['c', 0] },
  ],
};

for (const [name, [build, expect, invalid]] of Object.entries(cases)) {
  test(`${name}: apply`, () => roundTrip(build, expect));
  test(`${name}: invert of invert reproduces the same document`, () => {
    const once = fresh();
    const twice = fresh();
    const t = build(tx(once));
    for (const op of t.ops) apply(once, op);
    for (const op of invert(invert(t.ops))) apply(twice, op);
    assert.deepEqual(clone(twice), clone(once));
  });
  test(`${name}: invalid input is rejected and leaves the doc untouched`, () => {
    const d = fresh();
    const before = clone(d);
    assert.throws(() => apply(d, invalid), /Invalid/);
    assert.deepEqual(clone(d), before);
  });
}

test('unknown ops are rejected', () => assert.throws(() => apply(fresh(), { op: 'explode' }), /unknown op/));

test('mark() emits one exactly-invertible op per run, replacing a different link', () => {
  const d = fresh();
  d.blocks.a.content = [{ text: 'ab', marks: [{ type: 'link', href: '/x' }] }, { text: 'cd', marks: [] }];
  const t = tx(d).mark('a', 0, 4, { type: 'link', href: '/y' });
  assert.deepEqual(t.ops.map((o) => o.op), ['removeMark', 'addMark', 'addMark']);
  assert.deepEqual(t.doc.blocks.a.content, [{ text: 'abcd', marks: [{ type: 'link', href: '/y' }] }]);
});

test('rebase has its collaboration signature reserved', () => {
  assert.equal(rebase.length, 2);
  assert.throws(() => rebase([], []), /not built/);
});
