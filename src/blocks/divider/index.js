/** Divider (F-13) — a void `<hr>`, never editable; `---` input rule. Arrow keys skip over it. Markdown: `---`. */
import s from './divider.module.css';

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'divider',
  className: s.divider,
  schema: { content: 'none' },
  create: () => ({ type: 'divider' }),
  view: { create: () => document.createElement('hr') },
  input: { markdown: [[/^---$/, () => ({ type: 'divider' })]] },
  slash: { label: 'Divider', keywords: ['hr', 'line', 'rule'], icon: '—' },
  parse: { tags: ['HR'], markdown: [/^([-*_])\1{2,}\s*$/, () => ({})] },
  serialize: { markdown: () => '---' },
};
