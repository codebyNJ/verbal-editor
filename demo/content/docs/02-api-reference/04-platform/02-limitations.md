---
title: Limitations
description: What Verbal does not do yet, and what was left out to stay small.
icon: warning
---

- **Collaboration.** Operations are serializable and invertible, and `rebase` has its signature, but no sync is built.
- **Formatting from the browser's menu.** Commands from a system Format menu are ignored; use the shortcuts, the toolbar or Markdown.
- **Table paste.** Markdown tables paste as tables; tables in pasted HTML become paragraphs. Merged cells are not supported.
- **Links.** A plain link pasted on its own line stays text unless it is a known video provider; paste it over selected text to make a link.
- **Embeds.** Titles for link cards come from your `unfurl(url)` option — browsers cannot fetch other sites' metadata themselves. Known video providers are YouTube, Vimeo, Loom, CodePen and Spotify, and load only when clicked.
- **Emoji.** 1,923 emoji by name, without skin-tone variants.
- **Code.** Ten languages are highlighted; indentation is two spaces.
- **Selecting blocks.** A box selection must start inside text; it cannot start in the page margin.
- **Moving blocks across parents.** Moving a block into another list or column renders both containers, not one.
- **Read-only mode.** `editable: false` stops every change, but UI modules (slash menu, toolbar, drag & drop) are not told; leave them out of a read-only editor.
- **Accessibility.** See the [known gaps](#/docs/accessibility).

## Working around the embed titles

```js unfurl.js
import { Editor } from '@verbal/editor';
import embed from '@verbal/editor/blocks/embed';

// Your server fetches the page and returns its title; the card shows it.
const editor = new Editor({ blocks: [embed], unfurl: (url) => fetch(`/api/unfurl?url=${encodeURIComponent(url)}`).then((r) => r.json()) });
console.log(editor.registry.blocks.embed.type);
```
