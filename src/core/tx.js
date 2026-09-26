// Transactions: serializable ops that carry their own inverse data (F-02).

/**
 * @typedef {import('./model.js').Mark} Mark
 * @typedef {import('./model.js').Run} Run
 * @typedef {import('./model.js').Block} Block
 */
import { mapMarks, newId, parentOf, same, sameMark, slice, sortMarks, splice, subtree, text } from './model.js';

const bad = (op, why) => {
  throw new Error(`Invalid ${op.op}: ${why}`);
};
const get = (doc, id, op) => doc.blocks[id] ?? bad(op, `no block ${id}`);
const inline = (doc, op) => get(doc, op.block, op).content ?? bad(op, 'no text');
const within = (op, runs, from, to) => (0 <= from && from <= to && to <= text(runs).length) || bad(op, 'out of range');

/** Block in canonical key order; empty props/children are omitted. */
export const make = (type, props, content, children) => ({
  type,
  ...(props && Object.keys(props).length && { props }),
  ...(content && { content }),
  ...(children?.length && { children }),
});

const setChildren = (doc, id, children) => {
  const b = doc.blocks[id];
  doc.blocks[id] = id === doc.root ? { ...b, children } : make(b.type, b.props, b.content, children);
};

/** Applies one op in place; touched blocks are replaced, never mutated. Throws on invalid input. */
export function apply(doc, op) {
  const b = doc.blocks[op.block];
  switch (op.op) {
    case 'insertText': {
      const runs = inline(doc, op);
      within(op, runs, op.at, op.at);
      if (typeof op.text !== 'string' || !op.text) bad(op, 'empty text');
      doc.blocks[op.block] = { ...b, content: splice(runs, op.at, op.at, [{ text: op.text, marks: op.marks }]) };
      break;
    }
    case 'deleteText': {
      const runs = inline(doc, op);
      within(op, runs, op.at, op.at + op.len);
      if (!op.len || !same(slice(runs, op.at, op.at + op.len), op.runs)) bad(op, 'text mismatch');
      doc.blocks[op.block] = { ...b, content: splice(runs, op.at, op.at + op.len) };
      break;
    }
    case 'addMark':
    case 'removeMark': {
      const runs = inline(doc, op);
      const add = op.op === 'addMark';
      within(op, runs, op.from, op.to);
      if (op.from === op.to) bad(op, 'empty range');
      for (const r of slice(runs, op.from, op.to))
        if (add === r.marks.some((m) => (add ? m.type === op.mark.type : sameMark(m, op.mark)))) bad(op, 'mark mismatch');
      const next = add ? (ms) => sortMarks([...ms, op.mark]) : (ms) => ms.filter((m) => !sameMark(m, op.mark));
      doc.blocks[op.block] = { ...b, content: mapMarks(runs, op.from, op.to, next) };
      break;
    }
    case 'setProps': {
      const props = { ...get(doc, op.block, op).props };
      for (const [k, v] of Object.entries(op.props)) {
        if (!same(props[k] ?? null, op.prev?.[k] ?? null)) bad(op, `prev.${k} mismatch`);
        if (v == null) delete props[k];
        else props[k] = v;
      }
      doc.blocks[op.block] = make(b.type, props, b.content, b.children);
      break;
    }
    case 'setType':
      if (get(doc, op.block, op).type !== op.prev?.type || !same(b.props ?? {}, op.prev.props ?? {})) bad(op, 'prev mismatch');
      doc.blocks[op.block] = make(op.type, op.props, b.content, b.children);
      break;
    case 'insertBlock': {
      const kids = get(doc, op.parent, op).children ?? [];
      if (!(op.index >= 0 && op.index <= kids.length)) bad(op, 'out of range');
      if (typeof op.block?.type !== 'string') bad(op, 'no type');
      const added = { [op.id]: op.block, ...op.sub };
      for (const id in added) if (doc.blocks[id]) bad(op, `${id} exists`);
      Object.assign(doc.blocks, added);
      setChildren(doc, op.parent, kids.toSpliced(op.index, 0, op.id));
      if (doc.parents) {
        doc.parents.set(op.id, op.parent);
        for (const id in added) for (const c of added[id].children ?? []) doc.parents.set(c, id);
      }
      break;
    }
    case 'removeBlock': {
      const kids = get(doc, op.parent, op).children;
      if (kids?.[op.index] !== op.id) bad(op, 'position mismatch');
      for (const id of [op.id, ...Object.keys(subtree(doc, op.id))]) {
        delete doc.blocks[id];
        doc.parents?.delete(id);
      }
      setChildren(doc, op.parent, kids.toSpliced(op.index, 1));
      break;
    }
    case 'moveBlock': {
      const [fp, fi] = op.from;
      const [tp, ti] = op.to;
      const kids = get(doc, fp, op).children;
      if (kids?.[fi] !== op.block) bad(op, 'position mismatch');
      const room = (get(doc, tp, op).children?.length ?? 0) - (tp === fp);
      if (!(ti >= 0 && ti <= room)) bad(op, 'out of range');
      for (let a = tp; a; a = parentOf(doc, a)) if (a === op.block) bad(op, 'cycle');
      setChildren(doc, fp, kids.toSpliced(fi, 1));
      setChildren(doc, tp, (doc.blocks[tp].children ?? []).toSpliced(ti, 0, op.block));
      doc.parents?.set(op.block, tp);
      break;
    }
    default:
      bad(op, 'unknown op');
  }
}

