// Verbal Editor: framework-free core that ships exactly one block type, paragraph (HLD §3.6).
import paragraph from './blocks/paragraph/index.js';
import { build, fromMarkdown, literal, write } from './core/clipboard.js';
import { history } from './core/history.js';
import { order, parentOf, parse, payload, serialize, slice, sortMarks, subtree, text } from './core/model.js';
import { registry } from './core/registry.js';
import { caret, span, within } from './core/selection.js';
import { store } from './core/store.js';
import { apply, invert, tx } from './core/tx.js';
import { view } from './core/view.js';

export { parse, serialize, write, fromMarkdown, tx, invert, caret };

/**
 * @typedef {import('./core/model.js').Doc} Doc
 * @typedef {import('./core/model.js').Block} Block
 * @typedef {import('./core/model.js').Run} Run
 * @typedef {import('./core/model.js').Mark} Mark
 * @typedef {import('./core/selection.js').Point} Point
 * @typedef {import('./core/selection.js').Selection} Selection
 * @typedef {import('./core/registry.js').BlockModule} BlockModule
 * @typedef {import('./core/registry.js').MarkModule} MarkModule
 * @typedef {import('./core/registry.js').UiModule} UiModule
 * @typedef {import('./core/registry.js').SlashEntry} SlashEntry
 * @typedef {import('./core/registry.js').Registry} Registry
 * @typedef {ReturnType<typeof tx>} Tx
 * @typedef {{ block: string, from: number, to: number }} Range a selection inside one block
 */

/**
 * Editor options. `editable: false` renders the document read-only: text can be selected and copied,
 * nothing changes it (every transaction is ignored) and modules hide their controls. Anything else beyond
 * the modules and the document is read by modules or bindings: `upload(file) → Promise<url>` (image),
 * `unfurl(url) → Promise<{ title }>` (embed), `onRender(id)` (React binding: called on every block render).
 * @typedef {{
 *   blocks?: BlockModule[],
 *   marks?: MarkModule[],
 *   ui?: UiModule[],
 *   doc?: Doc | string,
 *   editable?: boolean,
 *   upload?: (file: File) => Promise<string>,
 *   unfurl?: (url: string) => Promise<{ title?: string } | null>,
 *   onRender?: (id: string) => void,
 *   [option: string]: unknown,
 * }} EditorOptions
 */

/**
 * Events: 'change' ({ ops, origin }) after every transaction; 'selectionchange' (Selection | null);
 * 'input' ({ id, data }) after typed text, before Markdown rules — return true to skip them;
 * 'key' ({ name, e }) before any key is handled — return true to claim it.
 * @typedef {'change' | 'selectionchange' | 'input' | 'key' | 'prompt' | (string & {})} EditorEvent
 */

const EMPTY = { root: 'doc', blocks: { doc: { type: 'doc', children: ['b_start'] }, b_start: { type: 'paragraph', content: [] } } };

/**
 * The editor: a document, its history, and a view that owns each block's content element.
 * Construct it with the modules you use, render it with a binding (`<Blocks>` from
 * `verbal-editor/react`), and read or change the document through the methods below.
 * @example
 * const editor = new Editor({ blocks: [heading], marks: [bold], ui: [slash] });
 * editor.on('change', () => save(editor.getDoc()));
 */
export class Editor {
  /** @param {EditorOptions} [options] */
  constructor({ blocks = [], marks = [], ui = [], doc, ...options } = {}) {
    /** Options for modules and bindings (everything except blocks, marks, ui and doc). @type {EditorOptions} */
    this.options = options;
    /** @type {UiModule[]} */
    this.ui = ui;
    /** @internal @type {Record<string, Set<Function>>} */
    this.listeners = {};
    /** The current selection: text points, whole blocks, or null. @type {Selection | null} */
    this.selection = null;
    /** @internal @type {{ block: string, offset: number, marks: Mark[] } | null} */
    this.stored = null;
    /** Per-block versions that bindings subscribe to; bumped by structural edits, never by typing. */
    this.store = store();
    /** Undo/redo stacks. */
    this.history = history();
    /** Every registered block type, mark, slash entry, shortcut and typing rule. @type {Registry} */
    this.registry = registry([paragraph, ...blocks], marks, ui, {
      'Mod-z': () => this.undo(),
      'Mod-Shift-z': () => this.redo(),
      'Mod-y': () => this.redo(),
      'Mod-a': () => this.selectAll(),
      'Mod-Alt-0': () => this.setType('paragraph'),
    });
    /** The DOM side: content elements, selection mapping, events. For modules and bindings. */
    this.view = view(this);
    this.load(doc);
  }

