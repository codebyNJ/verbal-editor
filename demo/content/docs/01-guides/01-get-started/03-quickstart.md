---
title: Quickstart
description: A working editor in React, Next.js, Vite or plain JavaScript, saved on every change.
icon: bolt
---

Pick your setup. Each sample is a complete editor with headings, lists, to-dos, bold, italic, links and the slash menu — swap the modules for the ones you need.

::: code-group
```jsx [React] components/Editor.jsx
import '@verbal/editor/tokens.css';
import heading from '@verbal/editor/blocks/heading';
import list from '@verbal/editor/blocks/list';
import todo from '@verbal/editor/blocks/todo';
import bold from '@verbal/editor/marks/bold';
import italic from '@verbal/editor/marks/italic';
import link from '@verbal/editor/marks/link';
import slash from '@verbal/editor/ui/slash';
import { Blocks, useEditor } from '@verbal/editor/react';

export default function Editor() {
  const editor = useEditor({ blocks: [heading, list, todo], marks: [bold, italic, link], ui: [slash] });
  return <Blocks editor={editor} />;
}
```
```jsx [Next.js] app/page.jsx
'use client';
import dynamic from 'next/dynamic';

// The editor lives in the browser: load it without server rendering.
const Editor = dynamic(() => import('../components/Editor.jsx'), { ssr: false });

export default function Page() {
  return <Editor />;
}
```
```jsx [Vite] src/main.jsx
import { createRoot } from 'react-dom/client';
import '@verbal/editor/tokens.css';
import preset from '@verbal/editor/preset';
import { Blocks, useEditor } from '@verbal/editor/react';

function App() {
  const editor = useEditor({ ...preset });
  return <Blocks editor={editor} />;
}

createRoot(document.getElementById('root')).render(<App />);
```
```js [Vanilla JS] main.js
import '@verbal/editor/tokens.css';
import { Editor } from '@verbal/editor';
import { mount } from '@verbal/editor/dom';
import heading from '@verbal/editor/blocks/heading';
import list from '@verbal/editor/blocks/list';
import bold from '@verbal/editor/marks/bold';
import slash from '@verbal/editor/ui/slash';

const editor = new Editor({ blocks: [heading, list], marks: [bold], ui: [slash] });
mount(editor, document.getElementById('editor'));
```
:::

In Next.js, `components/Editor.jsx` is the React sample. The Vite sample starts from `npm create vite@latest -- --template react`; the vanilla one needs only an element with `id="editor"` and any bundler.

## Save and load

::: steps
### Listen for changes
Every transaction — a keystroke, a paste, an undo — fires `change`. Save the document there.

### Store the JSON
`getDoc()` returns a plain, deep-copied document. It serializes as it is.

### Load it back
Pass it as `doc` when you create the editor, or call `setDoc` later.
:::

```js storage.js
import { Editor } from '@verbal/editor';

const saved = localStorage.getItem('note');
const editor = new Editor({ doc: saved ? JSON.parse(saved) : undefined });
editor.on('change', () => localStorage.setItem('note', JSON.stringify(editor.getDoc())));
```

> [!NOTE]
> Loading is forgiving: unknown block types become paragraphs and invalid marks are dropped. Validate documents strictly on your server with [server validation](#/docs/server-validation).

## Next

::: cards
- [Choosing modules](#/docs/choosing-modules) What each module adds and weighs.
- [Document model](#/docs/document-model) What `getDoc()` returns.
- [Transactions & undo](#/docs/transactions) Change the document from code.
:::
