import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../scripts/node-css.js';

const { Editor } = await import('../../src/index.js');

const doc = { version: 1, root: 'doc', blocks: { doc: { type: 'doc', children: ['a', 'b'] }, a: { type: 'paragraph', content: [{ text: 'one', marks: [] }] }, b: { type: 'paragraph', content: [{ text: 'two', marks: [] }] } } };

test('editable: false ignores every transaction, commands and history included', () => {
  const editor = new Editor({ doc, editable: false });
  const before = JSON.stringify(editor.getDoc());
  editor.dispatch(editor.tx().insertText('a', 0, 'x'));
  editor.select({ blocks: ['a', 'b'] });
  editor.remove(['a']);
  editor.indent('b');
  editor.setType('paragraph', undefined, 'a');
  editor.undo();
  assert.equal(JSON.stringify(editor.getDoc()), before);
  assert.ok(!editor.history.undo(), "nothing was recorded to undo");
});

test('the same document stays editable by default', () => {
  const editor = new Editor({ doc });
  editor.dispatch(editor.tx().insertText('a', 0, 'x'));
  assert.equal(editor.get('a').content[0].text, 'xone');
});