  /** @internal @param {Doc | string} [doc] */
  load(doc = EMPTY) {
    /** The live document. Treat it as read-only; change it with transactions. @type {Doc} */
    this.doc = parse(doc, this.registry);
    if (!this.get(this.doc.root).children.length) this.doc = parse(EMPTY, this.registry);
  }
  /**
   * Replaces the document; history starts over and the selection clears.
   * @param {Doc | string} doc a payload from getDoc() (or its JSON)
   */
  setDoc(doc) {
    const ids = Object.keys(this.doc.blocks);
    this.load(doc);
    this.history.clear();
    this.view.reset();
    this.select(null);
    for (const id of new Set([...ids, ...Object.keys(this.doc.blocks)])) this.store.bump(id);
  }
  /** A deep copy of the document payload, blocks in document order (HLD §3.3). @returns {Doc} */
  getDoc = () => structuredClone(payload(this.doc));
  /** A block by id (live — do not mutate). @param {string} id @returns {Block | undefined} */
  get = (id) => this.doc.blocks[id];
  /** The id of a block's parent. @param {string} id @returns {string | undefined} */
  parent = (id) => parentOf(this.doc, id);
  /** The outermost blocks from `a` to `b` inclusive, in document order. @param {string} a @param {string} b @returns {string[]} */
  span = (a, b) => span(this.doc, a, b);
  /** A new transaction on the current document; pass it to dispatch(). @returns {Tx} */
  tx = () => tx(this.doc);
  /** The module of a block's type. @param {string} id @returns {BlockModule | undefined} */
  mod = (id) => this.registry.blocks[this.get(id)?.type];
  /** Length of a block's text. @param {string} id @returns {number} */
  len = (id) => text(this.get(id).content).length;
  /**
   * What a block command acts on: the selected blocks, or every block the text selection touches.
   * @param {Selection | null} [s] @returns {string[]}
   */
  targets = (s = this.selection) => s?.blocks ?? (s ? this.span(s.anchor.block, s.focus.block) : []);
  /** The selection when it lies inside one block, as { block, from, to }; null otherwise. @returns {Range | null} */
  get range() {
    return within(this.selection);
  }

  /**
   * Listens for an editor event; returns the function that stops listening.
   * @param {EditorEvent} type @param {(e: any, editor: Editor) => boolean | void} fn @returns {() => void}
   */
  on(type, fn) {
    (this.listeners[type] ??= new Set()).add(fn);
    return () => this.listeners[type].delete(fn);
  }
  /** Calls listeners in order; true when one of them handled the event. @param {EditorEvent} type @param {any} [e] @returns {boolean} */
  emit(type, e) {
    for (const fn of this.listeners[type] ?? []) if (fn(e, this) === true) return true;
    return false;
  }

  /** Attaches the view to its root element; every module with a mount(editor) hook starts. Bindings call this. @param {HTMLElement} root */
  mount(root) {
    this.view.attach(root);
    const { blocks, marks } = this.registry;
    this.cleanups = [...Object.values(blocks), ...Object.values(marks), ...this.ui].map((m) => m.mount?.(this));
  }
  /** Detaches the view and runs every module's cleanup. */
  unmount() {
    this.view.detach();
    this.cleanups?.forEach((f) => f?.());
  }

