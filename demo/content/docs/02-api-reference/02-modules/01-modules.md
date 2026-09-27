---
title: Modules
description: Every block, mark, UI and AI module, with what it adds and what it weighs.
icon: box
---

Each module below has its own page, generated from the module itself: the text is its JSDoc, the contract is read off the module object, the size is measured from the built package, and the acceptance criteria are the rows of the feature table it cites. None of it can drift from the code.

{{modules}}

```js module.js
import { Editor } from 'verbal-editor';
import heading from 'verbal-editor/blocks/heading';

// Everything on a module's page is read from objects like this one.
console.log(heading.type, Object.keys(heading.schema?.props ?? {}), new Editor({ blocks: [heading] }).registry.slash.length);
```
