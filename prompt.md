# Build Verbal Editor

Build Verbal Editor as ONE lightweight npm package (`@verbal/editor`) plus a React demo app that renders every module as soon as it exists. Work autonomously, one step at a time.

## Source of truth
Read `docs/01-prd.md`, `docs/02-ftr.md`, `docs/03-hld.md` fully first. Feature IDs (F-xx), decisions (D-x) and budgets come from there — never restate them into new files. Before relying on any browser or React API, check its current MDN / react.dev page.

## Non-negotiables
- `core/` never imports React; only `core/view.js` touches the DOM; `react/` never mutates the model.
- Per-block contenteditable. React renders block hosts and child lists only; everything inside a block's content element belongs to `core/view.js`.
- `beforeinput`: `insertText` / `deleteContentBackward` pass through untouched; every other type is handled or prevented. Typing, selecting and formatting cost 0 React renders.
- Every op carries inverse data (`apply`, `invert`; `rebase` signature only). Undo restores model and selection.
- Core knows only `paragraph`. Everything else is a module object (HLD §3.6) passed to `new Editor({ blocks, marks, ui })` — no import side effects, so tree-shaking is real.
- `ui/` is framework-free DOM: works under any binding, never triggers a React render.
- Marks by DOM surgery, never `execCommand`. Drag by Pointer Events, never HTML5 DnD. No jsdom.
- Code colours and AI diffs via the CSS Custom Highlight API: zero nodes added inside editable regions.
- LaTeX subset compiles to MathML; unsupported commands show a visible error.
- AI output is an uncommitted transaction: reject leaves the doc byte-identical, accept undoes like typing.
- Paste is parsed to blocks, never injected as HTML. Links validated, `rel="noopener noreferrer"`. Unknown embeds never get an unsandboxed frame.

## Targets (the build fails if missed)
- `dependencies` empty. React = optional peer. Joi = optional peer, imported only by `cli/`, `src/config/`, `src/server/` — never reachable from a browser entry.
- core + react + paragraph ≤ 12KB gz · `preset` ≤ 30KB gz · all CSS ≤ 8KB gz · each module ≤ its FTR budget.
- 0 renders per keystroke · exactly 1 (affected block only) per structural edit.
- `parse(serialize(doc))` deep-equals `doc` for every block type.
- devDependencies only: vite, @vitejs/plugin-react, react, react-dom, joi, @playwright/test, typescript (.d.ts from JSDoc only).
- Never weaken a test, edit a check or raise a budget to get green.

## Keep it light
Browser API before code, code before dependency. No abstraction with one implementation, no "for later" scaffolding. A module is `index.js` (+ `.module.css` if it has visuals); split only when a file gets hard to read. Comments: one line saying *what*, never *how*; JSDoc for types with one-line descriptions; no URLs, TODOs or dead code.

## Structure — create exactly this, nothing more
```
package.json            ESM · "exports" per subpath · "files": dist, cli · "sideEffects": ["**/*.css"] · bin verbal
vite.config.js          demo dev server (alias @verbal/editor → src/, switchable to dist/) + lib build, one entry per module
playwright.config.js    chromium · firefox · webkit · webServer = vite
.github/workflows/ci.yml
README.md               the only .md you write, last
src/
  index.js              Editor + public API, includes paragraph
  preset.js             every module — the 30KB measurement
  tokens.css            the whole theming API: custom properties, automatic dark
  core/                 model.js tx.js history.js selection.js store.js registry.js view.js clipboard.js
  react/index.js        useEditor · <Blocks> · useBlock (useSyncExternalStore)
  blocks/
    paragraph/ heading/ list/ todo/ quote/ divider/ columns/ table/ chart/ embed/ image/
    code/               index.js · detect.js · lang/<name>.js (top 10, lazy import())
    math/               index.js · latex.js
  marks/                bold.js italic.js strike.js code.js link.js
  ui/                   slash/ toolbar/ dnd/ emoji/ (emoji/data.json fetched on first ":", never imported)
  ai/                   diff.js (word-level Myers) · pending.js (uncommitted tx, preview, accept/reject, hunks)
  config/               defineConfig.js · schema.js (Joi)
  server/index.js       validateDoc() for @verbal/editor/server (Joi)
cli/index.js            verbal init · verbal doctor (validates verbal.config.js, per-module gzip cost)
scripts/check.js        gzip budgets · empty dependencies · no React in core · DOM only in view.js · no execCommand/draggable · no Joi in client builds
test/unit/*.test.js     node:test: model, tx, history, clipboard, round-trip, latex, diff, detect
test/e2e/<step>.spec.js Playwright, one per build step; the render gate lives in the core spec
demo/                   index.html · main.jsx · App.jsx · App.module.css · pages.js (HLD §3.3 docs + canned AI rewrites)
```
No `.claude/`, CLAUDE.md, AGENTS.md, task/log/flow files, changelogs, CONTRIBUTING, lint configs, git hooks or extra markdown.