  /**
   * Applies a transaction: the model, then text repaints, then one version bump per structurally
   * changed block (so only those re-render), then history and the 'change' event. A transaction that
   * throws part-way is rolled back; a read-only editor (`editable: false`) ignores it.
   * @param {Tx | object[]} t a transaction from tx(), or its ops
   * @param {{ selection?: Selection | null, origin?: 'input' | 'history' | string, kind?: string, before?: Selection | null }} [options]
   *   `selection` to select afterwards (undo restores `before`); `kind: 'text'` coalesces with adjacent typing
   */
  dispatch(t, { selection, origin, kind, before = this.selection } = {}) {
    const ops = t.ops ?? t;
    if (!ops.length || this.options.editable === false) return;
    let n = 0;
    try {
      for (const op of ops) apply(this.doc, op), n++;
    } catch (err) {
      for (const op of invert(ops.slice(0, n))) apply(this.doc, op);
      throw err;
    }
    const bump = new Set();
    const paint = new Set();
    for (const op of ops) {
      if (op.op === 'removeBlock') [op.id, ...Object.keys(op.sub ?? {})].forEach(this.view.drop);
      if (op.op === 'moveBlock') bump.add(op.from[0]).add(op.to[0]);
      else if (op.parent) bump.add(op.parent);
      else (/Text|Mark/.test(op.op) ? paint : bump).add(op.block);
    }
    for (const id of bump) if (this.get(id)) this.view.update(id);
    if (origin !== 'input') for (const id of paint) if (this.get(id)) this.view.repaint(id);
    if (origin !== 'history') this.history.push({ ops, before, after: selection ?? this.selection, kind, block: ops[0].block, time: Date.now() });
    for (const id of bump) if (this.get(id)) this.store.bump(id);
    if (selection !== undefined) this.select(selection);
    this.emit('change', { ops, origin });
  }
  /** Undoes the last step, restoring the model and the selection. @returns {true} */
  undo() {
    const e = this.history.undo();
    if (e) this.dispatch(invert(e.ops), { origin: 'history', selection: e.before });
    return true;
  }
  /** Redoes the last undone step. @returns {true} */
  redo() {
    const e = this.history.redo();
    if (e) this.dispatch(e.ops, { origin: 'history', selection: e.after });
    return true;
  }

  /** Selects text points or whole blocks, in the model and on screen. @param {Selection | null} sel */
  select(sel) {
    this.selection = sel;
    this.view.select(sel);
    this.emit('selectionchange', sel);
  }
  /** @internal The DOM selection moved (reported by the view). @param {Selection | null} sel */
  selected(sel) {
    const was = this.selection?.focus;
    const now = sel?.focus;
    if (was?.block !== now?.block || Math.abs(was?.offset - now?.offset) > 1) this.history.seal();
    if (this.stored?.block !== now?.block || this.stored?.offset !== now?.offset) this.stored = null;
    this.selection = sel;
    this.emit('selectionchange', sel);
  }

  /** @internal Typing path: the browser already wrote the DOM; update the model silently — no DOM writes, no renders. */
  input(id, runs, before, after) {
    const old = this.get(id).content;
    const a = text(old);
    const b = text(runs);
    let p = 0;
    let s = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    while (s < a.length - p && s < b.length - p && a.at(-1 - s) === b.at(-1 - s)) s++;
    const ops = [];
    if (a.length - s > p) ops.push({ op: 'deleteText', block: id, at: p, len: a.length - s - p, runs: slice(old, p, a.length - s) });
    const next = slice(old, p, p + 1)[0]?.marks ?? [];
    const keep = (m) => this.registry.marks[m.type]?.inclusive !== false || next.some((x) => x.type === m.type);
    const stored = this.stored?.block === id && this.stored.offset === p && this.stored.marks;
    let at = p;
    for (const r of slice(runs, p, b.length - s)) {
      ops.push({ op: 'insertText', block: id, at, text: r.text, marks: sortMarks(stored || r.marks.filter(keep)) });
      at += r.text.length;
    }
    this.stored = null;
    this.selection = after ?? this.selection;
    this.dispatch(ops, { origin: 'input', kind: 'text', before: before ?? this.selection });
    if (b.length > a.length && !this.emit('input', { id, data: b.slice(p, b.length - s) })) this.rules(id);
  }

