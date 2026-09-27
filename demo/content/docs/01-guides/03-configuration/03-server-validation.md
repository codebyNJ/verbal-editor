---
title: Server validation
description: validateDoc rejects malformed documents at your API boundary with precise paths; it never repairs.
icon: shield
---

Loading in the browser is forgiving: an unknown block becomes a paragraph. Your API should not be. `validateDoc` checks a document against the modules you enable and rejects anything malformed — nothing is coerced or repaired.

```js api.js
import { defineConfig } from 'verbal-editor/config';
import { validateDoc } from 'verbal-editor/server';

const config = defineConfig({ blocks: ['heading', 'list', 'table'], marks: ['bold', 'link'] });

/** Accepts a document only if every block, prop and mark is one this app allows. */
export function ingest(body) {
  const { error, value } = validateDoc(body, config);
  if (error) return { status: 422, errors: error.details.map((d) => d.message) };
  return { status: 200, doc: value };
}
```

## What it checks

- **Types.** Every block type and mark is one the config enables (all modules when the config is omitted).
- **Props.** Each prop has the type its module declares — a heading's `level` is one of its levels, a to-do's `checked` a boolean.
- **Text where text belongs.** Void blocks carry no `content`; code blocks carry no marks.
- **Marks.** Each mark passes its module's own check, so a link with a `javascript:` target is rejected.
- **One tree.** The root exists and is the only `doc`; every child exists and appears exactly once, with no orphans.

## Errors

`error.details` lists every problem with a path. These are its real messages for a document with a heading at level 5 and a `javascript:` link, and for one whose root lists a block that does not exist — the tree is checked once every block is valid:

{{validate-errors}}

> [!NOTE]
> Validation uses Joi, so it runs on your server or in build scripts. The browser never loads it.
