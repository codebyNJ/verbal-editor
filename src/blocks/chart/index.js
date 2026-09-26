/**
 * Chart (F-35) — hand-written SVG line, bar, area and pie charts drawn from a table block: the first
 * row names the series, the first column labels the points, the other cells are numbers. It redraws
 * from a model listener whenever the table changes, so typing in a cell costs zero React renders.
 * Colours are the --v-chart-* custom properties, so it follows the theme.
 */
import s from './chart.module.css';

const W = 640;
const H = 240;
const P = 28;
const kinds = ['bar', 'line', 'area', 'pie'];
const esc = (t) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const figures = new Set();

/** Labels and numeric series read from a table's cells. */
function data(editor, table) {
  const t = editor.get(table);
  if (t?.type !== 'table') return null;
  const cells = (t.children ?? []).map((id) => editor.get(id).content.map((r) => r.text).join('').trim());
  const rows = Array.from({ length: cells.length / t.props.cols }, (_, r) => cells.slice(r * t.props.cols, (r + 1) * t.props.cols));
  const [head = [], ...body] = rows;
  return { labels: body.map((r) => r[0]), series: head.slice(1).map((name, j) => ({ name, values: body.map((r) => parseFloat(r[j + 1]) || 0) })) };
}

/** SVG markup for one chart. */
function svg({ labels, series }, kind) {
  const max = Math.max(1, ...series.flatMap((x) => x.values));
  const band = (W - 2 * P) / labels.length;
  const x = (i) => P + band * (i + 0.5);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const c = (j) => s[`c${(j % 4) + 1}`];
  let body = '';
  if (kind === 'pie') {
    const total = series[0].values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
    let a = -Math.PI / 2;
    series[0].values.forEach((v, i) => {
      const b = a + (Math.max(v, 0) / total) * Math.PI * 2;
      const pt = (t) => `${W / 2 + Math.cos(t) * 90} ${H / 2 + Math.sin(t) * 90}`;
      body += `<path class="${c(i)}" d="M${W / 2} ${H / 2}L${pt(a)}A90 90 0 ${b - a > Math.PI ? 1 : 0} 1 ${pt(b)}Z"><title>${esc(labels[i] ?? '')}: ${v}</title></path>`;
      a = b;
    });
  } else {
    series.forEach(({ values }, j) => {
      const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      if (kind === 'bar')
        values.forEach((v, i) => {
          const w = (band * 0.7) / series.length;
          body += `<rect class="${c(j)}" x="${x(i) - band * 0.35 + j * w}" y="${y(v)}" width="${w - 2}" height="${H - P - y(v)}" rx="3"/>`;
        });
      else body += `${kind === 'area' ? `<polygon class="${c(j)} ${s.fill}" points="${x(0)},${H - P} ${pts} ${x(values.length - 1)},${H - P}"/>` : ''}<polyline class="${c(j)} ${s.line}" points="${pts}"/>`;
    });
    body += `<line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/>${labels.map((l, i) => `<text x="${x(i)}" y="${H - 8}">${esc(l)}</text>`).join('')}`;
  }
  const legend = (kind === 'pie' ? labels : series.map((x) => x.name)).map((n, j) => `<span><i class="${c(j)}"></i>${esc(n)}</span>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${kind} chart">${body}</svg><div class="${s.legend}">${legend}</div>`;
}

function draw(fig) {
  const d = data(fig.editor, fig.block.props.table);
  const ok = d?.labels.length && d.series.length;
  fig.firstChild.innerHTML = ok ? svg(d, fig.block.props.kind) : `<p class="${s.empty}">Point this chart at a table with a header row and a label column.</p>`;
}

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'chart',
  className: s.chart,
  schema: { props: { table: String, kind: kinds }, content: 'none' },
  create: (props) => ({ type: 'chart', props: { table: '', kind: 'bar', ...props } }),
  view: {
    create(b, editor) {
      const fig = document.createElement('figure');
      fig.innerHTML = `<div></div><figcaption><select aria-label="Chart type">${kinds.map((k) => `<option>${k}</option>`).join('')}</select></figcaption>`;
      Object.assign(fig, { editor, block: b });
      const select = fig.querySelector('select');
      select.value = b.props.kind;
      select.onchange = () => editor.dispatch(editor.tx().setProps(fig.closest('[data-block]').dataset.block, { kind: select.value }));
      figures.add(fig);
      draw(fig);
      return fig;
    },
    patch: (fig, b) => ((fig.block = b), (fig.querySelector('select').value = b.props.kind), draw(fig), fig),
  },
  /** Redraws charts whose table changed — a model listener, so React never renders for it. */
  mount: (editor) =>
    editor.on('change', ({ ops }) => {
      const touched = new Set(ops.flatMap((o) => [o.block, o.parent, o.from?.[0], o.to?.[0]]));
      for (const fig of figures) {
        if (!fig.isConnected) figures.delete(fig);
        else if (fig.editor === editor && [...touched].some((id) => id === fig.block.props.table || editor.parent(id) === fig.block.props.table)) draw(fig);
      }
    }),
  slash: {
    label: 'Chart',
    keywords: ['graph', 'plot', 'bar', 'line', 'pie'],
    icon: '▁▃▆',
    /** Charts the nearest table above, or a new sample table. */
    run(editor, t) {
      const at = editor.range.block;
      const ids = Object.keys(editor.getDoc().blocks);
      let table = ids.slice(0, ids.indexOf(at)).findLast((id) => editor.get(id).type === 'table');
      let i = t.index(at) + 1;
      if (!table) {
        table = t.insert(t.parent(at), i++, { type: 'table', props: { cols: 3, header: true } });
        ['Month', 'Revenue', 'Costs', 'Jan', '12', '8', 'Feb', '18', '9', 'Mar', '15', '11', 'Apr', '24', '12'].forEach((text, k) =>
          t.insert(table, k, { type: 'paragraph', content: [{ text, marks: [] }] }),
        );
      }
      t.insert(t.parent(at), i, { type: 'chart', props: { table, kind: 'bar' } });
      if (!t.get(at).content.length) t.remove(at);
      editor.dispatch(t, { selection: null });
    },
  },
};
