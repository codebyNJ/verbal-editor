/**
 * The site's Markdown: docs components as ordinary Verbal modules (callouts, code groups, steps, cards,
 * stats, diagrams, <kbd>), and the few directives that place them. Everything else goes through the
 * package's own fromMarkdown, so a page reads exactly as it would pasted into the editor.
 *
 *   > [!NOTE] / [!TIP] / [!WARNING]         a callout around the quoted blocks
 *   ```lang [Tab] file.ext                  fenced code: optional tab label and filename
 *   ::: code-group … :::                    consecutive fences as tabs
 *   ::: steps / cards / stats … :::         numbered steps (### titles), link cards, big numbers
 *   ::: chart bar :::  ::: diagram name :::  a chart of the table above it; an inline SVG diagram
 *   <kbd>⌘K</kbd>                           a key
 */
import { Editor, fromMarkdown } from 'verbal-editor';
import preset from 'verbal-editor/preset';
import { svg } from './icons.jsx';
import s from './markdown.module.css';
import { charted, doc } from './pages.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const diagrams = Object.fromEntries(
  Object.entries(import.meta.glob('./assets/diagrams/*.svg', { query: '?raw', import: 'default', eager: true })).map(([k, v]) => [/(\w[\w-]*)\.svg$/.exec(k)[1], v]),
);
const container = (type, className, props = {}) => ({
  type,
  className,
  cells: true,
  schema: { props, content: 'none' },
  create: () => ({ type }),
});

const kinds = { note: ['info', 'Note'], tip: ['bulb', 'Tip'], warning: ['warning', 'Warning'] };
/** A callout around other blocks. */
const callout = {
  ...container('callout', s.callout, { kind: Object.keys(kinds) }),
  cells: false,
  view: {
    host: (b) => ({ 'data-kind': b.props?.kind ?? 'note' }),
    create(b) {
      const el = document.createElement('p');
      el.className = s.label;
      const [icon, label] = kinds[b.props?.kind] ?? kinds.note;
      el.innerHTML = `${svg(icon)}<span>${label}</span>`;
      return el;
    },
  },
};

/** Tabs chosen anywhere on the site, newest first: a group opens on the first one it has (npm, Vite…). */
const chosen = () => {
  try {
    return JSON.parse(localStorage.getItem('verbal:tabs')) ?? [];
  } catch {
    return [];
  }
};
const choose = (label) => {
  try {
    localStorage.setItem('verbal:tabs', JSON.stringify([label, ...chosen().filter((t) => t !== label)].slice(0, 8)));
  } catch { /* storage unavailable */ }
};

/** Fenced code in tabs, with its filename and a copy button; choosing a tab switches every group that has it. */
const codegroup = {
  ...container('codegroup', s.group, { tabs: Array, files: Array }),
  view: {
    create(b) {
      const { tabs = [], files = [] } = b.props ?? {};
      const el = document.createElement('div');
      el.className = s.bar;
      el.innerHTML = `<div role="tablist">${tabs.map((t) => `<button type="button" role="tab">${esc(t)}</button>`).join('')}</div><span class="${s.file}"></span><button type="button" class="${s.copy}" aria-label="Copy code">${svg('copy')}</button>`;
      const [list, file, copy] = el.children;
      el.pick = (i) => {
        if (i < 0) return;
        el.dataset.active = i;
        [...list.children].forEach((t, n) => (t.ariaSelected = n === i));
        file.textContent = tabs.length > 1 ? (files[i] ?? '') : '';
      };
      el.pick(Math.max(0, tabs.findIndex((t) => chosen().includes(t))));
      list.onclick = (e) => {
        const label = e.target.closest('[role=tab]')?.textContent;
        if (label == null) return;
        choose(label);
        for (const bar of document.querySelectorAll(`.${s.bar}`)) bar.pick?.([...bar.firstChild.children].findIndex((t) => t.textContent === label));
      };
      copy.onclick = () => {
        const code = el.parentElement.querySelector(':scope > [data-children]').children[el.dataset.active]?.querySelector('pre');
        navigator.clipboard.writeText(code?.textContent ?? '').then(() => {
          copy.innerHTML = svg('check');
          copy.ariaLabel = 'Copied';
          setTimeout(() => ((copy.innerHTML = svg('copy')), (copy.ariaLabel = 'Copy code')), 1500);
        });
      };
      return el;
    },
  },
};

const diagram = {
  type: 'diagram',
  className: s.diagram,
  schema: { props: { name: String, alt: String }, content: 'none' },
  create: () => ({ type: 'diagram', props: { name: '', alt: '' } }),
  view: {
    create(b) {
      const el = document.createElement('figure');
      el.innerHTML = diagrams[b.props?.name] ?? '';
      el.firstElementChild?.setAttribute('role', 'img');
      el.firstElementChild?.setAttribute('aria-label', b.props?.alt ?? '');
      return el;
    },
  },
};

/** A key, written <kbd>⌘K</kbd>. */
const kbd = { type: 'kbd', tags: ['KBD'], md: () => ['<kbd>', '</kbd>'], unmd: [/^\[\[([^\]]+)\]\]/, (m) => [m[1], {}]] };

