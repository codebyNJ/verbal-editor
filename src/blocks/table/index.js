/**
 * Table (F-33) — a grid of per-cell editable blocks: the table's children are paragraphs laid out row
 * by row, `cols` wide, on a CSS grid. Tab / ⇧Tab and ↑ ↓ move between cells, Enter moves down;
 * adding or removing a row or column is one transaction, so one undo step. Columns resize with Pointer
 * Events. No merged cells. Markdown: GFM table.
 */
import s from './table.module.css';

const cell = (text = '') => ({ type: 'paragraph', content: text ? [{ text, marks: [] }] : [] });
const caret = (editor, block, end) => {
  const offset = end ? editor.len(block) : 0;
  editor.select({ anchor: { block, offset }, focus: { block, offset } });
};
/** Where a cell sits: its table, index, row, column and the grid size. */
const where = (editor, id) => {
  const table = editor.parent(id);
  const { cols } = editor.get(table).props;
  const kids = editor.get(table).children;
  const i = kids.indexOf(id);
  return { table, kids, i, cols, row: Math.floor(i / cols), col: i % cols, rows: kids.length / cols };
};

/** One resize grip per column boundary, on an overlay grid that mirrors the table's columns. */
const grips = (el, b) => {
  el.lastChild.replaceChildren(...Array.from({ length: b.props.cols }, (_, i) => Object.assign(document.createElement('i'), { title: 'Drag to resize' })));
  [...el.lastChild.children].forEach((g, i) => (g.dataset.col = i));
  return el;
};

/**
 * Row and column edits; each is a single transaction. `row` / `col` is the one to add after or remove.
 * @param {import('../../index.js').Editor} editor @param {string} table the table block's id @param {number} row
 */
export function addRow(editor, table, row) {
  const t = editor.tx();
  const { cols } = t.get(table).props;
  const first = t.insert(table, (row + 1) * cols, cell());
  for (let c = 1; c < cols; c++) t.insert(table, (row + 1) * cols + c, cell());
  editor.dispatch(t, { selection: { anchor: { block: first, offset: 0 }, focus: { block: first, offset: 0 } } });
}
/** @param {import('../../index.js').Editor} editor @param {string} table @param {number} col */
export function addColumn(editor, table, col) {
  const t = editor.tx();
  const { cols, widths } = t.get(table).props;
  for (let r = t.get(table).children.length / cols - 1; r >= 0; r--) t.insert(table, r * cols + col + 1, cell());
  editor.dispatch(t.setProps(table, { cols: cols + 1, widths: widths?.toSpliced(col + 1, 0, 120) }), { selection: editor.selection });
}
/** @param {import('../../index.js').Editor} editor @param {string} table @param {number} row */
export function removeRow(editor, table, row) {
  const t = editor.tx();
  const { cols } = t.get(table).props;
  const kids = t.get(table).children;
  if (kids.length <= cols) return editor.dispatch(t.remove(table));
  kids.slice(row * cols, row * cols + cols).forEach((id) => t.remove(id));
  const land = t.get(table).children[Math.min(row, kids.length / cols - 2) * cols];
  editor.dispatch(t, { selection: { anchor: { block: land, offset: 0 }, focus: { block: land, offset: 0 } } });
}
/** @param {import('../../index.js').Editor} editor @param {string} table @param {number} col */
export function removeColumn(editor, table, col) {
  const t = editor.tx();
  const { cols, widths } = t.get(table).props;
  if (cols === 1) return editor.dispatch(t.remove(table));
  const kids = t.get(table).children;
  for (let i = col; i < kids.length; i += cols) t.remove(kids[i]);
  editor.dispatch(t.setProps(table, { cols: cols - 1, widths: widths?.toSpliced(col, 1) }), { selection: null });
}

