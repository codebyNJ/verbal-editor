# Verbal Editor — PRD


## 1. Problem

Rich-text editing on the web is solved badly at both ends. Hosted editors (Notion,
Coda) are closed and un-embeddable. Open editor frameworks are heavy and force their
architecture on the host app:

| Editor | Realistic bundle (gzipped) |
|---|---|
| Lexical core | ~22KB (~40–60KB with a normal document setup) |
| Tiptap + basic extensions | ~50–70KB (~80–120KB feature-complete) |
| Plate / Slate | ~120–180KB |
| **Oat UI — the reference bar** | **7KB CSS + 2.9KB JS, zero dependencies** |

Teams adopting one inherit a dependency tree, a plugin API they did not choose, and a
bundle that grows whether or not they use the features. Teams building their own hit
`contenteditable` and stop.

## 2. Goals

| ID | Goal |
|---|---|
| G-1 | A block editor with Notion-level editing fidelity at a fraction of the weight |
| G-2 | Zero third-party runtime dependencies — everything built in-house |
| G-3 | Every text format is an independently importable module; consumers pay only for what they import |
| G-4 | Zero React re-renders during editing, enforced as a build gate rather than claimed |
| G-5 | A Notion-style JSON payload that is portable, diffable, and stable at document scale |
| G-6 | AI edits presented as a reviewable diff, never a silent replacement |
| G-7 | Self-hostable, config-driven, documented to the standard of a top-tier OSS project |

## 3. Non-goals

| ID | Non-goal | Rationale |
|---|---|---|
| NG-1 | Real-time collaborative editing | Transactions are designed to *permit* it (serializable, invertible, rebaseable); no CRDT or sync server is built |
| NG-2 | A general-purpose charting library | Four chart types driven by table data. Not a d3 competitor |
| NG-3 | Complete LaTeX coverage | A documented math subset. Full TeX is why KaTeX weighs 75KB |
| NG-4 | File storage / asset hosting | The host application's concern; the editor exposes upload hooks |
| NG-5 | A CMS, a database, or a page-tree | An editor component, not a product clone |
| NG-6 | Legacy browser support | Modern evergreen browsers only — the design depends on platform features listed in HLD §8 |

## 4. Users

| Persona | Need | Implication |
|---|---|---|
| **Product engineer embedding an editor** | Drop-in component, small bundle, does not dictate app architecture | Framework-free core, thin React binding, subpath imports |
| **OSS contributor** | Add a block type without understanding the whole system | A single documented module contract is the entire contribution surface |
| **Self-hosting team** | Run it on their own infrastructure, validate their own content | Config file, CLI, server-side schema validation |
| **End user (writer)** | It behaves like Notion and does not lose the cursor | Per-block contenteditable, native input handling, no jank |

## 5. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Core bundle (core + React binding + paragraph) | ≤ 12.5KB gz | Size gate in CI |
| Full default preset | ≤ 31.5KB gz | Size gate in CI |
| Total CSS | ≤ 8KB gz | Size gate in CI |
| React renders per keystroke | **0** | Instrumented browser test |
| React renders per structural edit | **1** (affected block only) | Instrumented browser test |
| Input latency p95 | < 16ms (one frame) | Browser performance trace |
| Runtime dependencies | **0** | `package.json` assertion in CI |
| Document round-trip fidelity | 100% | `parse(serialize(doc)) === doc` across all block types |

## 6. Scope

**In scope.** Markdown input rules · bold · italic · strike · inline code · headings 1–3 ·
code blocks with language recognition · bullet lists · numbered lists · to-do · quotes ·
dividers · tables · charts · LaTeX/equations · emoji · hyperlink and external embeds ·
multi-section (column) layout · slash commands · draggable blocks · nesting · undo/redo ·
AI diff review · config file · CLI · self-hosted build · docs.

**Out of scope.** See §3.

## 7. Constraints

| ID | Constraint |
|---|---|
| C-1 | JavaScript. No TypeScript-as-a-requirement; types published as JSDoc-generated `.d.ts` |
| C-2 | Joi is the only validation library, and never ships in the client bundle |
| C-3 | CSS Modules for all component styling; Tailwind limited to app-shell/demo surfaces |
| C-4 | Zero runtime dependencies. Dev dependencies are permitted and are not part of the claim |
| C-5 | Every behavioral question resolved against current React and MDN/spec documentation, not recalled defaults |

## 8. Product risks

| Risk | Impact | Mitigation |
|---|---|---|
| LaTeX subset frustrates power users | Medium | Documented command list; explicit "unsupported command" error, never silent mis-rendering |
| Regex tokenizers mis-highlight edge cases | Low | Ceiling documented per language; upgrade path to a real lexer per language on demand |
| Table + contenteditable is the hardest module | Medium | Isolated module boundary; its complexity cannot leak into core |
| "Zero dependencies" read as excluding dev tooling | Low | Stated explicitly in README and PRD |
| Bundle budgets drift as features land | High | Budgets are CI gates, not guidance — the build fails |

