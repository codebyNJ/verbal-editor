import { test } from 'node:test';
import assert from 'node:assert/strict';
import { history } from '../../src/core/history.js';

const typing = (block, time, ch) => ({ ops: [{ op: 'insertText', block, text: ch }], before: `${block}@${time}`, after: `${block}@${time + 1}`, kind: 'text', block, time });

test('consecutive typing in one block coalesces into one undo step', () => {
  const h = history();
  h.push(typing('a', 0, 'h'));
  h.push(typing('a', 100, 'i'));
  const e = h.undo();
  assert.equal(e.ops.length, 2);
  assert.equal(e.before, 'a@0');
  assert.equal(e.after, 'a@101');
  assert.equal(h.undo(), null);
});

test('a pause, another block, a seal or a non-text step starts a new entry', () => {
  const h = history();
  h.push(typing('a', 0, 'x'));
  h.push(typing('a', 5000, 'y'));
  h.push(typing('b', 5001, 'z'));
  h.seal();
  h.push(typing('b', 5002, 'w'));
  h.push({ ops: [{ op: 'setProps' }], time: 5003 });
  assert.equal([h.undo(), h.undo(), h.undo(), h.undo(), h.undo()].filter(Boolean).length, 5);
});

test('redo replays undone entries and a new push clears redo', () => {
  const h = history();
  h.push(typing('a', 0, 'x'));
  h.push({ ops: [{ op: 'setProps' }], time: 1 });
  const e = h.undo();
  assert.equal(h.redo(), e);
  h.undo();
  h.push({ ops: [{ op: 'moveBlock' }], time: 2 });
  assert.equal(h.redo(), null);
});

test('the stack is bounded to the newest 500 steps', () => {
  const h = history();
  for (let i = 0; i < 520; i++) h.push({ ops: [i], time: i * 10000 });
  let n = 0;
  let e;
  while ((e = h.undo())) n++, (h.last = e);
  assert.equal(n, 500);
  assert.deepEqual(h.last.ops, [20]);
});
