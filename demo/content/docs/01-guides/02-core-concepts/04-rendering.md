---
title: Rendering model
description: One host per block, each re-rendered only when what it draws changes; typing changes nothing.
icon: gauge
---

A binding renders one host element per block and the list of its children; everything inside a host belongs to the editor's view. Each host subscribes to its own block and re-renders only when what it draws changes: the block's type, its child list, or attributes a module puts on the host. Props a block draws itself are patched by the view, and typing changes nothing.

| Change | What renders |
| --- | --- |
| typing, deleting, selecting | nothing |
| a mark (bold, a link) | nothing — the view repaints the text |
| a prop the block draws itself (a heading level, a to-do's box) | nothing — the view patches or rebuilds that block's element |
| a prop shown on the host (a list's numbering, a table's columns) | that block |
| inserting or removing a block | the block whose child list changed, and the new block |
| moving a block | the parents it left and joined |

## React

```jsx Page.jsx
import { useEffect } from 'react';
import preset from '@verbal/editor/preset';
import { Blocks, useEditor } from '@verbal/editor/react';

export function Page({ doc, onSave }) {
  const editor = useEditor({ ...preset, doc });
  useEffect(() => editor.on('change', () => onSave(editor.getDoc())), [editor, onSave]);
  return <Blocks editor={editor} className="page" />;
}
```

- `useEditor(options)` creates one editor for the component's lifetime. Options are read once; to load a different document later, call `editor.setDoc(doc)`.
- `<Blocks editor>` renders the document; re-renders of your app stop there.
- `useBlock(editor, id)` returns a block and re-renders when that block changes — for your own UI around blocks.

## Plain DOM

`@verbal/editor/dom` does the same without a framework: `mount` builds the hosts, patches only the ones whose version moved, and returns the function that removes it all. The [Core only example](#/examples/core) runs on it, with no modules at all.

```js vanilla.js
import { Editor } from '@verbal/editor';
import { mount } from '@verbal/editor/dom';
import heading from '@verbal/editor/blocks/heading';

const editor = new Editor({ blocks: [heading] });
const stop = mount(editor, document.getElementById('editor'));
window.addEventListener('pagehide', stop);
```

## Counting renders

Pass `onRender` to see every block render; both bindings call it. The landing's render counter and this repository's tests use it.

```jsx Watched.jsx
import preset from '@verbal/editor/preset';
import { Blocks, useEditor } from '@verbal/editor/react';

export function Watched() {
  const editor = useEditor({ ...preset, onRender: (id) => console.count(id) });
  return <Blocks editor={editor} />;
}
```

## Read-only

`editable: false` renders the same document without editing: text stays selectable and copyable, every transaction is ignored, and modules hide their controls (a code block's language picker becomes a label, table tools and chart menus disappear, to-do boxes stop toggling).

```jsx Article.jsx
import preset from '@verbal/editor/preset';
import { Blocks, useEditor } from '@verbal/editor/react';

export function Article({ doc }) {
  const editor = useEditor({ blocks: preset.blocks, marks: preset.marks, doc, editable: false });
  return <Blocks editor={editor} />;
}
```

## Server rendering

The editor and its modules touch the DOM only when mounted, so importing them on the server is safe when your bundler handles their CSS imports. The text itself is written by the view in the browser, so render the editor on the client — in Next.js, load it with `dynamic(..., { ssr: false })` as in the [Quickstart](#/docs/quickstart).
