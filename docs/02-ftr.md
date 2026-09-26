# Verbal Editor — FTR


Each feature carries an ID, the technical approach, acceptance criteria, and a size
budget. Priorities: **P0** required for a usable editor · **P1** required for feature
parity with the brief · **P2** valuable, not blocking.

## 2.1 Foundation

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-01 | Document model | P0 | Flat `{ id → block }` map + `children` order arrays. O(1) lookup, stable ids across moves | Model ops unit-tested with no DOM; ids survive move/undo | — |
| F-02 | Transactions | P0 | Serializable ops carrying inverse data. `apply`, `invert`; `rebase` signature reserved | Every op has an apply test, an invert test, and an invalid-input rejection test | — |
| F-03 | History | P0 | Undo/redo stack built on `invert`. Coalesces consecutive text ops | Undo restores model *and* selection exactly | — |
| F-04 | Selection | P0 | Bidirectional map between model coordinates and DOM `Range` | Round-trips across every block type including nested and void blocks | — |
| F-05 | Input routing | P0 | `beforeinput` router. `insertText`/`deleteContentBackward` pass through untouched; all other `inputType`s handled explicitly or prevented | Unknown `inputType` can never mutate the document | — |
| F-06 | Block registry | P0 | Modules self-register block types, marks, slash entries, shortcuts, parse and serialize rules | Core with zero registered modules still edits paragraphs | — |
| F-07 | React binding | P0 | `useSyncExternalStore`, one subscription per block id, versioned store | Typing produces 0 renders; structural edit produces exactly 1 | ≤ 12.5KB with F-01…F-06 |

## 2.2 Text formatting

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-10 | Bold / Italic / Strike / Inline code | P0 | Surgical DOM surgery — split text node, wrap, restore `Range`. **`execCommand` prohibited**: its cross-browser markup output is non-deterministic | Identical resulting DOM in Chromium, Firefox, WebKit | ≤ 1KB each |
| F-11 | Headings 1–3 | P0 | `level` prop; node recreated only on level change | `# ` input rule; `Mod-Alt-{1,2,3}`; round-trips to markdown | ≤ 1KB |
| F-12 | Quote | P0 | `<blockquote>`; `> ` input rule | Nests other blocks as children | ≤ 0.5KB |
| F-13 | Divider | P1 | Void block, `---` input rule | Non-editable; arrow keys traverse past it correctly | ≤ 0.3KB |
| F-14 | Markdown input rules | P0 | Regex table in core, extended per module | Rules fire on trigger character and are undoable as one step | — |
| F-15 | Link | P0 | Mark carrying `href`; paste-over-selection creates a link | URL validated before commit; `rel="noopener noreferrer"` enforced | ≤ 1KB |

## 2.3 Structure

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-20 | Bullet + numbered lists | P0 | **One module**, `ordered` prop — the two differ by a CSS property and a counter | Tab/Shift-Tab indent; numbering correct after any reorder | ≤ 1.5KB |
| F-21 | To-do | P0 | `checked` prop; checkbox is not part of the editable region | Toggling checkbox never moves the caret | ≤ 0.8KB |
| F-22 | Nesting | P0 | `children` arrays; indent/outdent are `moveBlock` transactions | Undo of an indent restores exact prior position | — |
| F-23 | Multi-section (columns) | P1 | Container block holding column children; CSS Grid | Blocks drag between columns; collapses to single column on narrow viewports | ≤ 1.5KB |