  /** @internal Markdown input rules: block rules at the start of a paragraph, inline rules before the caret (F-14). */
  rules(id) {
    const r = this.range;
    if (r?.block !== id || r.from !== r.to) return;
    const b = this.get(id);
    const before = text(b.content).slice(0, r.to);
    for (const rule of b.type === 'paragraph' ? this.registry.rules : []) {
      const m = rule.re.exec(before);
      if (!m) continue;
      const to = rule.to(m);
      const mod = this.registry.blocks[to.type];
      const t = this.tx().deleteText(id, 0, m[0].length);
      if (mod.schema?.content === 'none') return this.insert(to.type, to.props, t);
      this.strip(t, id, mod);
      return this.dispatch(t.setType(id, to.type, { ...mod.create().props, ...to.props }), { selection: caret(id, 0), kind: 'rule' });
    }
    for (const rule of this.registry.inline) {
      const m = rule.re.exec(before);
      if (!m) continue;
      const inner = m.at(-1);
      const d = (m[0].length - inner.length) / 2;
      const end = m.index + inner.length;
      const t = this.tx().deleteText(id, r.to - d, r.to).deleteText(id, m.index, m.index + d);
      this.dispatch(t.mark(id, m.index, end, { type: rule.type }), { selection: caret(id, end), kind: 'rule' });
      this.stored = { block: id, offset: end, marks: (slice(b.content, m.index - 1, m.index)[0]?.marks ?? []).filter((x) => x.type !== rule.type) };
      return;
    }
  }

  /** @internal Browser editing intents other than plain typing (F-05); anything unlisted never mutates the doc. */
  inputType(type, range, data, clip) {
    if (type === 'insertParagraph') return this.key('Enter');
    if (type === 'insertLineBreak') return this.key('Shift-Enter');
    if (/^history/.test(type)) return type.endsWith('Undo') ? this.undo() : this.redo();
    if (/^insertFromPaste/.test(type) && clip) return this.paste(clip);
    const [f, t] = [range?.from, range?.to];
    const r = f && t && f.block === t.block && { block: f.block, from: f.offset, to: t.offset };
    if (type.startsWith('delete')) return r && r.from !== r.to ? this.replace(r, '') : this.key(/Forward/.test(type) ? 'Delete' : 'Backspace');
    if (type === 'insertReplacementText' && r && data) return this.replace(r, data);
  }

  /**
   * Runs a key as if pressed: UI interceptors, then scoped module keys (block → ancestors), shortcuts,
   * core defaults. Names look like 'Enter', 'Shift-Tab', 'Mod-b' (Mod is ⌘ on Apple, Ctrl elsewhere).
   * @param {string} name @param {any} [e] @returns {boolean} whether something handled it
   */
  key(name, e) {
    if (this.emit('key', { name, e })) return true;
    const id = this.selection?.focus?.block ?? this.selection?.blocks?.[0];
    for (let a = id; a && this.get(a); a = this.parent(a)) if (this.mod(a)?.input?.keys?.[name]?.(this, { id, block: a, e })) return true;
    const s = this.registry.shortcuts[name];
    return s ? s.run(this, e) !== false : !!this.keys[name]?.(e);
  }

  /** @internal */
  keys = {
    Enter: () => (this.selection?.blocks ? this.edit(this.selection.blocks[0]) : this.split()),
    'Shift-Enter': () => this.range && this.replace(this.range, '\n'),
    Backspace: () => (this.selection?.blocks ? this.remove(this.selection.blocks) : this.join(-1)),
    Delete: () => (this.selection?.blocks ? this.remove(this.selection.blocks) : this.join(1)),
    Tab: () => (this.indent(), true),
    'Shift-Tab': () => (this.outdent(), true),
    Escape: () => (this.select(this.range && { blocks: [this.range.block] }), true),
    ...Object.fromEntries(
      ['up', 'down', 'left', 'right'].flatMap((d) => {
        const k = `Arrow${d[0].toUpperCase()}${d.slice(1)}`;
        return [[k, () => this.arrow(d)], [`Shift-${k}`, () => this.arrow(d, true)]];
      }),
    ),
  };

  /** Nearest ancestor that holds blocks but no text (doc, column, table…). @param {string} id @returns {string | undefined} */
  container(id) {
    let p = this.parent(id);
    while (p && this.get(p).content) p = this.parent(p);
    return p;
  }

