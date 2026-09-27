# Verbal Editor — HLD


## 3.1 Design thesis

Three insights from platform research determine the entire architecture. Each one removes
a dependency the field currently considers mandatory.

**(a) For plain typing, do nothing.** `contenteditable` and React fight over DOM
ownership; every keystroke mutates the DOM, and a re-render from state destroys the
caret. The resolution is that the editor owns the DOM and React only mounts hosts — but
the stronger form is that on `insertText` and `deleteContentBackward` the editor *also*
does nothing. The browser's insertion is already correct. Read the text back, update the
model silently, write no DOM, render no component. This is why "zero re-renders per
keystroke" is achievable rather than aspirational.

**(b) Syntax highlighting needs no DOM nodes.** The CSS Custom Highlight API styles
arbitrary `Range`s without inserting elements — shipped in Chrome/Edge 105, Safari 17.2,
Firefox 140 (June 2025). Code blocks become plain text nodes the caret traverses
perfectly, with color painted over the top. This eliminates the entire class of cursor
bugs that makes code blocks in editable regions notoriously unstable — and the same
mechanism renders AI diffs.

**(c) The browser already renders math.** MathML Core is natively supported across
engines (Igalia upstreamed it into Chromium for Chrome 109; Gecko and WebKit preceded
it). The math module is therefore a ~5KB *compiler* to MathML rather than a ~75KB
renderer plus fonts.

## 3.2 Layer architecture

Strictly one-directional. Core never imports React; React never touches the model directly.

```
┌─────────────────────────────────────────────────────────────┐
│  MODULES   blocks/*  ·  marks/*  ·  ui/*  ·  ai/*           │
│            self-registering, independently importable        │
└───────────────────────────┬─────────────────────────────────┘
                            │ registry contract
┌───────────────────────────▼─────────────────────────────────┐
│  BINDING   react/  —  useSyncExternalStore, ~200 loc         │
│            replaceable; a Vue/Svelte/vanilla binding is      │
│            additive, not a rewrite                           │
└───────────────────────────┬─────────────────────────────────┘
                            │ versioned subscriptions
┌───────────────────────────▼─────────────────────────────────┐
│  CORE      pure JS · zero deps · node-testable, no DOM       │
│            model · tx · selection · history · view · store   │
└─────────────────────────────────────────────────────────────┘
```

```
src/
  core/     model.js tx.js selection.js history.js view.js registry.js store.js
  react/    index.js                       # useEditor, <Blocks>, useBlock
  blocks/   paragraph/ heading/ list/ todo/ quote/ divider/
            code/ table/ math/ chart/ embed/ image/
  marks/    bold.js italic.js strike.js inlineCode.js link.js
  ui/       slash/ toolbar/ dnd/ emoji/     + *.module.css
  ai/       diff.js pending.js
  config/   defineConfig.js schema.js       # joi — build/CLI only
cli/        index.js
test/       core/ blocks/ perf/
docs/
```

Distribution is a **single package with subpath exports** — the tree-shaking and import
ergonomics of a monorepo, with one version, one changelog, and no workspace tooling.

```js
import { Editor } from 'verbal-editor';
import table from 'verbal-editor/blocks/table';
import code  from 'verbal-editor/blocks/code';

new Editor({ blocks: [table, code] });   // you pay only for what you import
```

## 3.3 Data model

A flat map plus child-order arrays — not a nested tree. Flat gives O(1) block lookup,
ids stable across moves, transactions addressing a single block, and a payload that stays
cheap to diff and patch as documents grow.

```jsonc
{
  "version": 1,
  "root": "doc",
  "blocks": {
    "doc": { "type": "doc", "children": ["b_1", "b_2"] },

    "b_1": { "type": "heading", "props": { "level": 1 },
             "content": [{ "text": "Ship it", "marks": [] }] },

    "b_2": { "type": "paragraph", "children": ["b_3"],
             "content": [
               { "text": "See ", "marks": [] },
               { "text": "the docs", "marks": [{ "type": "link", "href": "/docs" }] }
             ] }
  }
}
```

