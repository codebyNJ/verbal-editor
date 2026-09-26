// The same paragraphs in each editor's own format. Imports nothing, so it adds nothing to any size.
export const html = (texts) => texts.map((t) => `<p>${t}</p>`).join('');
export const blocks = (texts) => texts.map((content) => ({ type: 'paragraph', content }));
export const slate = (texts) => texts.map((text) => ({ type: 'p', children: [{ text }] }));
export const editorjs = (texts) => ({ blocks: texts.map((text) => ({ type: 'paragraph', data: { text } })) });
export const verbal = (texts) => ({
  version: 1,
  root: 'doc',
  blocks: Object.fromEntries([['doc', { type: 'doc', children: texts.map((_, i) => `p${i}`) }], ...texts.map((text, i) => [`p${i}`, { type: 'paragraph', content: [{ text, marks: [] }] }])]),
});
