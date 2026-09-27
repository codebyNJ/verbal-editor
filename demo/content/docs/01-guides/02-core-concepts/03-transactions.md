---
title: Transactions & undo
description: Every change is a transaction of invertible operations; your code uses the same path as the keyboard.
icon: history
---

A keystroke, a paste, a drag, an undo and an accepted AI edit are all the same thing: a transaction of small operations, each carrying what it needs to invert itself. Your code changes the document the same way.

## Building a transaction

```js tx.js
import { Editor, caret } from 'verbal-editor';

const editor = new Editor();
const first = editor.getDoc().blocks.doc.children[0];

const t = editor.tx().insertText(first, 0, 'Hello, ').insertText(first, 7, 'world');
editor.dispatch(t, { selection: caret(first, 12) });
```

`tx()` starts a draft of the document. Each call applies one validated operation to the draft, so later calls see earlier ones (`t.get`, `t.parent`, `t.index` read the draft). Nothing changes until `dispatch`, and a dispatched transaction is one undo step. If an operation throws, the ones before it are rolled back.

| Method | Does |
| --- | --- |
| `insertText(block, at, text, marks?)` | inserts text with the given marks |
| `insertRuns(block, at, runs)` | inserts runs, each with its own marks |
| `deleteText(block, from, to)` | deletes a range |
| `mark(block, from, to, mark, on?)` | adds, or with `on = false` removes, a mark over a range |
| `setProps(block, props)` | merges props; `null` deletes one |
| `setType(block, type, props?)` | changes a block's type, keeping its text |
| `insert(parent, index, block)` | inserts a block and returns its id |
| `remove(id)` | removes a block and everything under it |
| `move(id, parent, index)` | moves a block with its children; `index` counts after its removal |

## Commands

Higher-level commands act on the current selection the way the keyboard does, and each is one transaction:

```js commands.js
import { Editor, caret } from 'verbal-editor';
import heading from 'verbal-editor/blocks/heading';
import bold from 'verbal-editor/marks/bold';

const editor = new Editor({ blocks: [heading], marks: [bold] });
const first = editor.getDoc().blocks.doc.children[0];

editor.select(caret(first, 0));
editor.insert('heading', { level: 2 }); // converts the empty paragraph
editor.toggleMark('bold'); // bold for whatever is typed next
editor.setType('paragraph'); // every selected block
editor.indent(); // Tab
editor.undo();
```

`indent`, `outdent` and `setType` take block ids as well — `editor.indent('a', 'b')` nests both in one step — and default to the blocks the selection touches.

## Selection

A selection is two text points — `{ anchor, focus }`, each `{ block, offset }` — or whole blocks, `{ blocks: [...] }`. `caret(block, offset)` builds a collapsed one, and `editor.range` gives `{ block, from, to }` when the selection lies inside one block.

## Events

```js events.js
import { Editor } from 'verbal-editor';

const editor = new Editor();
const stop = editor.on('change', ({ ops, origin }) => console.log(ops.length, 'ops from', origin ?? 'a command'));
editor.on('selectionchange', (selection) => console.log(selection));
editor.on('key', ({ name }) => name === 'Mod-s'); // true claims the key
stop();
```

| Event | Payload | Fires |
| --- | --- | --- |
| `change` | `{ ops, origin }` | after every transaction; `origin` is `'input'` for typing and `'history'` for undo and redo |
| `selectionchange` | the selection or `null` | whenever the selection moves |
| `input` | `{ id, data }` | after typed text, before Markdown rules — return `true` to skip them |
| `key` | `{ name, e }` | before any key is handled — return `true` to claim it |

## History

Undo restores the document and the selection exactly. Typing in one block within a second of the last keystroke joins the previous step; moving the caret seals it. Each Markdown conversion is its own step, so one undo turns `**bold**` back into the characters you typed. The newest 500 steps are kept.

> [!NOTE]
> A read-only editor (`editable: false`) ignores every transaction, so commands, undo and module controls leave the document untouched. This site's docs are rendered that way.
