# Verbal Editor — Specification

Planning documents for a zero-dependency, Notion-style block WYSIWYG editor.
Status: **draft for review**, 20 Sep 2026. No implementation sequencing yet — deliberate.

| File | Document | Contents |
|---|---|---|
| [`01-prd.md`](01-prd.md) | PRD | Problem, goals, non-goals, users, success metrics, scope, constraints, risks |
| [`02-ftr.md`](02-ftr.md) | FTR | 40 numbered features: technical requirement, acceptance criteria, priority, gzip budget |
| [`03-hld.md`](03-hld.md) | HLD | Design thesis, architecture, data + transaction models, key flows, decision log |
| [`spec.html`](spec.html) | — | All three as one self-contained page (also published at the link below) |

Published, private: https://claude.ai/code/artifact/db19d1e6-6846-4804-8d99-ea6e3e764046

## The short version

Notion-grade editing at Oat UI's weight class — 12.5KB core, 31.5KB full preset, zero
runtime dependencies, zero React re-renders while typing.

Three platform findings carry the weight budget:

- **`beforeinput` pass-through** — on `insertText`, do nothing. The browser's insertion is
  already correct; read it back and update the model silently. The fast path is an empty
  function, which is why 0 re-renders per keystroke is enforceable rather than aspirational.
- **CSS Custom Highlight API** — syntax colours and AI diffs painted over `Range`s with zero
  DOM nodes inside the editable region. Replaces Prism/Shiki *and* the diff-view DOM.
- **MathML Core** — natively rendered everywhere now, so maths is a ~5KB compiler instead of
  KaTeX's ~75KB gz plus fonts.

See HLD §3.10 for the full decision log, including what was rejected and why.
