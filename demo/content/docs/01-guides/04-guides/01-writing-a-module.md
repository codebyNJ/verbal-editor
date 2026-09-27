---
title: Writing a module
description: Your own blocks, marks and UI are plain objects with the same contract the built-in modules use.
icon: box
---

Core knows only paragraphs. Every other block type, mark and piece of UI is a plain object passed to the editor — the same contract the built-in modules use. The types are `BlockModule`, `MarkModule` and `UiModule` from `verbal-editor`.

## A block

A callout: text with a tone, inserted from the slash menu or by typing `! ` at the start of a line.

```js callout.js
import { Editor } from 'verbal-editor';

/** @type {import('verbal-editor').BlockModule} */
const callout = {
  type: 'callout',
  schema: { props: { tone: ['info', 'warning'] }, content: 'inline' },
  create: (props) => ({ type: 'callout', props: { tone: 'info', ...props }, content: [] }),
  className: 'callout',
  view: {
    create: () => document.createElement('aside'),
    host: (block) => ({ 'data-tone': block.props.tone }),
  },
  slash: { label: 'Callout', icon: '!', keywords: ['note', 'tip'] },
  input: { markdown: [[/^!\s$/, () => ({ type: 'callout' })]] },
  parse: { tags: ['ASIDE'] },
  serialize: {
    markdown: (block, md) => `> Note: ${md.inline(block.content)}`,
    html: (block, inner) => `<aside>${inner}</aside>`,
  },
};

new Editor({ blocks: [callout] });
```

| Field | What it declares |
| --- | --- |
| `type` | the block type; the only required field |
| `schema` | props (a constructor, or the allowed values) and the content kind: `'inline'` text with marks, `'code'` plain text, `'none'` for a void block |
| `create` | a fresh block of this type |
| `view` | `create` returns the element that holds the text; `patch` updates it in place; `host` adds attributes to the block's host |
| `slash` | one or more slash-menu entries |
| `input` | scoped `keys`, global `shortcuts`, and `markdown` typing rules that turn a paragraph into this type |
| `parse` | the HTML `tags` and Markdown it is read from when pasted |
| `serialize` | how it is copied as Markdown and HTML |
| `next` | what Enter creates after it |
| `mount` | runs when the editor mounts; returns its cleanup |

Style it with ordinary CSS: `.callout[data-tone="warning"] { … }`.

## A mark

```js highlight.js
import { Editor } from 'verbal-editor';

/** @type {import('verbal-editor').MarkModule} */
const highlight = {
  type: 'highlight',
  tags: ['MARK'],
  shortcut: 'Mod-Shift-h',
  markdown: /==([^=\n]+)==$/,
  md: '==',
  toolbar: { label: 'H', title: 'Highlight ⌘⇧H' },
};

new Editor({ marks: [highlight] });
```

The first tag renders the mark, `markdown` converts `==text==` as you type, `md` writes it back when copying, and `toolbar` adds a button to the selection toolbar.

## A piece of UI

UI modules are framework-free: they get the editor when it mounts and return a cleanup.

```js word-count.js
import { Editor } from 'verbal-editor';

/** @type {import('verbal-editor').UiModule} */
const wordCount = {
  name: 'word-count',
  mount(editor) {
    const badge = document.body.appendChild(document.createElement('output'));
    const count = () => {
      const words = Object.values(editor.doc.blocks).flatMap((b) => (b.content ?? []).map((r) => r.text));
      badge.textContent = `${words.join(' ').split(/\s+/).filter(Boolean).length} words`;
    };
    count();
    const off = editor.on('change', count);
    return () => (off(), badge.remove());
  },
};

new Editor({ ui: [wordCount] });
```

Blocks and marks can have a `mount` hook too — the table uses it to keep typing in cells free of Markdown rules, the chart to redraw when its table changes.

## Rules the built-in modules follow

- Never write into a block's text directly; use [transactions](#/docs/transactions), so undo stays exact.
- Keep anything that is not text out of the editable element, or mark it `data-skip`.
- Put positioned UI in the top layer (`popover`) or `document.body`, not inside the editor.
- Hide controls under `[data-readonly]` so the module behaves in a read-only editor.

> [!TIP]
> This site's docs components — callouts, code groups, steps and cards — are modules written exactly this way, in `demo/markdown.js`.
