---
title: Clipboard
description: Copy writes exact blocks and Markdown; paste parses, never injects.
icon: clipboard
---

Copying writes two formats at once: HTML that carries the exact blocks — types, props, marks, nesting — for pasting back into Verbal, and Markdown as plain text for everywhere else.

Pasting reads, in order:

1. A module that claims the paste — image files become image blocks, a lone video link on an empty line becomes an embed, a link pasted over selected text links it, text pasted into a table cell stays in that cell.
2. Verbal's own HTML — pasted back exactly.
3. Any other HTML — read in an inert document through each module's parse rules (`<h1>`, `<li>`, `<blockquote>`, `<pre>`, `<img>`…). Scripts, styles, event handlers and unknown elements never reach the page; unknown elements degrade to paragraphs, and unsafe link targets are dropped.
4. Plain text — read as Markdown.

Inside a code block, a paste is always plain text.

## From code

```js clipboard.js
import { Editor, caret } from '@verbal/editor';
import preset from '@verbal/editor/preset';

const editor = new Editor({ ...preset });
const first = editor.getDoc().blocks.doc.children[0];
editor.select(caret(first, 0));
editor.paste({ text: '## Groceries\n- bread\n- [ ] milk' });

editor.select({ blocks: editor.getDoc().blocks.doc.children });
const copied = editor.copy(); // { html, text }
console.log(copied?.text);
```

## Markdown in, Markdown out

`fromMarkdown(text, editor.registry)` gives the block literals a paste would insert, and `write(blocks, editor.registry)` the `{ html, text }` a copy would produce — useful for importing notes or exporting a document:

```js markdown.js
import { Editor, fromMarkdown, write } from '@verbal/editor';
import preset from '@verbal/editor/preset';

const editor = new Editor({ ...preset });
const blocks = fromMarkdown('# Title\n\nSome **bold** text.', editor.registry);
console.log(write(blocks, editor.registry).text);
```

> [!NOTE]
> Markdown tables paste as tables; tables inside pasted HTML become paragraphs. See [Limitations](#/docs/limitations).