`content` is an inline **run array** (Notion's shape) — marks live on runs rather than as
nested nodes, so there is no mark-tree to normalize. `children` handles all nesting, so
toggle lists, nested bullets, and column layout share one mechanism rather than three.

## 3.4 Transaction model

Every operation carries the data needed to reverse it. Undo requires this regardless, so
the collaboration-ready property is free.

```js
{ op: 'insertText',  block: 'b_1', at: 7, text: 'now' }
{ op: 'deleteText',  block: 'b_1', at: 7, len: 3, text: 'now' }   // text kept for invert
{ op: 'setProps',    block: 'b_3', props: { checked: true }, prev: { checked: false } }
{ op: 'addMark',     block: 'b_1', from: 0, to: 4, mark: { type: 'bold' } }
{ op: 'insertBlock', parent: 'doc', index: 2, block: { /* … */ } }
{ op: 'moveBlock',   block: 'b_3', from: ['doc', 2], to: ['b_2', 0] }

invert(tx)          // → undo.          required now
rebase(tx, other)   // → collaboration. additive later, no redesign
```

## 3.5 Rendering model — how zero re-renders works

"Zero re-renders" cannot mean zero renders; mounting is a render. The enforceable
definition, which becomes a CI gate rather than a claim:

- **0** React renders per keystroke — typing, deleting, selecting, formatting
- **exactly 1** render, for the affected block only, on a structural change
- **0** renders for every other block in the document

The store exposes two notification paths, and text edits use neither:

```js
// core/store.js
const versions = new Map();   // blockId → int
const subs     = new Map();   // blockId → Set<fn>

export const bump = (id) => {                        // structural / prop change only
  versions.set(id, (versions.get(id) ?? 0) + 1);
  subs.get(id)?.forEach((fn) => fn());
};
export const silent = () => {};                      // text edit: model updated, nobody told
```

```js
// react/index.js — a block subscribes to its own version and nothing else
export function useBlock(id) {
  const subscribe = useCallback((cb) => store.subscribe(id, cb), [id]);
  const version   = useSyncExternalStore(subscribe, () => store.version(id));
  return useMemo(() => store.get(id), [id, version]);
}
```

Typing never calls `bump`, so `version` never changes, so React is never told anything
happened — and the DOM is already correct because the browser wrote it.

## 3.6 Module contract

Core ships knowing exactly one block type: `paragraph`. Everything else — headings
included — arrives through this interface. This is what keeps core small while the
feature list is long, and it is the entire surface a contributor must learn.

```js
// blocks/heading/index.js
export default {
  type: 'heading',
  schema: { props: { level: [1, 2, 3] }, content: 'inline' },

  create: (props = {}) => ({ type: 'heading', props: { level: 1, ...props }, content: [] }),

  view: {
    create: (block) => document.createElement(`h${block.props.level}`),
    patch:  (el, block, prev) =>
      block.props.level !== prev.props.level ? null : el,   // null ⇒ recreate node
  },

  commands: {
    setLevel: (level) => (tx, blockId) => tx.setProps(blockId, { level }),
  },

  input: {
    markdown:  [[/^(#{1,3})\s$/, (m) => ({ type: 'heading', props: { level: m[1].length } })]],
    shortcuts: { 'Mod-Alt-1': 'setLevel(1)' },
  },

  slash:     { label: 'Heading 1', keywords: ['h1', 'title'], icon: 'H1' },
  parse:     { tags: ['h1', 'h2', 'h3'], markdown: /^(#{1,3})\s+(.*)$/ },
  serialize: { markdown: (b) => '#'.repeat(b.props.level) + ' ' + inline(b.content) },
};
```

A module folder is self-contained and is the unit of work, review, documentation, and
size budget:

```
blocks/heading/
  index.js  schema.js  parse.js  serialize.js  view.js
  heading.module.css  index.test.js
```

## 3.7 Key flows

**Keystroke (the hot path).** `beforeinput` fires → `insertText` → return immediately,
no `preventDefault` → browser inserts the character → `input` fires → `syncFromDom`
updates the model silently. **0 DOM writes, 0 renders.**

```js
// core/view.js
host.addEventListener('beforeinput', (e) => {
  switch (e.inputType) {
    case 'insertText':
    case 'deleteContentBackward':
      return;                                              // browser is right. do nothing.
    case 'insertParagraph':
      e.preventDefault();
      return editor.dispatch(splitBlock(e.getTargetRanges()[0]));
    case 'insertFromPaste':
      e.preventDefault();
      return editor.dispatch(parsePaste(e.dataTransfer));
    default:
      e.preventDefault();                                  // unknown inputType never mutates
  }
});
```

`InputEvent.getTargetRanges()` supplies the exact ranges about to be affected *before*
the mutation, which makes interception deterministic rather than inferred.

**Enter.** `insertParagraph` → prevented → `splitBlock` transaction → two `bump` calls →
1 render for the split block, 1 for the new one. Everything else untouched.

**Paste.** `insertFromPaste` → prevented → HTML/markdown parsed through each module's
`parse` rules → sanitized → one `insertBlock` transaction. Raw HTML is never injected.

**AI edit.** Model response → built as a valid but **uncommitted** transaction → word-level
Myers diff against current content → hunks painted with the Custom Highlight API over the
real text. The model is untouched until accept; accept dispatches through the normal path,
so an AI edit is undoable exactly like a typed one.

```js
// ai/pending.js
const pending = buildTx(aiResponse);                 // valid tx, not applied
const hunks   = diffWords(current, pending.preview());
accept(pending);   // → editor.dispatch(pending) → ordinary undo applies
reject(pending);   // → discard. model never knew.
```

**Drag.** Pointer Events track the block; a transform-based indicator shows the drop
position; release dispatches one `moveBlock` transaction.

## 3.8 Platform dependencies

The design deliberately depends on these, each replacing a library the field treats as
mandatory:

| Platform feature | Replaces | Availability |
|---|---|---|
| CSS Custom Highlight API | Prism / highlight.js / Shiki, and diff-rendering DOM | Chrome 105, Safari 17.2, Firefox 140 — full coverage |
| MathML Core | KaTeX (~75KB gz + fonts) | Chrome 109 (Igalia), Gecko and WebKit earlier |
| `beforeinput` + `getTargetRanges()` | An editor framework's input layer | All modern engines |
| `useSyncExternalStore` | Redux / Zustand / Jotai | React 18+ |
| Pointer Events | dnd-kit / react-dnd | All modern engines |
| Native `<dialog>`, `<details>`, CSS custom properties | UI primitive libraries | All modern engines |

## 3.9 Cross-cutting design

**Validation.** Joi at trust boundaries only — document import, paste ingest, plugin
config, the CLI config file, and the self-hosted server API. It is 56KB gzipped, five
times Oat UI's entire library, and never enters the client bundle. The editing path uses
the plain `schema` object each module already declares.

**Styling.** Oat UI's method, not only its size: semantic tags styled contextually, so
blocks render as `<h1>`, `<blockquote>`, `<ul>`, `<table>`, `<code>` with no class
attribute in the common case. `.module.css` colocated per module — scoped,
dead-CSS-detectable, tree-shaken with its module. One `tokens.css` of CSS custom
properties is the entire public theming API, with an automatic dark scheme.

**Testing strategy.** Two tools, for a technical reason. `node:test` covers `core/`: it is
pure JS with no DOM, so the full model/transaction/history/selection surface runs with no
environment and no dependency. Playwright covers view, blocks, and performance — **not
jsdom**, which implements neither `getTargetRanges()` nor a real Selection/Range model.
Testing a `contenteditable` editor there would test the mock on precisely the behavior
that matters.

```js
// test/perf/renders.spec.js — the gate that makes G-4 real
test('typing causes zero react renders', async ({ page }) => {
  await page.goto('/bench');
  await page.evaluate(() => (window.__renders = 0));
  await page.keyboard.type('the quick brown fox jumps over the lazy dog');
  expect(await page.evaluate(() => window.__renders)).toBe(0);
});
```

**Size enforcement.** A ~15-line script over `zlib.gzipSync` against a budget JSON —
`size-limit` is a dependency for something the standard library already does. It runs in
the pre-commit hook and in CI, and it fails the build rather than warning.

**Pre-commit.** Git's own `core.hooksPath` pointed at a committed `.githooks/` directory
— no Husky, no `node_modules` indirection. The hook runs lint-on-staged, `node --test
test/core`, and the size script. Playwright runs in CI only: a hook slow enough to be
bypassed is a hook that does nothing.

**Build and distribution.** Vite library mode, ESM only, one entry per module,
`package.json#exports` for subpaths, types generated from JSDoc, provenance-signed
publish.

## 3.10 Decision log

| # | Decision | Alternative rejected | Rationale |
|---|---|---|---|
| D-1 | Framework-free core, React as a thin binding | React throughout | Core is node-testable with no DOM; zero re-renders is structurally achievable; other bindings become additive |
| D-2 | Per-block `contenteditable` | One document-wide editable host | Non-text blocks need no cursor logic at all; a broken block cannot corrupt the document |
| D-3 | Pass through `insertText` untouched | Intercept and re-render every keystroke | The browser is already correct; this *is* the zero-re-render mechanism |
| D-4 | Flat block map | Nested tree | O(1) lookup, stable ids across moves, single-block transactions, cheap diffs at scale |
| D-5 | Joi at boundaries only | Joi everywhere | 56KB gz is 5× Oat UI's entire library; it would be the bundle floor before any feature |
| D-6 | Single package, subpath exports | Monorepo, package per module | Same tree-shaking, one version and changelog, no workspace tooling |
| D-7 | Collab-ready transactions, collab unbuilt | Snapshot undo / build CRDT now | Invertible ops are required for undo anyway; retrofitting them later is a rewrite |
| D-8 | CSS Custom Highlight API | Token `<span>`s | Zero DOM nodes in the editable region removes the whole cursor-corruption class |
| D-9 | LaTeX → MathML | KaTeX / MathJax | ~5KB compiler vs ~75KB gz renderer plus fonts, for native rendering |
| D-10 | Pointer Events for drag | HTML5 drag-and-drop | Native DnD gives uncontrollable ghost images and no fine-grained drop targeting |
| D-11 | Playwright, not jsdom, for DOM tests | jsdom + RTL | jsdom lacks `getTargetRanges()` and real Selection — it would test the mock |
| D-12 | DOM surgery for marks | `document.execCommand` | `execCommand` produces non-deterministic markup across browsers |
| D-13 | AI output as uncommitted transaction | Apply then diff against history | The model is never polluted; reject is byte-identical; accept reuses the normal undo path |

---

*Sources:* [Oat UI](https://oat.ink/) · [MDN: CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API) · [MDN: beforeinput](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event) · [WebKit: Enhanced Editing with Input Events](https://webkit.org/blog/7358/enhanced-editing-with-input-events/) · [MathML in Web Browsers (Igalia)](https://mathml.igalia.com/) · [React: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) · [WordPress Block Editor Architecture](https://developer.wordpress.org/block-editor/explanations/architecture/) · [Editor.js](https://editorjs.io/)
