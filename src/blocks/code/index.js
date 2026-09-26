/**
 * Code block (F-30) — plain text in a `<pre>`; colours are painted with the CSS Custom Highlight API,
 * so the editable region holds nothing but text and the caret behaves exactly as in plain text.
 * Tokenizers load on first use (F-31); `lang: ''` detects the language (F-32). "``` " input rule,
 * Tab indents, Enter keeps the indentation, ⌘⏎ leaves the block. Markdown: fenced.
 */
import detect from './detect.js';
import s from './code.module.css';

const names = { '': 'Auto', plain: 'Plain text', js: 'JavaScript', ts: 'TypeScript', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON', bash: 'Bash', sql: 'SQL', go: 'Go', rust: 'Rust' };
const alias = { javascript: 'js', jsx: 'js', mjs: 'js', typescript: 'ts', tsx: 'ts', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', golang: 'go', rs: 'rust', xml: 'html', svg: 'html', text: 'plain' };
/** A known language id for any fence label. */
const lang = (id = '') => {
  const k = id.toLowerCase();
  return alias[k] ?? (k in names ? k : 'plain');
};
const text = (b) => b.content.map((r) => r.text).join('');

const tokenizers = {};
/** One combined regex per language, loaded the first time the language is shown. */
const load = (id) =>
  (tokenizers[id] ??= import(`./lang/${id}.js`).then(({ default: rules }) => [
    new RegExp(rules.map(([, re]) => `(${re.source})`).join('|'), `gm${rules.flags ?? ''}`),
    rules.map(([kind]) => kind),
  ]));
const ranges = new WeakMap();
const highlight = (kind) => {
  const name = `verbal-${kind}`;
  if (!CSS.highlights.has(name)) CSS.highlights.set(name, new Highlight());
  return CSS.highlights.get(name);
};

/** Paints token colours as highlight ranges over the pre's text nodes — no nodes are added. */
async function paint(el, b) {
  const pre = el.lastChild;
  const src = text(b);
  const id = b.props.lang || detect(src) || 'plain';
  el.querySelector('option').textContent = b.props.lang ? 'Auto' : `Auto · ${names[id]}`;
  const [re, kinds] = id === 'plain' ? [] : await load(id);
  if (pre.textContent !== src) return;
  for (const [h, r] of ranges.get(pre) ?? []) h.delete(r);
  for (const [name, h] of CSS.highlights) if (name.startsWith('verbal-')) for (const r of h) if (r.collapsed || !r.startContainer.isConnected) h.delete(r);
  const mine = [];
  ranges.set(pre, mine);
  const nodes = [...pre.childNodes].filter((n) => n.nodeType === 3);
  const at = (o) => {
    for (const n of nodes) {
      if (o <= n.length) return [n, o];
      o -= n.length;
    }
  };
  for (const m of re ? src.matchAll(re) : []) {
    const h = highlight(kinds[m.findIndex((g, i) => i && g !== undefined) - 1]);
    const r = new Range();
    r.setStart(...at(m.index));
    r.setEnd(...at(m.index + m[0].length));
    h.add(r);
    mine.push([h, r]);
  }
}
const queued = new WeakMap();
/** Coalesces repaints to one per frame while typing. */
const schedule = (el, b) => {
  if (!queued.has(el)) requestAnimationFrame(() => paint(el, queued.get(el)).finally(() => queued.delete(el)));
  queued.set(el, b);
};

/** The current line's text before the caret, and where the line starts. */
const line = (editor) => {
  const r = editor.range;
  const src = text(editor.get(r.block));
  const start = src.lastIndexOf('\n', r.from - 1) + 1;
  return [r, src.slice(start, r.from), start];
};

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'code',
  className: s.code,
  schema: { props: { lang: Object.keys(names) }, content: 'code' },
  create: (props) => ({ type: 'code', props: { lang: '', ...props }, content: [] }),
  view: {
    create(b, editor) {
      const el = document.createElement('div');
      const bar = el.appendChild(document.createElement('div'));
      bar.className = s.bar;
      bar.innerHTML = `<select aria-label="Language">${Object.entries(names).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button type="button">Copy</button>`;
      const [select, copy] = bar.children;
      select.value = b.props.lang;
      select.onchange = () => editor.dispatch(editor.tx().setProps(el.closest('[data-block]').dataset.block, { lang: select.value }));
      copy.onclick = () => navigator.clipboard.writeText(el.lastChild.textContent).then(() => (copy.textContent = 'Copied'));
      copy.onpointerleave = () => (copy.textContent = 'Copy');
      el.appendChild(document.createElement('pre')).dataset.content = '';
      return el;
    },
    patch: (el, b) => ((el.querySelector('select').value = b.props.lang), schedule(el, b), el),
    text: schedule,
  },
  input: {
    markdown: [[/^```([\w+#-]*)\s$/, (m) => ({ type: 'code', props: { lang: m[1] && lang(m[1]) } })]],
    keys: {
      Enter: (editor) => editor.replace(editor.range, `\n${/^[ \t]*/.exec(line(editor)[1])[0]}`),
      Tab: (editor) => editor.replace(editor.range, '  '),
      'Shift-Tab': (editor) => {
        const [r, before, start] = line(editor);
        const n = /^ {1,2}/.exec(text(editor.get(r.block)).slice(start))?.[0].length;
        const at = Math.max(start, r.from - n);
        if (n) editor.dispatch(editor.tx().deleteText(r.block, start, start + n), { selection: { anchor: { block: r.block, offset: at }, focus: { block: r.block, offset: at } } });
        return before !== undefined;
      },
      'Mod-Enter': (editor) => (editor.insert('paragraph'), true),
    },
  },
  slash: { label: 'Code', keywords: ['code', 'snippet', 'pre'], icon: '</>' },
  parse: {
    tags: ['PRE'],
    html: (el) => ({ lang: lang(/language-([\w+#-]+)/.exec(el.outerHTML)?.[1]) }),
    lines(lines, i) {
      const m = /^\s*```([\w+#-]*)\s*$/.exec(lines[i]);
      if (!m) return;
      let j = i + 1;
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) j++;
      return [{ type: 'code', props: { lang: m[1] && lang(m[1]) }, content: [{ text: lines.slice(i + 1, j).join('\n'), marks: [] }] }, j];
    },
  },
  serialize: {
    markdown: (b) => `\`\`\`${b.props.lang === 'plain' ? 'text' : b.props.lang}\n${text(b)}\n\`\`\``,
    html: (b, inner) => `<pre><code class="language-${b.props.lang}">${inner}</code></pre>`,
  },
};
