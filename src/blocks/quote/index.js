/** Quote (F-12) — `<blockquote>`; `> ` input rule. Nested blocks sit inside its border. Markdown: `>`. */
import s from './quote.module.css';

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'quote',
  className: s.quote,
  schema: { content: 'inline' },
  create: () => ({ type: 'quote', content: [] }),
  view: { create: () => document.createElement('blockquote') },
  input: { markdown: [[/^[>"]\s$/, () => ({ type: 'quote' })]] },
  slash: { label: 'Quote', keywords: ['blockquote', 'citation'], icon: '❝' },
  parse: { tags: ['BLOCKQUOTE'], markdown: [/^>\s?(.*)$/, (m) => ({ text: m[1] })] },
  serialize: { markdown: (b, md) => `> ${md.inline(b.content)}` },
};
