---
title: Accessibility
description: Keyboard first, native semantics where they exist, and an honest list of the gaps.
icon: a11y
---

- **Keyboard first.** Everything has a key: formatting, block types, moving blocks (<kbd>⌘⇧↑</kbd> / <kbd>⌘⇧↓</kbd>), selecting blocks, table navigation, the slash menu, the emoji picker, accepting or rejecting AI suggestions. See [Shortcuts](#/docs/shortcuts).
- **Native semantics.** Headings are `<h1>`–`<h3>`, quotes `<blockquote>`, code `<pre>`, links `<a>`, images `<img alt>`. Equations are MathML, which screen readers can read.
- **Roles and names.** The slash and emoji menus are listboxes with options, the toolbars are toolbars, to-do boxes are checkboxes with their state, and icon buttons carry their full name ("Link ⌘K", "Drag to move").
- **Motion.** All animation stops under `prefers-reduced-motion`.
- **Colour.** Every colour is a token, so a high-contrast theme is a few overrides — see [Theming](#/docs/theming).

## Checking your setup

```js audit.js
import { Editor } from '@verbal/editor';
import preset from '@verbal/editor/preset';

// Every slash entry has a label a screen reader can announce.
const editor = new Editor({ ...preset });
console.log(editor.registry.slash.every((entry) => entry.label.trim().length > 0));
```

## Known gaps

- List items are styled with CSS counters, not `<ul>`/`<ol>`, so screen readers do not announce them as lists.
- Tables are grids of editable cells without table semantics.
- Moving a block is not announced to screen readers.
- Table columns can be resized with a pointer only.
- The slash menu shows its highlighted option visually; it does not move screen-reader focus into the list.
