---
title: Document model
description: A flat map of blocks with stable ids; text is runs of marks. Equal documents are equal JSON.
icon: braces
---

A document is a flat map of blocks plus `children` arrays that give the order. Ids are stable: moving, nesting or undoing never renames a block.

```json document.json
{
  "version": 1,
  "root": "doc",
  "blocks": {
    "doc": { "type": "doc", "children": ["a", "b"] },
    "a": { "type": "heading", "props": { "level": 2 }, "content": [{ "text": "Plan", "marks": [] }] },
    "b": { "type": "list", "props": { "ordered": false }, "content": [{ "text": "Ship ", "marks": [] }, { "text": "it", "marks": [{ "type": "bold" }] }], "children": ["c"] },
    "c": { "type": "todo", "props": { "checked": true }, "content": [{ "text": "Write docs", "marks": [] }] }
  }
}
```

## Blocks

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | the module that owns the block; `doc` for the root |
| `props` | `object` | the module's declared props, such as a heading's `level`; anything undeclared is dropped on load |
| `content` | `Run[]` | the block's text; absent on void blocks (divider, image, table, chart) |
| `children` | `string[]` | nested blocks in order: items under an item, cells in a table, blocks in a column |

## Runs and marks

Text is a list of runs. Each run carries the marks on it, sorted by type; a mark is `{ type }` plus the attributes it needs, such as a link's `href`. Adjacent runs with the same marks are always merged, so two equal documents are equal JSON.

```json runs.json
[
  { "text": "Read the ", "marks": [] },
  { "text": "docs", "marks": [{ "type": "bold" }, { "type": "link", "href": "https://example.com" }] }
]
```

## Reading and writing

```js io.js
import { Editor, serialize } from '@verbal/editor';

const editor = new Editor();
const doc = editor.getDoc(); // a deep copy, blocks in document order
const json = serialize(doc); // the same payload as a stable string
editor.setDoc(json); // replaces the document; history starts over
```

`getDoc()` returns a copy, so changing it changes nothing — to change the document, use a [transaction](#/docs/transactions). `setDoc` accepts the payload or its JSON string.

## Loading is forgiving

`parse` — which the `doc` option and `setDoc` use — repairs rather than rejects: unknown block types become paragraphs, orphaned blocks are dropped, props of the wrong type are removed and invalid marks (a `javascript:` link) disappear. An API that stores documents should reject instead; use [server validation](#/docs/server-validation).

> [!NOTE]
> Tables keep their cells as `children` of the table, row by row, `cols` wide. Columns hold `column` blocks, and each column holds ordinary blocks.
