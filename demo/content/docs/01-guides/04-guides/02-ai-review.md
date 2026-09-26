---
title: AI review
description: AI edits arrive as a proposal painted over the real text; nothing changes until you accept.
icon: sparkle
---

An AI edit arrives as a proposal, not a replacement. The document does not change until you accept: deletions are painted over the real text with the CSS Custom Highlight API, and the proposed text sits beside the block. Accept or reject everything — <kbd>⌘⏎</kbd> or <kbd>Esc</kbd> — or hunk by hunk. An accepted edit is one ordinary undo step; a rejected one leaves the document byte-for-byte as it was.

```js suggest.js
import { Editor } from '@verbal/editor';
import { review } from '@verbal/editor/ai/pending';

const editor = new Editor();

/** Asks your server to rewrite every paragraph, then shows the result as a reviewable diff. */
export async function suggest() {
  const paragraphs = Object.entries(editor.getDoc().blocks).filter(([, b]) => b.type === 'paragraph');
  const texts = Object.fromEntries(paragraphs.map(([id, b]) => [id, (b.content ?? []).map((r) => r.text).join('')]));
  const res = await fetch('/api/rewrite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(texts) });
  const { done } = review(editor, await res.json());
  await done;
}
```

`review(editor, changes)` takes block id → proposed text and returns `{ done, preview, accept, reject }`. `done` resolves once every hunk is accepted or rejected. A block you edit while reviewing is diffed again against its proposal.

## The server side

Keep your model provider's key on the server. The route only has to return block id → new text:

```js rewrite.js
/**
 * Rewrites each block's text with a model of your choice.
 * @param {Record<string, string>} texts block id → current text
 * @param {(prompt: string) => Promise<string>} callModel your provider's API
 */
export async function rewrite(texts, callModel) {
  const out = {};
  for (const [id, text] of Object.entries(texts)) out[id] = await callModel(`Tighten this, keep its meaning:\n\n${text}`);
  return out;
}
```

## The diff

`diffWords(before, after)` from `@verbal/editor/ai/diff` is the word-level Myers diff the review uses, and `hunks(parts)` groups it into changes. Both work on plain strings, on the server too.

```js diff.js
import { diffWords, hunks } from '@verbal/editor/ai/diff';

const parts = diffWords('the quick brown fox', 'the quick red fox');
console.log(hunks(parts).length); // 1
```

> [!NOTE]
> Try it on the [AI review example](#/examples/ai): press Suggest edits, then accept or reject.
