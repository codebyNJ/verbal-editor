/**
 * List item (F-20) — bullets and numbers are one module: `ordered` switches a CSS counter, so numbering
 * stays right after any reorder. `- ` / `* ` and `1. ` input rules; Tab / Shift-Tab nest.
 * Markdown: `-` / `1.` · HTML: `<li>` inside `<ul>` or `<ol>`.
 */
import s from './list.module.css';

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'list',
  className: s.list,
  schema: { props: { ordered: Boolean }, content: 'inline' },
  create: (props) => ({ type: 'list', props: { ordered: false, ...props }, content: [] }),
  next: (b) => ({ type: 'list', props: b.props }),
  view: { create: () => document.createElement('div'), host: (b) => ({ 'data-ordered': b.props.ordered }) },
  input: {
    markdown: [
      [/^[-*+]\s$/, () => ({ type: 'list', props: { ordered: false } })],
      [/^1[.)]\s$/, () => ({ type: 'list', props: { ordered: true } })],
    ],
  },
  slash: [
    { label: 'Bulleted list', keywords: ['ul', 'bullet', 'unordered'], icon: '•' },
    { label: 'Numbered list', keywords: ['ol', 'ordered', 'number'], icon: '1.', props: { ordered: true } },
  ],
  parse: {
    tags: ['LI'],
    html: (el) => ({ ordered: el.parentElement?.tagName === 'OL' }),
    markdown: [/^([-*+]|\d+[.)])\s+(.*)$/, (m) => ({ props: { ordered: /\d/.test(m[1]) }, text: m[2] })],
  },
  serialize: {
    markdown: (b, md) => `${b.props.ordered ? '1.' : '-'} ${md.inline(b.content)}`,
    html: (b, inner, kids) => (b.props.ordered ? `<ol><li>${inner}${kids}</li></ol>` : `<ul><li>${inner}${kids}</li></ul>`),
  },
};