  /** @internal Arrow keys across block boundaries and over block selections. */
  arrow(dir, extend) {
    const back = dir === 'up' || dir === 'left';
    const sel = this.selection;
    if (sel?.blocks) {
      // ⇧ grows or shrinks the selection at its moving end, keeping the block it started from.
      const [first, last] = [sel.blocks[0], sel.blocks.at(-1)];
      const head = extend && sel.blocks.includes(this.head) ? this.head : back ? first : last;
      const sib = this.get(this.parent(head)).children;
      const next = sib[sib.indexOf(head) + (back ? -1 : 1)];
      if (next) (this.head = next), this.select({ blocks: extend ? this.span(head === first ? last : first, next) : [next] });
      return true;
    }
    const r = this.range;
    const side = /left|right/.test(dir);
    if (!r || r.from !== r.to || !(side ? r.to === (back ? 0 : this.len(r.block)) : this.view.edge(dir))) return false;
    if (extend) return this.select({ blocks: [r.block] }), true;
    const ids = order(this.doc).filter((x) => this.get(x).content);
    const next = ids[ids.indexOf(r.block) + (back ? -1 : 1)];
    if (next && side) this.select(caret(next, back ? this.len(next) : 0));
    else if (next) this.view.caretAt(next, this.view.caretX(), !back);
    return !!next;
  }

  /** Enter: splits the focused block at the caret (the new block's type comes from the module's `next`). @returns {boolean} */
  split() {
    const r = this.range;
    if (!r) return false;
    const t = this.tx().deleteText(r.block, r.from, r.to);
    const b = t.get(r.block);
    const len = text(b.content).length;
    if (!len && this.get(this.parent(r.block)).content) return this.outdent(r.block);
    if (!len && b.type !== 'paragraph') return this.dispatch(t.setType(r.block, 'paragraph'), { selection: caret(r.block, 0) }), true;
    const next = this.mod(r.block).next?.(b) ?? { type: 'paragraph' };
    const nb = this.registry.blocks[next.type].create(next.props);
    if (r.from === 0 && len) {
      t.insert(t.parent(r.block), t.index(r.block), nb);
      return this.dispatch(t, { selection: caret(r.block, 0) }), true;
    }
    const tail = slice(b.content, r.from);
    t.deleteText(r.block, r.from, len);
    const id = b.children ? t.insert(r.block, 0, { ...nb, content: tail }) : t.insert(t.parent(r.block), t.index(r.block) + 1, { ...nb, content: tail });
    this.dispatch(t, { selection: caret(id, 0) });
    return true;
  }

  /** @internal Moves `from`'s text onto the end of `into`; `from`'s children take its place. */
  merge(t, from, into) {
    const at = text(t.get(into).content).length;
    const runs = t.get(from).content;
    t.insertRuns(into, at, this.mod(into).schema?.content === 'code' ? runs.map((r) => ({ text: r.text, marks: [] })) : runs);
    const p = t.parent(from);
    let i = t.index(from);
    for (const c of t.get(from).children ?? []) t.move(c, p, ++i);
    t.remove(from);
    return at;
  }

  /** Backspace at a block's start (dir -1) or Delete at its end (dir 1): drop a void neighbour or merge. @param {-1 | 1} dir @returns {boolean} */
  join(dir) {
    const r = this.range;
    const id = r?.block;
    if (!r || r.from !== r.to || r.to !== (dir < 0 ? 0 : this.len(id))) return false;
    if (dir < 0 && this.get(id).type !== 'paragraph') return this.setType('paragraph', undefined, id);
    if (dir < 0 && this.get(this.parent(id)).content) return this.outdent(id);
    const all = order(this.doc);
    const other = all[all.indexOf(id) + dir];
    const t = this.tx();
    let sel = this.selection;
    if (!other || this.container(other) !== this.container(id)) return true;
    if (this.get(other).content) sel = caret(dir < 0 ? other : id, this.merge(t, dir < 0 ? id : other, dir < 0 ? other : id));
    else if (!this.get(other).children) t.remove(other);
    this.dispatch(t, { selection: sel });
    return true;
  }

