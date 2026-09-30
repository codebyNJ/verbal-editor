# Verbal Editor

[Website](https://verbal-editor.nijeeshnj.tech) · [Docs](https://verbal-editor.nijeeshnj.tech/#/docs/introduction) · [Try it on StackBlitz](https://stackblitz.com/github/codebyNJ/verbal-editor/tree/main/examples/react?file=src/App.jsx) · [npm](https://www.npmjs.com/package/verbal-editor)

A Notion-style block editor with zero runtime dependencies. Every block is its own
`contenteditable`; the browser handles typing, and React only mounts block hosts, so typing,
selecting and formatting cost zero React renders.

Requirements, decisions and size budgets live in [`docs/`](docs): the PRD, the feature table (FTR)
and the high-level design (HLD). `node scripts/check.js` enforces those budgets; CI runs it after every build.

## Install

```sh
npm i verbal-editor react react-dom
```

Runnable starters: [`examples/react`](examples/react) (Vite) and [`examples/next`](examples/next) (Next.js, rendered in the browser only). Open either on StackBlitz: [React](https://stackblitz.com/github/codebyNJ/verbal-editor/tree/main/examples/react?file=src/App.jsx) · [Next.js](https://stackblitz.com/github/codebyNJ/verbal-editor/tree/main/examples/next?file=app/Editor.jsx).

React is an optional peer, needed only by the `<Blocks>` binding; `verbal-editor/dom` renders the
same editor with no framework (`mount(editor, element)`). Joi is an optional peer too, needed only
by the config file, the CLI and server-side validation — never by the browser.

## Use

```jsx
import 'verbal-editor/tokens.css';
import preset from 'verbal-editor/preset';
import { Blocks, useEditor } from 'verbal-editor/react';

export function Page({ doc }) {
  const editor = useEditor({ ...preset, doc });
  return <Blocks editor={editor} />;
}
```

`preset` registers every module. To pay only for what you use, import modules one by one. Each
brings its own CSS, and nothing registers itself on import:

```js
import { Editor } from 'verbal-editor';
import heading from 'verbal-editor/blocks/heading';
import table from 'verbal-editor/blocks/table';
import bold from 'verbal-editor/marks/bold';
import slash from 'verbal-editor/ui/slash';

const editor = new Editor({ blocks: [heading, table], marks: [bold], ui: [slash] });
```

Core ships exactly one block type, `paragraph`. Everything else is a module object:

| Kind | Modules |
|---|---|
| `blocks/*` | `heading` `list` `todo` `quote` `divider` `code` `table` `chart` `math` `columns` `image` `embed` |
| `marks/*` | `bold` `italic` `strike` `code` `link` |
| `ui/*` | `slash` `toolbar` `dnd` `emoji` |
| `ai/*` | `diff` `pending` |

Every module has a reference page in the docs (`#/docs/modules/<kind>/<name>` on the site),
generated from the module itself: its JSDoc, the contract read off the module object, the measured
gzip size of its build and the acceptance criteria it cites, with a link to a live example.

## The document

A document is a flat map of blocks plus `children` order arrays:

```js
{ version: 1, root: 'doc', blocks: {
  doc: { type: 'doc', children: ['a'] },
  a: { type: 'heading', props: { level: 2 }, content: [{ text: 'Hi', marks: [{ type: 'bold' }] }] },
} }
```

- `editor.getDoc()` / `editor.setDoc(doc)` read and replace it; `parse` and `serialize` convert
  JSON text.
- Every change is a transaction of invertible ops:
  `editor.dispatch(editor.tx().insertText(id, 0, 'x'))`. Undo and redo restore the model and the
  selection.
- `editor.on('change', ({ ops }) => …)` tells you when it changed.
- Copy and paste go through the modules' own parse and serialize rules, as HTML, Markdown or plain
  text. Pasted HTML is parsed into blocks, never injected.

`editable: false` renders a document read-only: text stays selectable and copyable, every
transaction is ignored and modules hide their controls.

Editor options beyond `blocks`, `marks`, `ui`, `doc` and `editable` are passed through to modules:
`upload(file) → Promise<url>` for images (without it they become data URLs),
`unfurl(url) → Promise<{ title }>` for link cards, and `onRender(id)` to count React renders.

## AI edits

```js
import { review } from 'verbal-editor/ai/pending';

const { done } = review(editor, { [blockId]: 'The proposed text' });
```

The proposal is an uncommitted transaction. It is shown as a word diff painted with the CSS Custom
Highlight API, with nothing added inside the editable text. Reject leaves the document
byte-identical. Accept (all at once or hunk by hunk) is one ordinary undo step.

## Theming

`tokens.css` is the whole theming API: `--v-*` custom properties with an automatic dark scheme.
Force a scheme with `data-theme="light"` or `"dark"` on `<html>`, or override any token. No build
step is involved.

## Config, CLI and server

```sh
npx verbal init      # asks which modules to enable, writes verbal.config.js
npx verbal doctor    # validates it and reports each module's gzip cost against its budget
```

`verbal.config.js` uses `defineConfig` from `verbal-editor/config`. An invalid config throws
with the exact path, for example `"blocks[1]" must be one of [...]`, so a build that loads it
fails. It is build-time only: never import it from browser code.

On a server, reject malformed documents before storing them:

```js
import { validateDoc } from 'verbal-editor/server';

const { error } = validateDoc(req.body, config);
if (error) return res.status(422).json(error.details);
```

## Docs, and notes for agents

The site (`demo/`) has two parts: a Notion-style landing where every page is a live, editable
Verbal document, and read-only docs. Site content is Markdown under `demo/content/`; reference
tables and figures are generated from the package and `bench/results.json` by `scripts/content.js`.
The build publishes every docs page as `docs/<slug>.md`, plus `llms.txt` and `llms-full.txt`.
[`AGENTS.md`](AGENTS.md) — shipped in the npm package — has the rules for coding agents.

## Develop

```sh
npm run dev        # the site against src/
npm run dev:dist   # the site against the built dist/
npm test           # node:test unit tests (core has no DOM)
npm run build      # library, Node entries and .d.ts from JSDoc
npm run check      # size budgets and architecture rules, on dist/
npm run site       # the static site (landing + docs), into site-dist/
npm run e2e        # Playwright: Chromium, Firefox, WebKit and two touch phones, against the site
cd bench && npm ci && npm run bench   # re-measure the editors (after npm run build)
```
