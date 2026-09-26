/** Bold (F-10) — `<strong>`, ⌘B, `**text**`. Pasted HTML counts font-weight too (Google Docs wraps everything in `<b style="font-weight:normal">`). */
/** @type {import('../core/registry.js').MarkModule} */
export default {
  type: 'bold',
  tags: ['STRONG', 'B'],
  match: (el) => (/^(B|STRONG)$/.test(el.tagName) ? !/^(normal|[1-5]00)$/.test(el.style.fontWeight) : /^(bold|[6-9]00)$/.test(el.style.fontWeight)),
  shortcut: 'Mod-b',
  markdown: /\*\*([^*\n]+)\*\*$/,
  md: '**',
  toolbar: { label: 'B', title: 'Bold ⌘B' },
};