  /** Tab: nests each block under the one above it — one transaction for any number of blocks. @param {...string} ids default: targets() @returns {boolean} */
  indent(...ids) {
    const t = this.tx();
    for (const id of ids[0] ? ids : this.targets()) {
      const prev = t.get(t.parent(id)).children[t.index(id) - 1];
      if (prev && t.get(prev).content && this.mod(prev).schema?.content !== 'code') t.move(id, prev, t.get(prev).children?.length ?? 0);
    }
    return this.dispatch(t, { selection: this.selection }), !!t.ops.length;
  }
  /** Shift-Tab: each block follows its parent out; the last goes first so they keep their order. @param {...string} ids default: targets() @returns {boolean} */
  outdent(...ids) {
    const t = this.tx();
    for (const id of (ids[0] ? ids : this.targets()).toReversed()) {
      const p = t.parent(id);
      if (t.get(p).content) t.move(id, t.parent(p), t.index(p) + 1);
    }
    return this.dispatch(t, { selection: this.selection }), !!t.ops.length;
  }
  /** Replaces a range inside one block with plain text, keeping the marks at its start. @param {Range} range @param {string} str @returns {true} */
  replace({ block, from, to }, str) {
    const runs = this.get(block).content;
    const marks = (slice(runs, from, from + 1)[0] ?? slice(runs, from - 1, from)[0])?.marks ?? [];
    this.dispatch(this.tx().deleteText(block, from, to).insertText(block, from, str, marks), { selection: caret(block, from + str.length) });
    return true;
  }

  /** Removes whole blocks; the caret lands on the nearest remaining text block. @param {string[]} ids @returns {true} */
  remove(ids) {
    const all = order(this.doc).filter((x) => this.get(x).content);
    const t = this.tx();
    for (const id of ids) if (t.get(id)) t.remove(id);
    const root = this.doc.root;
    const land =
      all.slice(0, all.indexOf(ids[0])).findLast((x) => t.get(x)) ??
      all.find((x) => t.get(x)) ??
      t.insert(root, t.get(root).children?.length ?? 0, paragraph.create());
    this.dispatch(t, { selection: caret(land, text(t.get(land).content).length) });
    return true;
  }

  /** @internal Drops marks when the target type holds plain code text. */
  strip(t, id, mod) {
    let pos = 0;
    if (mod.schema?.content === 'code')
      for (const r of t.get(id).content) {
        for (const m of r.marks) t.mark(id, pos, pos + r.text.length, m, false);
        pos += r.text.length;
      }
  }

  /**
   * Turns text blocks into `type`, keeping their text — one transaction.
   * @param {string} type @param {Record<string, any>} [props] @param {...string} ids default: targets() @returns {boolean}
   */
  setType(type, props, ...ids) {
    const mod = this.registry.blocks[type];
    const t = this.tx();
    for (const id of ids[0] ? ids : this.targets())
      if (t.get(id)?.content && mod?.schema?.content !== 'none') this.strip(t, id, mod), t.setType(id, type, { ...mod.create().props, ...props });
    return this.dispatch(t, { selection: this.selection }), !!t.ops.length;
  }

  /**
   * Converts the focused empty paragraph into `type`, or inserts `type` after the focused block (after
   * the whole grid when the caret is in a table cell); the caret lands where you can type next.
   * @param {string} type @param {Record<string, any>} [props] @param {Tx} [t] a transaction to add to
   * @returns {string} the new block's id
   */
  insert(type, props, t = this.tx()) {
    let id = this.range?.block ?? this.selection?.blocks?.at(-1);
    while (this.mod(this.parent(id))?.cells) id = this.parent(id);
    const nb = this.registry.blocks[type].create(props);
    const b = id && t.get(id);
    const blank = b?.type === 'paragraph' && !text(b.content) && !b.children;
    let target = id;
    if (blank && nb.content) t.setType(id, type, nb.props);
    else {
      const p = id ? t.parent(id) : this.doc.root;
      target = t.insert(p, id ? t.index(id) + 1 : t.get(p).children.length, nb);
      if (blank) t.remove(id);
    }
    const next = t.get(t.parent(target)).children[t.index(target) + 1];
    const land = nb.content || t.get(next)?.content ? (nb.content ? target : next) : t.insert(t.parent(target), t.index(target) + 1, paragraph.create());
    this.dispatch(t, { selection: caret(land, 0) });
    return target;
  }

