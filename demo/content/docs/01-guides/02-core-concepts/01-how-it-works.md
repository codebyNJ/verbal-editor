---
title: How it works
description: Four layers, and exactly what each one does on a keystroke, an Enter, a paste and an AI edit.
icon: layers
---

::: diagram layers "Four layers, top to bottom: the view, the binding, the editor and the model. Changes flow down as transactions." :::

- **Model.** A flat map of blocks with `children` arrays for order and nesting. Ids never change, so moving or undoing never renames a block. See [Document model](#/docs/document-model).
- **Editor.** Turns intent — keys, commands, typing rules, module actions — into transactions of small operations, each carrying its inverse, and keeps the history. See [Transactions & undo](#/docs/transactions).
- **Binding.** Renders one host element per block, each re-rendered only when what it draws changes: the block's type, its child list, or attributes a module puts on the host. Typing and props a block draws itself render nothing. React and plain DOM bindings follow the same contract. See [Rendering model](#/docs/rendering).
- **View.** Owns everything inside a host: one `contenteditable` per text block, the mapping between DOM selections and model positions, and the markup for marks — written the same way in every engine, never with `execCommand`.

## A keystroke

::: steps
### The browser inserts the character
`beforeinput` sees `insertText` and lets it through. No script runs before the character appears.

### The view reads it back
On `input`, the view reads the block's text runs from the DOM and hands them to the editor with the selection before and after.

### The editor records it
The editor diffs old and new text into `insertText`/`deleteText` operations and dispatches them with `origin: 'input'`: the model and history update, nothing is repainted and no version moves, so no block re-renders.

### Rules get a look
Listeners on `input` run, then Markdown rules: `# ` at the start of a paragraph, or a closing `**`, converts in its own undo step.
:::

## Enter

::: steps
### The key is claimed
Enter is handled on `keydown` (or as `insertParagraph` from `beforeinput`). A listener on `key` can claim it first, then the block's module (Enter in code inserts a newline), then shortcuts, then core.

### The block splits
Core deletes any selected text, moves the text after the caret into a new block — the type comes from the module's `next` — and dispatches one transaction.

### Two blocks render
The parent's version moves because its child list changed, and the new block mounts. Everything else stays as it was.
:::

## A paste

::: steps
### A module may claim it
Image files become image blocks, a lone video link on an empty line becomes an embed, text pasted into a table cell stays in that cell.

### Verbal's own copy comes back exactly
Copying writes the exact blocks into the HTML; pasting them back restores types, props, marks and nesting.

### Anything else is parsed, never injected
Other HTML is read in an inert document through each module's parse rules; plain text is read as Markdown. The result is one transaction with fresh ids.
:::

## An AI edit

`review(editor, changes)` shows the proposed text as a word diff painted over the real text with the Custom Highlight API. The model does not change while you review. Accepting dispatches one ordinary transaction — undo takes it back like anything you typed — and rejecting leaves the document byte-for-byte as it was. See [AI review](#/docs/ai-review).

```js review.js
import { Editor } from '@verbal/editor';
import { review } from '@verbal/editor/ai/pending';

const editor = new Editor();
const [first] = editor.getDoc().blocks.doc.children;
const { done } = review(editor, { [first]: 'A tighter first paragraph.' });
done.then(() => console.log('every hunk accepted or rejected'));
```