## 2.4 Rich blocks

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-30 | Code block | P0 | **CSS Custom Highlight API** — token colors painted over `Range`s with zero DOM nodes inserted into the editable region | Caret and selection behave identically to plain text at any position | ≤ 3KB core |
| F-31 | Language tokenizers | P0 | ~40-line regex tokenizer per language, lazily loaded on demand | Never bundled with core; a language loads on first use | ≤ 0.5KB each |
| F-32 | Language recognition | P1 | Heuristic scoring over signature regexes | Correct on the top-10 languages for a ≥3-line sample; falls back to plaintext, never to a wrong guess | ≤ 0.5KB |
| F-33 | Table | P1 | Grid of per-cell editable blocks; pointer-event column resize | Arrow/Tab navigation between cells; row/column insert and delete are single undo steps. **No merged cells in v1** | ≤ 4KB |
| F-34 | LaTeX / equations | P1 | LaTeX subset **compiled to MathML**; the browser renders it natively. No JS renderer, no font payload | ~150 documented commands; inline and block modes; unsupported commands raise a visible explicit error | ≤ 5KB |
| F-35 | Charts | P2 | Hand-written SVG. Line, bar, area, pie. Data sourced from a `table` block | Renders from a table reference; re-renders on source table change; theme-aware via CSS custom properties | ≤ 3KB |
| F-36 | Embeds | P1 | oEmbed/OpenGraph fetch; sandboxed `<iframe>` for allow-listed providers, link card otherwise | Unknown providers never produce an unsandboxed frame | ≤ 2KB |
| F-37 | Image | P1 | `<img>` with paste and drop handling; upload delegated to a host-provided hook | Works with no upload hook configured (data URL fallback) | ≤ 1KB |

## 2.5 Interaction

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-40 | Slash commands | P0 | Menu built from `registry.slash` — modules contribute entries; no central list exists to maintain | Registering a module makes it appear with zero edits elsewhere; keyboard-navigable; filters on label and keywords | ≤ 2KB |
| F-41 | Drag & drop blocks | P0 | **Pointer Events**, not HTML5 drag-and-drop — the native API gives uncontrollable ghost images and no fine-grained drop targeting | Drop indicator tracks position; drop is one undoable `moveBlock`; works on touch | ≤ 2.0KB |
| F-42 | Selection toolbar | P1 | Appears on text selection; renders `registry.marks` | Positions within viewport bounds; dismisses on selection collapse | ≤ 1.5KB |
| F-43 | Emoji | P1 | `:` trigger. Emoji data exceeds 1MB — the short-name index is fetched as a static chunk and is **never bundled** | Core bundle unchanged with emoji enabled; index loads on first `:` | ≤ 0.5KB + async data |
| F-44 | Keyboard shortcuts | P0 | Registry-driven, per-module declaration | No conflicts across modules; conflicts detected at registration time | — |
| F-45 | Copy / paste | P0 | HTML, markdown, and plaintext handled. Paste is parsed to blocks, never injected as raw HTML | Pasted content is sanitized; unknown elements degrade to paragraphs, never dropped silently | — |

## 2.6 AI

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-50 | Pending transaction | P0 | AI output becomes a valid but **uncommitted** transaction. The document model is untouched until accept | Rejecting leaves the model byte-identical to before | ≤ 1KB |
| F-51 | Diff rendering | P0 | Word-level Myers diff, rendered via the Custom Highlight API over the real text | Insertions and deletions visually distinct; original text remains readable and selectable | ≤ 2KB |
| F-52 | Accept / reject | P0 | Accept dispatches the pending transaction through the normal path | An accepted AI edit is undoable exactly like a typed one, with no special case | — |
| F-53 | Hunk-level control | P2 | Accept or reject individual diff hunks | Partial acceptance produces a valid document | ≤ 1KB |

## 2.7 Platform

| ID | Feature | Pri | Technical requirement | Acceptance | Budget |
|---|---|---|---|---|---|
| F-60 | Config file | P0 | `verbal.config.js` with `defineConfig`. Joi-validated at build time only | Invalid config fails the build with a precise path and message | 0 (build-time) |
| F-61 | CLI | P1 | `verbal init` (interactive scaffold), `verbal doctor` (validate config, report per-module bundle impact) | `init` produces a working config; `doctor` surfaces the size cost of each enabled module | 0 (not shipped to browser) |
| F-62 | Self-hosted build | P1 | Server validates documents with Joi on ingest | Malformed documents rejected at the API boundary, never persisted | — |
| F-63 | Theming | P0 | CSS custom properties, one `tokens.css`. Automatic dark scheme | Full re-theme with no build step and no JS | included in CSS budget |
| F-64 | Docs | P0 | Generated from the JSDoc each module carries; live editable example per module | A module's documentation cannot drift from its contract | — |

