---
title: Choosing modules
description: Every block, mark and piece of UI is opt-in; here is what each one adds and weighs.
icon: layers
---

The core ships one block type, the paragraph. Everything else is a module — a plain object you pass to the editor. Importing a module registers nothing by itself, and each one imports its own CSS, so an editor weighs exactly the modules you list.

```js editor.js
import { Editor } from 'verbal-editor';
import heading from 'verbal-editor/blocks/heading';
import code from 'verbal-editor/blocks/code';
import bold from 'verbal-editor/marks/bold';
import toolbar from 'verbal-editor/ui/toolbar';

const editor = new Editor({ blocks: [heading, code], marks: [bold], ui: [toolbar] });
```

## Or take all of them

`verbal-editor/preset` lists every block, mark and UI module, and re-exports the AI review helpers. Spread it into the options and add or remove from its arrays:

```js full.js
import { Editor } from 'verbal-editor';
import preset from 'verbal-editor/preset';

const editor = new Editor({ ...preset, ui: preset.ui.filter((m) => m.name !== 'emoji') });
```

## What each one weighs

Measured from the built package with gzip, the way the size gate in CI measures it. The budget column is the limit that gate enforces.

{{sizes}}

Code languages are not in these numbers: each one loads the first time a block shows it. The emoji index is fetched on the first `:` you type.

## Kinds of module

| Kind | Import from | Examples | Registers |
| --- | --- | --- | --- |
| Blocks | `verbal-editor/blocks/<name>` | heading, table, code | a block type, its slash entries, keys and Markdown rules |
| Marks | `verbal-editor/marks/<name>` | bold, link | a mark, its shortcut and typing rule |
| UI | `verbal-editor/ui/<name>` | slash, toolbar, dnd | menus and interactions, no document content |
| AI | `verbal-editor/ai/<name>` | pending, diff | functions you call; nothing to register |

Every module has a reference page generated from its own source under [Modules](#/docs/modules).

> [!TIP]
> `npx verbal init` asks which modules you want and prints the imports for exactly those — see [CLI](#/docs/cli).
