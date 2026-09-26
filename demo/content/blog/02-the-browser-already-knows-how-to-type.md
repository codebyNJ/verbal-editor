---
title: The browser already knows how to type
description: The fastest keystroke handler is the one that does not run. Why Verbal lets the browser insert text and reads it back.
date: 2026-09-26
icon: pen
---

Typing is the one thing a text editor must never get wrong, and the browser has had decades of practice at it: input methods for every script, dead keys, autocorrect, dictation, spellcheck, the caret's exact position in bidirectional text. An editor that intercepts every keystroke and re-implements insertion takes all of that on itself.

## Let the ordinary case through

Verbal lets plain typing and deleting pass to the browser untouched. When the `input` event arrives, the view reads the block's text back, diffs it against the model and records the change. Nothing is re-rendered and nothing is repainted, because the screen already shows the right thing — the browser put it there.

Everything else — Enter, pasting, a Markdown shortcut, a formatting command from a system menu — is intercepted and handled explicitly, and anything the editor does not recognise is refused rather than guessed at. The rule is simple: the browser types; the editor decides structure.

## Why rendering is the expensive part

A keystroke that re-renders a component tree does work proportional to the tree, not to the keystroke. In a long document that is the difference between typing that keeps up and typing that stutters. Verbal's bindings render one host per block and subscribe each to its own version number, which moves only when that block's structure or props change. Typing moves none of them: the benchmark measured {{renders}} React renders per keystroke.

The benchmark also shows the cost of this design honestly: creating a separate editable element for every block makes mounting a long document slower than in some editors. See [Benchmarks](#/benchmarks). It is a trade we make on purpose — a document is opened once and typed into for hours.

## One editable element per block

Giving each block its own `contenteditable` keeps the browser's work local. Typing happens inside one block's text, a paste lands in one place, and the DOM inside a block holds nothing but text and the marks on it — written the same way in every engine, never with `execCommand`. When a block needs chrome — a checkbox, a language picker, a table toolbar — it sits outside the editable region, so clicking it never moves the caret.

Read how the pieces fit in [How it works](#/docs/how-it-works), and watch the render counter stay at zero on the [Writing example](#/examples/welcome).
