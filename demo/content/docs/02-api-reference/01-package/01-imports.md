---
title: Imports
description: Every entry the package exports, what it contains, and what it weighs.
icon: package
---

Each subpath is its own entry: importing one pulls in only what it needs, and every module imports its own CSS, so a bundler never includes styles for modules you do not use. Sizes are gzip, measured from the built package; an entry's size includes everything it imports.

{{imports}}

`/config` and `/server` run at build time and on your server — they import Joi and never reach the browser.

## One module, one import

```js imports.js
import { Editor } from 'verbal-editor';
import { Blocks, useEditor } from 'verbal-editor/react';
import table, { addRow } from 'verbal-editor/blocks/table';
import { review } from 'verbal-editor/ai/pending';

console.log(typeof Editor, typeof Blocks, typeof useEditor, table.type, typeof addRow, typeof review);
```

> [!NOTE]
> Types for every entry ship alongside it: each `exports` entry has a `types` condition pointing at declarations generated from the source's JSDoc.
