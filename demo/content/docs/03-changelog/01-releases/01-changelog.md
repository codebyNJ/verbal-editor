---
title: Changelog
description: What each version contains. Only what is in the package is listed.
icon: history
---

## {{version}} — not yet published

The first version. It has not been published to npm; build it from this repository with `npm run build`.

### Package

- The editor core with the paragraph block, transactions, history and selection; React (`@verbal/editor/react`) and plain DOM (`@verbal/editor/dom`) bindings.
- `editable: false` for read-only rendering: every transaction is ignored and modules hide their controls.
- The full preset: {{kb preset}} of JavaScript and {{kb css}} of CSS, gzip.
- `verbal.config.js`, the `verbal` CLI and server validation, all build-time and server-only.

### Features

Every feature below has acceptance tests in this repository:

{{features}}

```js version.js
import { Editor } from '@verbal/editor';

console.log(typeof Editor); // 'function' in every version
```
