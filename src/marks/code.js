/** Inline code (F-10) — `<code>`, ⌘E, `` `text` ``. Typing at its end continues as plain text. */
/** @type {import('../core/registry.js').MarkModule} */
export default {
  type: 'code',
  tags: ['CODE'],
  shortcut: 'Mod-e',
  markdown: /`([^`\n]+)`$/,
  md: '`',
  inclusive: false,
  toolbar: { label: '</>', title: 'Inline code ⌘E' },
};
