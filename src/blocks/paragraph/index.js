/**
 * Paragraph (F-06) — the one block type core ships with; every other type is a module.
 * Markdown: plain text · HTML: `<p>`.
 */
import s from './paragraph.module.css';

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'paragraph',
  className: s.paragraph,
  schema: { content: 'inline' },
  placeholder: "Type '/' for commands",
  create: () => ({ type: 'paragraph', content: [] }),
  view: { create: () => document.createElement('p') },
  slash: { label: 'Text', keywords: ['paragraph', 'plain'], icon: 'Aa' },
  parse: { tags: ['P'] },
  serialize: { markdown: (b, md) => md.inline(b.content) },
};
