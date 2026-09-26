// Document model: a flat id → block map plus children order arrays (F-01).

/** @typedef {{ type: string, [attr: string]: any }} Mark */
/** @typedef {{ text: string, marks: Mark[] }} Run */
/** @typedef {{ type: string, props?: Record<string, any>, content?: Run[], children?: string[] }} Block */
/** @typedef {{ version: 1, root: string, blocks: Record<string, Block> }} Doc */

/** Fresh block id. */
export const newId = () => `b_${Math.random().toString(36).slice(2, 10)}`;

/** Plain text of a run array. */
export const text = (runs = []) => runs.map((r) => r.text).join('');

/** Structural equality for JSON-shaped values. */
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const sameMark = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);
/** Marks in canonical (type) order. */
export const sortMarks = (marks) => [...marks].sort((a, b) => (a.type < b.type ? -1 : +(a.type > b.type)));
export const sameMarks = (a, b) => a.length === b.length && a.every((m, i) => sameMark(m, b[i]));

/** Walks runs as properly nested mark spans, calling open/close/text in document order. */
export function nest(runs, rank, { open, close, text: put }) {
  const stack = [];
  for (const r of runs) {
    const marks = [...r.marks].sort((a, b) => rank(a) - rank(b));
    let i = 0;
    while (i < stack.length && marks[i] && sameMark(stack[i], marks[i])) i++;
    while (stack.length > i) close(stack.pop());
    for (const m of marks.slice(i)) open(m, stack.push(m));
    put(r.text, stack);
  }
  while (stack.length) close(stack.pop());
}

/** Drops empty runs and merges neighbours with equal marks. */
export function norm(runs) {
  const out = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out.at(-1);
    if (last && sameMarks(last.marks, r.marks)) out[out.length - 1] = { text: last.text + r.text, marks: last.marks };
    else out.push({ text: r.text, marks: r.marks });
  }
  return out;
}

/** Runs covering [from, to). */
export function slice(runs = [], from = 0, to = Infinity) {
  const out = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    const part = end > from && pos < to && r.text.slice(Math.max(0, from - pos), to - pos);
    if (part) out.push({ text: part, marks: r.marks });
    pos = end;
  }
  return out;
}

/** Replaces [from, to) with `ins`. */
export const splice = (runs, from, to, ins = []) => norm([...slice(runs, 0, from), ...ins, ...slice(runs, to)]);

/** Rewrites the marks of every run in [from, to). */
export const mapMarks = (runs, from, to, fn) =>
  norm([...slice(runs, 0, from), ...slice(runs, from, to).map((r) => ({ text: r.text, marks: fn(r.marks) })), ...slice(runs, to)]);

/** Parent id of a block (index kept on the in-memory doc, rebuilt lazily). */
export function parentOf(doc, id) {
  if (!doc.parents) {
    doc.parents = new Map();
    for (const [pid, b] of Object.entries(doc.blocks)) for (const c of b.children ?? []) doc.parents.set(c, pid);
  }
  return doc.parents.get(id);
}

/** Every descendant of `id` as an id → block map. */
export function subtree(doc, id, out = {}) {
  for (const c of doc.blocks[id]?.children ?? []) {
    out[c] = doc.blocks[c];
    subtree(doc, c, out);
  }
  return out;
}

/** Block ids in document (visual) order, depth first. */
export function order(doc, id = doc.root, out = []) {
  for (const c of doc.blocks[id]?.children ?? []) {
    out.push(c);
    order(doc, c, out);
  }
  return out;
}

const valid = (spec, v) =>
  Array.isArray(spec) ? spec.includes(v) : spec === Array ? Array.isArray(v) : typeof v === spec.name.toLowerCase();

/** Canonical block: known type, schema-valid props, normalized runs; unknown types degrade to paragraphs. */
export function clean(b, reg) {
  const mod = reg.blocks[b?.type] ?? reg.blocks.paragraph;
  const out = { type: mod.type };
  const props = {};
  for (const [k, spec] of Object.entries(mod.schema?.props ?? {})) if (b.props && valid(spec, b.props[k])) props[k] = b.props[k];
  if (Object.keys(props).length) out.props = props;
  if (mod.schema?.content !== 'none') {
    const code = mod.schema?.content === 'code';
    out.content = norm(
      (Array.isArray(b.content) ? b.content : []).map((r) => ({
        text: String(r?.text ?? ''),
        marks: code ? [] : sortMarks((r?.marks ?? []).filter((m) => reg.marks[m?.type]?.valid?.(m) ?? !!reg.marks[m?.type])),
      })),
    );
  }
  return out;
}

/** Validates and normalizes a document payload against the registered modules. */
export function parse(input, reg) {
  const src = typeof input === 'string' ? JSON.parse(input) : input;
  const root = src?.root ?? 'doc';
  const blocks = { [root]: { type: 'doc', children: [] } };
  const visit = (pid) => {
    for (const id of src.blocks?.[pid]?.children ?? []) {
      if (typeof id !== 'string' || blocks[id] || !src.blocks[id]) continue;
      blocks[id] = clean(src.blocks[id], reg);
      (blocks[pid].children ??= []).push(id);
      visit(id);
    }
  };
  visit(root);
  return { version: 1, root, blocks };
}

/** The payload with blocks in document order, so equal documents serialize identically (HLD §3.3). */
export const payload = (doc) => ({
  version: 1,
  root: doc.root,
  blocks: Object.fromEntries([doc.root, ...order(doc)].map((id) => [id, doc.blocks[id]])),
});

/** Stable JSON payload. */
export const serialize = (doc) => JSON.stringify(payload(doc));
