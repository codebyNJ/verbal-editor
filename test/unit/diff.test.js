import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffWords, hunks } from '../../src/ai/diff.js';

const apply = (a, parts) => parts.filter((p) => p.op !== '-').map((p) => p.text).join('');
const undo = (parts) => parts.filter((p) => p.op !== '+').map((p) => p.text).join('');

test('identical text is one equal part and no hunks', () => {
  assert.deepEqual(diffWords('same words', 'same words'), [{ op: '=', text: 'same words' }]);
  assert.deepEqual(hunks(diffWords('', '')), []);
});

test('word-level insert, delete and replace', () => {
  assert.deepEqual(diffWords('the fox', 'the quick fox'), [
    { op: '=', text: 'the ' },
    { op: '+', text: 'quick ', hunk: 0 },
    { op: '=', text: 'fox' },
  ]);
  assert.deepEqual(hunks(diffWords('a big red dog', 'a small red cat')), [
    { at: 2, del: 'big', ins: 'small' },
    { at: 10, del: 'dog', ins: 'cat' },
  ]);
  assert.deepEqual(hunks(diffWords('keep this, drop that.', 'keep this.')), [{ at: 9, del: ', drop that', ins: '' }]);
});

test('the edit script is minimal and both sides reconstruct exactly', () => {
  const cases = [
    ['Verbal is a block editor with zero runtime dependencies.', 'Verbal is a tiny block editor with no runtime dependencies at all.'],
    ['one two three four five', 'five four three two one'],
    ['', 'from nothing'],
    ['to nothing', ''],
    ['naïve café — ünïcode', 'naïve bistro — ünïcode!'],
  ];
  for (const [a, b] of cases) {
    const parts = diffWords(a, b);
    assert.equal(apply(a, parts), b);
    assert.equal(undo(parts), a);
  }
  const swapped = diffWords('one two three four five', 'five four three two one');
  assert.equal(swapped.filter((p) => p.op === '=').map((p) => p.text).join(''), ' three ', 'keeps the longest common subsequence');
  assert.deepEqual(hunks(swapped), [
    { at: 0, del: 'one two', ins: 'five four' },
    { at: 14, del: 'four five', ins: 'two one' },
  ]);
});

test('changes separated only by whitespace form one hunk', () => {
  assert.deepEqual(hunks(diffWords('it doesnt need any deps', 'it needs no deps')), [{ at: 3, del: 'doesnt need any ', ins: 'needs no ' }]);
});
