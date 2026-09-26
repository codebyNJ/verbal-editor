/** Italic (F-10) — `<em>`, ⌘I, `*text*` or `_text_`. */
/** @type {import('../core/registry.js').MarkModule} */
export default {
  type: 'italic',
  tags: ['EM', 'I'],
  match: (el) => /^(EM|I)$/.test(el.tagName) || el.style.fontStyle === 'italic',
  shortcut: 'Mod-i',
  markdown: /(?<![*_\w])([*_])([^*_\n]+)\1$/,
  md: ['_', '*'],
  toolbar: { label: 'i', title: 'Italic ⌘I' },
};
