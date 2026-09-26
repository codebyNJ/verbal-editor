/** Strikethrough (F-10) — `<s>`, ⌘⇧S, `~~text~~`. */
/** @type {import('../core/registry.js').MarkModule} */
export default {
  type: 'strike',
  tags: ['S', 'DEL', 'STRIKE'],
  match: (el) => /^(S|DEL|STRIKE)$/.test(el.tagName) || el.style.textDecoration.includes('line-through'),
  shortcut: 'Mod-Shift-s',
  markdown: /~~([^~\n]+)~~$/,
  md: '~~',
  toolbar: { label: 'S', title: 'Strikethrough ⌘⇧S' },
};