  /**
   * Toggles (or with `force`, sets) a mark over the selection, or as a stored mark for the next typed text.
   * @param {string} type @param {Record<string, any>} [attrs] e.g. { href } @param {boolean} [force] @returns {boolean}
   */
  toggleMark(type, attrs, force) {
    const mark = { type, ...attrs };
    if (force && this.registry.marks[type]?.valid?.(mark) === false) return false;
    const sel = this.selection;
    const r = this.range;
    if (r && r.from === r.to) {
      const cur = this.stored?.marks ?? slice(this.get(r.block).content, r.from - 1, r.from)[0]?.marks ?? [];
      const has = cur.some((m) => m.type === type);
      this.stored = { block: r.block, offset: r.from, marks: has ? cur.filter((m) => m.type !== type) : sortMarks([...cur, mark]) };
      return this.emit('selectionchange', sel), true;
    }
    if (!r) return false;
    const on = force ?? !this.active(type);
    this.dispatch(this.tx().mark(r.block, r.from, r.to, mark, on), { selection: sel });
    return true;
  }
  /** Whether every selected character carries `type` (or the stored marks do, for a caret). @param {string} type @returns {boolean} */
  active(type) {
    const r = this.range;
    const runs = r && (r.from === r.to ? [{ marks: this.stored?.marks ?? slice(this.get(r.block).content, r.from - 1, r.from)[0]?.marks ?? [] }] : slice(this.get(r.block).content, r.from, r.to));
    return !!runs?.every((x) => x.marks.some((m) => m.type === type));
  }

  /**
   * Clipboard payload for the selection: HTML carrying the exact blocks, Markdown as plain text.
   * @param {boolean} [cut] also remove the selection @returns {{ html: string, text: string } | null}
   */
  copy(cut) {
    const sel = this.selection;
    const r = this.range;
    const frag = sel?.blocks ? sel.blocks.map((id) => literal(this.doc, id)) : r?.from < r?.to && [{ type: 'paragraph', content: slice(this.get(r.block).content, r.from, r.to) }];
    if (!frag) return null;
    const out = write(frag, this.registry);
    if (r && this.mod(r.block).schema?.content === 'code') out.text = text(frag[0].content);
    if (cut) sel.blocks ? this.remove(sel.blocks) : this.replace(r, '');
    return out;
  }

  /**
   * Pastes at the selection: a module may claim it (files, table cells); otherwise HTML or Markdown is
   * parsed into blocks, never injected.
   * @param {{ html?: string, text?: string, files?: File[] }} data @returns {true}
   */
  paste(data) {
    if (this.key('Paste', data)) return true;
    const r = this.range;
    const plain = data.text ?? '';
    if (r && this.mod(r.block).schema?.content === 'code') return this.replace(r, plain);
    const f = build((data.html && this.view.parseHTML(data.html)) || fromMarkdown(plain, this.registry), this.registry);
    const tops = f.blocks.f.children;
    const first = f.blocks[tops[0]];
    const t = this.tx();
    if (!first) return true;
    if (r) t.deleteText(r.block, r.from, r.to);
    if (r && !tops[1] && first.type === 'paragraph' && !first.children) {
      t.insertRuns(r.block, r.from, first.content);
      return this.dispatch(t, { selection: caret(r.block, r.from + text(first.content).length) }), true;
    }
    const at = r?.block ?? this.selection?.blocks?.at(-1) ?? this.get(this.doc.root).children.at(-1);
    const p = t.parent(at);
    let i = t.index(at) + 1;
    const tail = r ? slice(t.get(at).content, r.from) : [];
    if (tail[0]) t.deleteText(at, r.from, text(t.get(at).content).length);
    for (const id of tops) t.insert(p, i++, f.blocks[id], subtree(f, id), id);
    if (tail[0]) t.insert(p, i, { type: 'paragraph', content: tail });
    const was = t.get(at);
    if (r && was.type === 'paragraph' && !text(was.content) && !was.children) t.remove(at);
    const last = tops.at(-1);
    this.dispatch(t, { selection: f.blocks[last].content ? caret(last, text(f.blocks[last].content).length) : this.selection });
    return true;
  }

  /** Puts the caret at the end of a text block. @param {string} id @returns {true} */
  edit(id) {
    if (this.get(id)?.content) this.select(caret(id, this.len(id)));
    return true;
  }
  /** ⌘A: the block's text first, then every top-level block. @returns {boolean} */
  selectAll() {
    const r = this.range;
    if (r && r.to - r.from < this.len(r.block)) return false;
    this.select({ blocks: [...this.get(this.doc.root).children] });
    return true;
  }
}
