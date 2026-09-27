---
title: Introduction
description: A block editor for the web that stays out of your framework's way and weighs what you use.
icon: compass
---

Verbal is a block editor — paragraphs, headings, lists, to-dos, quotes, code, tables, charts, equations, columns, images and embeds — with no runtime dependencies. Every block is its own editable element: the browser handles your typing and Verbal reads it back, so typing, selecting and formatting never re-render React.

::: stats
- **{{kb core}}** core: editor, React binding and paragraph, JS gzip
- **{{kb preset}}** every module, JS gzip
- **0** React renders per keystroke
:::

These figures come from the package's size build and its benchmark; see [Benchmarks](#/benchmarks) for how they compare with other editors.

## What makes it different

- **The browser types.** Plain typing and deleting pass through to the browser untouched. The view reads the result back into the model; nothing re-renders, so a keystroke in a 1,000-block document costs the same as in an empty one.
- **Everything is a module.** Core knows only paragraphs. Each block type, mark and piece of UI is a plain object you pass in, and each brings its own CSS — you pay for what you list, nothing more.
- **Every change is a transaction.** Keystrokes, commands, pastes and AI suggestions all become small operations that carry their own inverse. Undo restores the document and the selection exactly.
- **The platform does the heavy lifting.** Code colours use the CSS Custom Highlight API, equations compile to MathML, menus use the Popover API and dragging uses Pointer Events — no highlighter, math renderer or drag library ships.

## A first look

```jsx App.jsx
import 'verbal-editor/tokens.css';
import preset from 'verbal-editor/preset';
import { Blocks, useEditor } from 'verbal-editor/react';

export default function App() {
  const editor = useEditor({ ...preset });
  return <Blocks editor={editor} />;
}
```

That is a complete editor with every module. Most apps list only the modules they need — see [Choosing modules](#/docs/choosing-modules).

## Where to go next

::: cards
- [Installation](#/docs/installation) Add the package and its stylesheet.
- [Quickstart](#/docs/quickstart) A working editor in React, Next.js, Vite or plain JavaScript.
- [How it works](#/docs/how-it-works) The four layers, and what happens on a keystroke.
- [Writing a module](#/docs/writing-a-module) Your own blocks, marks and UI with the same contract.
:::