## Process
- No git at all: no init, commit, branch, push, tag or publish.
- Track work with your built-in task tool: one task per build step, one in progress, done only after its loop passes. Note measured size + render counts when closing.
- Browser: the Chromium MCP with an isolated profile, against the local dev server only.

**Loop per step:**
1. Build in `src/` against the FTR acceptance criteria; pure logic gets a `test/unit` test.
2. Render it in the demo: add it to the preset and show it on a sample page.
3. In Chromium via MCP, use it like a person — mouse, keyboard only, fast typing, paste, undo/redo many times, empty and huge content — screenshot and look, then check: render counter (0 typing / 1 structural) · console clean · network same-origin, lazy chunks only on first use · `CSS.highlights` has ranges and no `<span>` in code/diff regions · `editor.getDoc()` is exactly what you expect.
4. Codify those checks into `test/e2e/<step>.spec.js`. Run `node --test test/unit`, `node scripts/check.js` and every e2e spec (regression).
5. Fix until green, then the next step. Never build on a red baseline.

Stop and ask only if a target can't be met honestly, the spec contradicts itself, or a runtime dependency seems unavoidable — give the measured number and the options.

## Build order (each step only needs earlier steps)
1. Scaffold: package, configs, check script, `tokens.css`, demo shell on a static page (F-63). Prove from `dist/` that importing one module brings its JS + CSS and nothing else — Vite lib mode extracts CSS and drops the import by default.
2. Core + React binding + paragraph (F-01…F-07, F-44). Demo render counter: `window.__renders` plus which ids rendered, fed by a one-line optional hook in the binding. Prove 0 per keystroke before anything else.
3. Marks + selection toolbar (F-10, F-42).
4. Headings, divider, markdown input rules (F-11, F-13, F-14).
5. Lists, to-do, nesting, quote (F-20…F-22, F-12).
6. Clipboard, then link (F-45, F-15).
7. Slash menu, drag & drop (F-40, F-41).
8. Code block, tokenizers, language detection (F-30…F-32).
9. AI diff review with hunks (F-50…F-53).
10. Table, then chart (F-33, F-35). Cell typing is silent, so the chart redraws from a non-React model listener — still 0 React renders.
11. Math (F-34).
12. Columns, after dnd (F-23).
13. Image, embed, emoji (F-37, F-36, F-43).
14. Config, CLI, server validation (F-60…F-62).
15. Docs (F-64): demo "Modules" pages generated at runtime from each module object + its JSDoc (`?raw`), with a live example and measured size — they can't drift, and there is no separate site.
16. CI + README, then a final full pass with the demo on built `dist/`: desktop and 390px, light and dark.

## Demo — Notion layout, Apple polish
- Shell: collapsible frosted sidebar (search, recent, sample pages, Modules), top bar (breadcrumb, ⌘K palette, theme toggle, render counter), page with cover, emoji icon, title.
- Look: system font stack, neutral greys, one accent, soft layered shadows, generous spacing; every value from `tokens.css`.
- Motion, CSS only: transform/opacity, 150–300ms, spring `linear()` easing; menus scale from their origin; blocks FLIP on reorder; to-do tick draws; page switch via View Transitions; honour `prefers-reduced-motion`. No animation library.

## CI — one workflow
Push/PR: `npm ci` → `node --test test/unit` → `npm run build` → `node scripts/check.js` → Playwright in chromium, firefox, webkit (F-10 requires identical DOM across engines). On a `v*` tag pushed by a human: `npm publish --provenance`. Nothing else.

## Done
Every FTR acceptance criterion met, all targets green, every module working in the demo. Final chat report: gzip size per entry vs budget, render counts, anything cut and why.