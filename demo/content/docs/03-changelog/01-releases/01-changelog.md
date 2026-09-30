---
title: Changelog
description: What each version contains. Only what is in the package is listed.
icon: history
---

## 0.1.1 — 30 September 2026

Package metadata only: the editor, its CSS and the CLI are byte-identical to 0.1.0.

- npm now links to the source repository and the issue tracker, and lists keywords.
- The homepage is [verbal-editor.nijeeshnj.tech](https://verbal-editor.nijeeshnj.tech).
- Published from GitHub Actions with npm provenance.
- The README links runnable starters for React (Vite) and Next.js.

## 0.1.0 — 27 September 2026

The first version.

### Package

- The editor core with the paragraph block, transactions, history and selection; React (`verbal-editor/react`) and plain DOM (`verbal-editor/dom`) bindings.
- `editable: false` for read-only rendering: every transaction is ignored and modules hide their controls.
- The full preset: {{kb preset}} of JavaScript and {{kb css}} of CSS, gzip.
- `verbal.config.js`, the `verbal` CLI and server validation, all build-time and server-only.

### Features

Every feature below has acceptance tests in this repository:

{{features}}

```js version.js
import { Editor } from 'verbal-editor';

console.log(typeof Editor); // 'function' in every version
```
