/**
 * Columns (F-23) — a container of columns on a CSS grid; each column holds ordinary blocks, and blocks
 * drag between columns like anywhere else (an empty column still takes a drop). Collapses to a single
 * column on narrow viewports. "/2 columns", "/3 columns".
 */
import s from './columns.module.css';

const caret = (block) => ({ anchor: { block, offset: 0 }, focus: { block, offset: 0 } });
const paragraph = { type: 'paragraph', content: [] };

const column = {
  type: 'column',
  className: s.column,
  container: true,
  schema: { content: 'none' },
  create: () => ({ type: 'column' }),
  serialize: { html: (b, inner, kids) => `<div>${kids}</div>` },
};

const entry = (n) => ({
  label: `${n} columns`,
  keywords: ['columns', 'layout', 'side'],
  icon: '▥',
  run(editor, t) {
    const at = editor.range.block;
    const row = t.insert(t.parent(at), t.index(at) + 1, { type: 'columns' });
    const first = t.insert(t.insert(row, 0, { type: 'column' }), 0, paragraph);
    for (let i = 1; i < n; i++) t.insert(t.insert(row, i, { type: 'column' }), 0, paragraph);
    if (!t.get(at).content.length && !t.get(at).children) t.remove(at);
    editor.dispatch(t, { selection: caret(first) });
  },
});

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'columns',
  className: s.columns,
  cells: true,
  schema: { content: 'none' },
  create: () => ({ type: 'columns' }),
  blocks: [column],
  slash: [entry(2), entry(3)],
  serialize: {
    markdown: (b, md) => (b.children ?? []).flatMap((c) => (c.children ?? []).map((x) => md.inline(x.content ?? []))),
    html: (b, inner, kids) => `<div>${kids}</div>`,
  },
  /** Clicking an empty column starts a paragraph in it. */
  mount(editor) {
    const root = editor.view.root();
    const click = (e) => {
      const id = e.target.closest?.('[data-block]')?.dataset.block;
      if (editor.get(id)?.type !== 'column' || editor.get(id).children) return;
      const t = editor.tx();
      editor.dispatch(t, { selection: caret(t.insert(id, 0, paragraph)) });
    };
    root.addEventListener('click', click);
    return () => root.removeEventListener('click', click);
  },
};
