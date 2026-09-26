/**
 * Heading 1–3 (F-11) — `level` prop; the element is recreated only when the level changes.
 * `# ` / `## ` / `### ` input rules, ⌘⌥1–3. Markdown: `#` prefix · HTML: `<h1>`–`<h3>` (h4–h6 paste as h3).
 */
import s from './heading.module.css';

const levels = [1, 2, 3];

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'heading',
  className: s.heading,
  schema: { props: { level: levels }, content: 'inline' },
  create: (props) => ({ type: 'heading', props: { level: 1, ...props }, content: [] }),
  view: {
    create(b) {
      const el = document.createElement(`h${b.props.level}`);
      el.dataset.placeholder = `Heading ${b.props.level}`;
      return el;
    },
    patch: (el, b, prev) => (b.props.level === prev.props.level ? el : null),
  },
  input: {
    markdown: [[/^(#{1,3})\s$/, (m) => ({ type: 'heading', props: { level: m[1].length } })]],
    shortcuts: Object.fromEntries(levels.map((level) => [`Mod-Alt-${level}`, (ed) => ed.setType('heading', { level })])),
  },
  slash: levels.map((level) => ({ label: `Heading ${level}`, keywords: [`h${level}`, 'title', 'heading'], icon: `H${level}`, props: { level } })),
  parse: {
    tags: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
    html: (el) => ({ level: Math.min(3, +el.tagName[1]) }),
    markdown: [/^(#{1,6})\s+(.*)$/, (m) => ({ props: { level: Math.min(3, m[1].length) }, text: m[2] })],
  },
  serialize: {
    markdown: (b, md) => `${'#'.repeat(b.props.level)} ${md.inline(b.content)}`,
    html: (b, inner, kids) => `<h${b.props.level}>${inner}</h${b.props.level}>${kids}`,
  },
};