const steps = container('steps', s.steps);
const cards = container('cards', s.cards);
const stats = container('stats', s.stats);

/** Every module a site page uses: the full preset plus the docs components. */
export const modules = {
  blocks: [...preset.blocks, callout, codegroup, steps, cards, stats, diagram],
  marks: [...preset.marks, kbd],
  ui: preset.ui,
};

/** The registry site pages are parsed with. */
export const registry = new Editor(modules).registry;

/** A link inside a page goes where it points on a plain click; a card goes where its first link points. */
export function follow(e) {
  const a = e.target.closest?.('a[href]') ?? e.target.closest?.(`.${s.cards} > [data-children] > [data-block]`)?.querySelector('a[href]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || getSelection().toString()) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (href.startsWith('#')) location.hash = href.slice(1);
  else open(href, '_blank', 'noopener');
}

const names = { bash: 'Terminal', sh: 'Terminal', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', json: 'JSON', css: 'CSS', html: 'HTML', text: 'Output' };
/** Fenced code starting at line i → [code literal, tab label, filename, last line]. */
function fence(lines, i, reg) {
  const [, lang, meta] = /^```([\w+#-]*)\s*(.*)$/.exec(lines[i]);
  let j = i + 1;
  while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
  const [, tab, file = ''] = /^(?:\[([^\]]+)\])?\s*(\S*)/.exec(meta);
  const [code] = fromMarkdown(['```' + lang, ...lines.slice(i + 1, j), '```'].join('\n'), reg);
  return [code, tab ?? (file || names[lang] || 'Code'), file, j];
}

/** Lines up to the ::: that closes the container opened at line i (fenced code is skipped over). */
function inside(lines, i) {
  let depth = 1;
  let j = i + 1;
  for (; j < lines.length; j++) {
    if (/^```/.test(lines[j])) while (++j < lines.length && !/^```\s*$/.test(lines[j]));
    else if (/^:::\s*$/.test(lines[j]) && !--depth) break;
    else if (/^:::\s*[\w-]+(?!.*:::\s*$)/.test(lines[j])) depth++;
  }
  return [lines.slice(i + 1, j), j];
}

/** List items as paragraphs; a card's title link keeps the space after it, so its description starts flush. */
const paragraphs = (list) =>
  list.map((b) => {
    if (b.type !== 'list') return b;
    const [first, next, ...rest] = b.content;
    const lead = first?.marks.some((m) => m.type === 'link') && next?.text.startsWith(' ');
    return { type: 'paragraph', content: lead ? [{ ...first, text: `${first.text} ` }, { ...next, text: next.text.slice(1) }, ...rest] : b.content };
  });

/** Site Markdown → block literals. */
export function literals(md, reg) {
  const lines = md.replace(/<kbd>(.*?)<\/kbd>/g, '[[$1]]').split('\n');
  const out = [];
  let plain = [];
  const flush = () => (plain.length && out.push(...fromMarkdown(plain.join('\n'), reg)), (plain = []));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (/^```/.test(line)) {
      flush();
      const [code, tab, file, end] = fence(lines, i, reg);
      out.push({ type: 'codegroup', props: { tabs: [tab], files: [file] }, children: [code] });
      i = end;
    } else if ((m = /^>\s*\[!(\w+)\]\s*$/.exec(line))) {
      flush();
      let j = i + 1;
      const quoted = [];
      while (j < lines.length && /^>/.test(lines[j])) quoted.push(lines[j++].replace(/^>\s?/, ''));
      const kind = { important: 'note', caution: 'warning' }[m[1].toLowerCase()] ?? m[1].toLowerCase();
      out.push({ type: 'callout', props: { kind }, children: literals(quoted.join('\n'), reg) });
      i = j - 1;
    } else if ((m = /^:::\s*([\w-]+)\s*(.*?)\s*:::\s*$/.exec(line))) {
      flush();
      const [arg, alt = ''] = m[2].split(/\s+"|"$/);
      out.push(m[1] === 'chart' ? { type: 'chart', props: { kind: arg || 'bar' } } : { type: 'diagram', props: { name: arg, alt } });
    } else if ((m = /^:::\s*([\w-]+)/.exec(line))) {
      flush();
      const [body, end] = inside(lines, i);
      if (m[1] === 'code-group') {
        const tabs = [];
        for (let j = 0; j < body.length; j++) if (/^```/.test(body[j])) tabs.push(fence(body, j, reg)), (j = tabs.at(-1)[3]);
        out.push({ type: 'codegroup', props: { tabs: tabs.map((t) => t[1]), files: tabs.map((t) => t[2]) }, children: tabs.map((t) => t[0]) });
      } else {
        const kids = literals(body.join('\n'), reg);
        out.push({ type: m[1], children: m[1] === 'steps' ? kids : paragraphs(kids) });
      }
      i = end;
    } else plain.push(line);
  }
  flush();
  return out;
}

/** A page's Markdown as a document, charts pointing at the table before them. */
export const toDoc = (md, reg = registry) => charted(doc(...literals(md, reg)));
