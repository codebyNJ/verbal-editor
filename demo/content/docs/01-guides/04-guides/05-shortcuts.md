---
title: Shortcuts
description: Every key and Markdown rule, generated from the modules this site registers.
icon: keyboard
---

`Mod` is <kbd>⌘</kbd> on Apple devices and <kbd>Ctrl</kbd> elsewhere. These tables are generated from the registered modules, so they always match what the editor does.

## Everywhere

{{shortcuts}}

## Inside a block

Some keys mean something different depending on where the caret is — <kbd>Tab</kbd> moves between table cells, <kbd>⏎</kbd> keeps the indentation in code:

{{keys}}

## As you type

At the start of an empty paragraph, these turn it into another block:

{{rules}}

Inside text, a closed pair of delimiters becomes a mark the moment you type the closing one:

{{inline}}

One undo turns any of these conversions back into the characters you typed.

## Selecting blocks

- <kbd>Esc</kbd> selects the block the caret is in; <kbd>⇧↑</kbd> and <kbd>⇧↓</kbd> grow or shrink the selection; <kbd>↑</kbd> and <kbd>↓</kbd> move it.
- <kbd>⌘A</kbd> selects the block's text, then every block.
- Drag across text, or <kbd>⇧</kbd>-click, to select whole blocks.
- With blocks selected: <kbd>Backspace</kbd> deletes them, <kbd>Tab</kbd> and <kbd>⇧Tab</kbd> nest them, <kbd>⌘⇧↑</kbd> and <kbd>⌘⇧↓</kbd> move them, and the <kbd>⌘⌥</kbd> shortcuts turn them into another type — each as one undo step.

## Your own keys

```js save-key.js
import { Editor } from 'verbal-editor';

const editor = new Editor();
editor.on('key', ({ name }) => {
  if (name !== 'Mod-s') return false;
  localStorage.setItem('note', JSON.stringify(editor.getDoc()));
  return true; // claimed: nothing else handles it
});
```
