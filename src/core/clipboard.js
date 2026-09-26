// Clipboard formats (F-45): copy writes HTML carrying the lossless payload, plus markdown as plain text;
// paste parses markdown or plain text into block literals. Nothing pasted is ever injected as HTML.
import { nest, newId, norm, parse, sameMark, sortMarks } from './model.js';

/** @typedef {{ type: string, props?: object, content?: object[], children?: Literal[] }} Literal */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rank = (reg) => (m) => reg.marks[m.type]?.rank ?? 0;
const delim = (reg, m) => {
  const d = reg.marks[m.type].md;
  return typeof d === 'function' ? d(m) : [[d].flat()[0], [d].flat()[0]];
};

/** Runs as HTML with properly nested mark tags. */
export function inlineHTML(runs, reg) {
  let out = '';
  const tag = (m) => reg.marks[m.type].tags[0].toLowerCase();
  nest(runs, rank(reg), {
    open: (m) => (out += `<${tag(m)}${Object.entries(m).map(([k, v]) => (k === 'type' ? '' : ` ${k}="${esc(v)}"`)).join('')}>`),
    close: (m) => (out += `</${tag(m)}>`),
    text: (t) => (out += esc(t).replace(/\n/g, '<br>')),
  });
  return out;
}

/** Runs as markdown; edge whitespace moves outside delimiters, literal delimiters are escaped outside code. */
export function inlineMD(runs, reg) {
  let out = '';
  const edge = (r, o) => r.marks.filter((m) => o?.marks.some((x) => sameMark(x, m)));
  const split = runs.flatMap((r, i) => {
    const [, a, t, z] = /^(\s*)([^]*?)(\s*)$/.exec(r.text);
    return [{ text: a, marks: edge(r, runs[i - 1]) }, { text: t, marks: r.marks }, { text: z, marks: edge(r, runs[i + 1]) }];
  });
  nest(norm(split), rank(reg), {
    open: (m) => (out += delim(reg, m)[0]),
    close: (m) => (out += delim(reg, m)[1]),
    text: (t, open) => (out += open.some((m) => reg.marks[m.type].md === '`') ? t : t.replace(/[\\*_~`[\]]/g, '\\$&')),
  });
  return out;
}

/** Block literals → clipboard strings: HTML (with the exact payload in data-verbal) and markdown. */
export function write(frag, reg) {
  const md = { inline: (r) => inlineMD(r, reg), html: (r) => inlineHTML(r, reg), esc };
  const html = (list) =>
    list
      .map((b) => {
        const mod = reg.blocks[b.type];
        const inner = b.content ? inlineHTML(b.content, reg) : '';
        const kids = html(b.children ?? []);
        const tag = (mod.parse?.tags?.[0] ?? 'P').toLowerCase();
        return mod.serialize?.html?.(b, inner, kids, md) ?? `<${tag}>${inner}</${tag}>${kids}`;
      })
      .join('');
  /** A module returning an array of lines has written its children itself. */
  const text = (list, pad) =>
    list.flatMap((b) => {
      const out = reg.blocks[b.type].serialize?.markdown?.(b, md) ?? md.inline(b.content ?? []);
      return Array.isArray(out) ? out.map((l) => pad + l) : [pad + out.replace(/\n/g, `\n${pad}`), ...text(b.children ?? [], `${pad}    `)];
    });
  return { html: `<div data-verbal="${esc(JSON.stringify(frag))}">${html(frag)}</div>`, text: text(frag, '').join('\n') };
}

/** Inline markdown → runs: mark delimiters, module patterns (links), backslash escapes. */
export function inline(s, reg, marks = []) {
  const out = [];
  let buf = '';
  const flush = () => (buf && out.push({ text: buf, marks }), (buf = ''));
  const mods = Object.values(reg.marks);
  const delims = mods.flatMap((m) => [m.md].flat().filter((d) => typeof d === 'string').map((d) => [d, m.type])).sort((a, b) => b[0].length - a[0].length);
  for (let i = 0; i < s.length; ) {
    if (s[i] === '\\' && /[\\*_~`[\]]/.test(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (!/[*_~`[]/.test(s[i])) {
      buf += s[i++];
      continue;
    }
    const rest = s.slice(i);
    const own = mods.find((m) => m.unmd?.[0].test(rest));
    if (own) {
      const m = own.unmd[0].exec(rest);
      const [txt, attrs] = own.unmd[1](m);
      flush();
      out.push(...inline(txt, reg, sortMarks([...marks, { type: own.type, ...attrs }])));
      i += m[0].length;
      continue;
    }
    let end = -1;
    // Emphasis may not start or end on a space; a code span may (`# ` is code).
    const d = delims.find(([x]) => {
      const code = x === '`';
      if (!rest.startsWith(x) || (!code && /\s/.test(rest[x.length] ?? ' '))) return false;
      for (end = rest.indexOf(x, x.length + 1); end > 0 && !code && /[\s\\]/.test(rest[end - 1]); end = rest.indexOf(x, end + 1));
      return end > 0;
    });
    if (d) {
      const inner = rest.slice(d[0].length, end);
      const mk = sortMarks([...marks, { type: d[1] }]);
      flush();
      out.push(...(d[0] === '`' ? [{ text: inner, marks: mk }] : inline(inner, reg, mk)));
      i += end + d[0].length;
      continue;
    }
    buf += s[i++];
  }
  flush();
  return norm(out);
}

/** Markdown or plain text → block literals: one block per line, indentation nests. */
export function fromMarkdown(src, reg) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const root = [];
  const stack = [[-1, root]];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const indent = /^\s*/.exec(raw)[0].replace(/\t/g, '    ').length;
    let b;
    for (const mod of Object.values(reg.blocks)) {
      const multi = mod.parse?.lines?.(lines, i, (t) => inline(t, reg));
      if (multi) {
        [b, i] = multi;
        break;
      }
      const [re, to] = mod.parse?.markdown ?? [];
      const m = re?.exec(raw.trim());
      if (m) {
        const r = to(m);
        b = { type: mod.type, props: r.props, content: r.text == null ? undefined : inline(r.text, reg) };
        break;
      }
    }
    b ??= { type: 'paragraph', content: inline(lines[1] == null ? raw : raw.trim(), reg) };
    while (stack.at(-1)[0] >= indent) stack.pop();
    stack.at(-1)[1].push(b);
    stack.push([indent, (b.children ??= [])]);
  }
  return root;
}

/** Block literals → a sanitized flat fragment { root: 'f', blocks } with fresh ids. */
export function build(frag, reg) {
  const blocks = { f: { type: 'doc', children: [] } };
  const add = (b, parent) => {
    const id = newId();
    const { children, ...rest } = b;
    blocks[id] = rest;
    blocks[parent].children.push(id);
    blocks[id].children = [];
    children?.forEach((c) => add(c, id));
  };
  frag.forEach((b) => add(b, 'f'));
  return parse({ root: 'f', blocks }, reg);
}

/** A subtree of the live doc as nested literals (what copy carries). */
export const literal = (doc, id) => {
  const { children, ...b } = doc.blocks[id];
  return children ? { ...b, children: children.map((c) => literal(doc, c)) } : b;
};