const swap = { addMark: 'removeMark', removeMark: 'addMark', insertBlock: 'removeBlock', removeBlock: 'insertBlock' };

/** The ops that undo `ops`, in reverse order. */
export const invert = (ops) =>
  ops.toReversed().flatMap((o) => {
    let at = o.at;
    if (swap[o.op]) return [{ ...o, op: swap[o.op] }];
    if (o.op === 'insertText') return [{ op: 'deleteText', block: o.block, at, len: o.text.length, runs: [{ text: o.text, marks: o.marks }] }];
    if (o.op === 'deleteText')
      return o.runs.map((r) => ({ op: 'insertText', block: o.block, at: (at += r.text.length) - r.text.length, text: r.text, marks: r.marks }));
    if (o.op === 'setProps') return [{ ...o, props: o.prev, prev: o.props }];
    if (o.op === 'setType') return [{ ...o, type: o.prev.type, props: o.prev.props, prev: { type: o.type, props: o.props } }];
    return [{ ...o, from: o.to, to: o.from }];
  });

/** Transforms `ops` to apply after concurrent `other` ops — reserved for collaboration (NG-1). */
export function rebase(ops, other) {
  throw new Error('rebase: collaboration is not built');
}

/** Builds ops against a private draft of `doc`; the live doc is untouched until dispatch. */
/**
 * A transaction builder over a draft of `doc`: every call applies one validated op to the draft and
 * records it, so reads (`get`, `parent`, `index`) see the edits made so far. Nothing touches the real
 * document until the editor dispatches it.
 * @param {import('./model.js').Doc} doc
 */
export function tx(doc) {
  const d = { ...doc, blocks: { ...doc.blocks }, parents: doc.parents && new Map(doc.parents) };
  const ops = [];
  const add = (op) => (apply(d, op), ops.push(op), t);
  const runs = (id) => d.blocks[id].content;
  const t = {
    doc: d,
    ops,
    /** @param {string} id */
    get: (id) => d.blocks[id],
    /** @param {string} id @returns {string} */
    parent: (id) => parentOf(d, id),
    /** Position among its siblings. @param {string} id @returns {number} */
    index: (id) => d.blocks[parentOf(d, id)].children.indexOf(id),
    /** @param {string} block @param {number} at @param {string} str @param {Mark[]} [marks] */
    insertText: (block, at, str, marks = []) => (str ? add({ op: 'insertText', block, at, text: str, marks: sortMarks(marks) }) : t),
    /** @param {string} block @param {number} at @param {Run[]} list */
    insertRuns(block, at, list) {
      for (const r of list) t.insertText(block, at, r.text, r.marks), (at += r.text.length);
      return t;
    },
    /** @param {string} block @param {number} from @param {number} to */
    deleteText: (block, from, to) => (to > from ? add({ op: 'deleteText', block, at: from, len: to - from, runs: slice(runs(block), from, to) }) : t),
    /**
     * Adds (or with on=false removes) a mark type over [from, to), one exactly-invertible op per run.
     * @param {string} block @param {number} from @param {number} to @param {Mark} mark @param {boolean} [on]
     */
    mark(block, from, to, mark, on = true) {
      let pos = from;
      for (const r of slice(runs(block), from, to)) {
        const end = pos + r.text.length;
        const cur = r.marks.find((m) => m.type === mark.type);
        if (cur && !(on && sameMark(cur, mark))) add({ op: 'removeMark', block, from: pos, to: end, mark: cur });
        if (on && !(cur && sameMark(cur, mark))) add({ op: 'addMark', block, from: pos, to: end, mark });
        pos = end;
      }
      return t;
    },
    /** Merges props; a null value deletes one. @param {string} block @param {Record<string, any>} props */
    setProps: (block, props) =>
      add({ op: 'setProps', block, props, prev: Object.fromEntries(Object.keys(props).map((k) => [k, d.blocks[block].props?.[k] ?? null])) }),
    /** @param {string} block @param {string} type @param {Record<string, any>} [props] */
    setType: (block, type, props) => add({ op: 'setType', block, type, props, prev: { type: d.blocks[block].type, props: d.blocks[block].props } }),
    /**
     * Inserts a block (with the blocks of `sub` under it) and returns its id.
     * @param {string} parent @param {number} index @param {Block} block @param {Record<string, Block>} [sub] @param {string} [id]
     * @returns {string}
     */
    insert(parent, index, block, sub = {}, id = newId()) {
      add({ op: 'insertBlock', parent, index, id, block, sub });
      return id;
    },
    /** Removes a block and everything under it. @param {string} id */
    remove(id) {
      const parent = parentOf(d, id);
      return add({ op: 'removeBlock', parent, index: t.index(id), id, block: d.blocks[id], sub: subtree(d, id) });
    },
    /** Moves a block (with its children); `index` counts after its removal. @param {string} id @param {string} parent @param {number} index */
    move: (id, parent, index) => add({ op: 'moveBlock', block: id, from: [parentOf(d, id), t.index(id)], to: [parent, index] }),
  };
  return t;
}