/** Moves the caret `step` cells on in reading order, adding a row past the end. */
const hop = (editor, id, step) => {
  const w = where(editor, id);
  const next = w.kids[w.i + step];
  if (next) caret(editor, next, step < 0);
  else if (step > 0) addRow(editor, w.table, w.rows - 1);
  return true;
};
const vertical = (dir) => (editor, { id }) => {
  if (!editor.view.edge(dir < 0 ? 'up' : 'down')) return false;
  const w = where(editor, id);
  const next = w.kids[w.i + dir * w.cols];
  if (next) caret(editor, next, dir < 0);
  return !!next;
};
/** Backspace/Delete never merge cells; on selected cells they clear the text. */
const clear = (editor, edge) => {
  const sel = editor.selection;
  if (sel?.blocks) {
    const t = editor.tx();
    for (const id of sel.blocks) if (t.get(id).content) t.deleteText(id, 0, editor.len(id));
    return editor.dispatch(t), true;
  }
  const r = editor.range;
  return r?.from === r?.to && r.to === (edge ? editor.len(r.block) : 0);
};

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'table',
  className: s.table,
  cells: true,
  schema: { props: { cols: Number, header: Boolean, widths: Array }, content: 'none' },
  create: (props) => ({ type: 'table', props: { cols: 2, header: true, ...props } }),
  view: {
    host: (b) => ({
      'data-header': b.props.header,
      style: { '--cols': b.props.widths?.map((w) => `${w}px`).join(' ') ?? `repeat(${b.props.cols}, minmax(96px, 1fr))` },
    }),
    create(b, editor) {
      const el = document.createElement('div');
      el.className = s.tools;
      el.innerHTML =
        '<div role="toolbar" aria-label="Table"><button data-do="row">+ Row</button><button data-do="col">+ Column</button><button data-do="-row">− Row</button><button data-do="-col">− Column</button><button data-do="head">Header</button></div><div></div>';
      const table = () => el.closest('[data-block]').dataset.block;
      el.onpointerdown = (e) => e.target.closest('button') && e.preventDefault();
      el.onclick = (e) => {
        const act = e.target.dataset.do;
        const id = editor.selection?.focus?.block;
        const w = id && editor.parent(id) === table() ? where(editor, id) : { row: -1, col: -1 };
        const { cols } = editor.get(table()).props;
        const rows = (editor.get(table()).children?.length ?? 0) / cols;
        if (act === 'row') addRow(editor, table(), w.row < 0 ? rows - 1 : w.row);
        if (act === 'col') addColumn(editor, table(), w.col < 0 ? cols - 1 : w.col);
        if (act === '-row' && rows) removeRow(editor, table(), Math.max(w.row, 0));
        if (act === '-col') removeColumn(editor, table(), Math.max(w.col, 0));
        if (act === 'head') editor.dispatch(editor.tx().setProps(table(), { header: !editor.get(table()).props.header }), { selection: editor.selection });
      };
      el.lastChild.onpointerdown = (e) => {
        const grip = e.target.dataset.col;
        if (grip == null) return;
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        const host = el.parentElement;
        const cells = [...host.querySelector('[data-children]').children].slice(0, editor.get(table()).props.cols);
        const start = cells.map((c) => Math.round(c.getBoundingClientRect().width));
        const widths = [...start];
        e.target.onpointermove = (m) => {
          widths[grip] = Math.max(60, start[grip] + m.clientX - e.clientX);
          host.style.setProperty('--cols', widths.map((w) => `${w}px`).join(' '));
        };
        e.target.onpointerup = () => {
          e.target.onpointermove = null;
          editor.dispatch(editor.tx().setProps(table(), { widths }), { selection: editor.selection });
        };
      };
      return grips(el, b);
    },
    patch: (el, b) => grips(el, b),
  },
  input: {
    keys: {
      Tab: (editor, { id }) => hop(editor, id, 1),
      'Shift-Tab': (editor, { id }) => hop(editor, id, -1),
      Enter: (editor, { id }) => hop(editor, id, where(editor, id).cols),
      ArrowUp: vertical(-1),
      ArrowDown: vertical(1),
      Backspace: (editor) => clear(editor, false),
      Delete: (editor) => clear(editor, true),
      'Mod-Shift-ArrowUp': () => true,
      'Mod-Shift-ArrowDown': () => true,
      Paste: (editor, { e }) => !!editor.range && editor.replace(editor.range, e.text.replace(/\s*\n\s*/g, ' ')),
    },
  },
  mount: (editor) => editor.on('input', ({ id }) => !!editor.mod(editor.parent(id))?.cells),
  slash: {
    label: 'Table',
    keywords: ['grid', 'spreadsheet'],
    icon: '⊞',
    run(editor, t) {
      const at = editor.range.block;
      const blank = !t.get(at).content.length;
      const table = t.insert(t.parent(at), t.index(at) + 1, { type: 'table', props: { cols: 3, header: true } });
      for (let i = 0; i < 9; i++) t.insert(table, i, cell());
      if (blank) t.remove(at);
      const first = t.get(table).children[0];
      editor.dispatch(t, { selection: { anchor: { block: first, offset: 0 }, focus: { block: first, offset: 0 } } });
    },
  },
  parse: {
    lines(lines, i, inline) {
      const row = (l) => l?.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      if (!/^\s*\|.*\|\s*$/.test(lines[i]) || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) return;
      const head = row(lines[i]);
      const cols = head.length;
      const header = head.some(Boolean);
      const cells = header ? head : [];
      let j = i + 2;
      for (; /^\s*\|.*\|\s*$/.test(lines[j] ?? ''); j++) cells.push(...row(lines[j]).slice(0, cols).concat(Array(cols).fill('')).slice(0, cols));
      return [{ type: 'table', props: { cols, header }, children: cells.map((c) => ({ type: 'paragraph', content: inline(c) })) }, j - 1];
    },
  },
  serialize: {
    markdown(b, md) {
      const { cols, header } = b.props;
      const cells = (b.children ?? []).map((c) => md.inline(c.content ?? []).replace(/\|/g, '\\|'));
      if (!cells.length) return [];
      const rows = Array.from({ length: cells.length / cols }, (_, r) => `| ${cells.slice(r * cols, r * cols + cols).join(' | ')} |`);
      const line = `|${' --- |'.repeat(cols)}`;
      return header ? [rows[0], line, ...rows.slice(1)] : [`|${'  |'.repeat(cols)}`, line, ...rows];
    },
    html(b, inner, kids, h) {
      const { cols, header } = b.props;
      const cells = (b.children ?? []).map((c, i) => (header && i < cols ? `<th>${h.html(c.content ?? [])}</th>` : `<td>${h.html(c.content ?? [])}</td>`));
      return `<table>${Array.from({ length: cells.length / cols }, (_, r) => `<tr>${cells.slice(r * cols, r * cols + cols).join('')}</tr>`).join('')}</table>`;
    },
  },
};
