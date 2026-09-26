// Registry: every block type, mark, slash entry, shortcut and input rule comes from a module (F-06, F-44).

/**
 * @typedef {import('./model.js').Block} Block
 * @typedef {import('./model.js').Mark} Mark
 * @typedef {import('./model.js').Run} Run
 * @typedef {import('../index.js').Editor} Editor
 * @typedef {import('../index.js').Tx} Tx
 */

/**
 * A slash-menu entry. Without `run`, choosing it inserts `type` with `props`.
 * @typedef {object} SlashEntry
 * @property {string} label
 * @property {string[]} [keywords] extra words the menu filters on
 * @property {string} [icon]
 * @property {Record<string, any>} [props]
 * @property {(editor: Editor, t: Tx) => void} [run] replaces the default insert; `t` already holds the "/query" deletion
 */

/**
 * A key handler scoped to a block type: runs when the focused block, or an ancestor, is of that type.
 * Return true when handled.
 * @typedef {(editor: Editor, at: { id: string, block: string, e?: any }) => boolean | void} KeyHandler
 */

/**
 * Serializer helpers passed to `serialize.markdown` and `serialize.html`.
 * @typedef {{ inline: (runs: Run[]) => string, html: (runs: Run[]) => string, esc: (s: string) => string }} Writers
 */

/**
 * A block type. Only `type` is required; everything else is opt-in (F-06).
 * @typedef {object} BlockModule
 * @property {string} type unique block type
 * @property {{ props?: Record<string, BooleanConstructor | NumberConstructor | StringConstructor | ArrayConstructor | any[]>, content?: 'inline' | 'code' | 'none' }} [schema]
 *   props with their type (or list of allowed values); content: text with marks (default), plain code text, or none (a void block)
 * @property {(props?: Record<string, any>) => Block} [create] a fresh block of this type
 * @property {string} [className] class on the block's host element
 * @property {string} [placeholder] shown while the block is empty and focused
 * @property {{
 *   create?: (block: Block, editor: Editor) => HTMLElement,
 *   patch?: (el: HTMLElement, block: Block, prev: Block, editor: Editor) => HTMLElement | null | void,
 *   host?: (block: Block) => Record<string, any>,
 *   text?: (el: HTMLElement, block: Block, editor: Editor) => void,
 * }} [view] the element for the block (default: the parse tag), how to update it in place (null recreates),
 *   attributes for the React host, and a hook after its text is painted
 * @property {SlashEntry | SlashEntry[]} [slash]
 * @property {{
 *   keys?: Record<string, KeyHandler>,
 *   shortcuts?: Record<string, (editor: Editor, e?: KeyboardEvent) => boolean | void>,
 *   markdown?: Array<[RegExp, (m: RegExpExecArray) => { type: string, props?: Record<string, any> }]>,
 * }} [input] scoped keys, global shortcuts, and typing rules that turn a paragraph into this type
 * @property {{
 *   tags?: string[],
 *   html?: (el: Element) => Record<string, any>,
 *   markdown?: [RegExp, (m: RegExpExecArray) => { props?: Record<string, any>, text?: string }],
 *   lines?: (lines: string[], i: number, inline: (s: string) => Run[]) => [object, number] | undefined,
 * }} [parse] how pasted HTML and Markdown become this type
 * @property {{
 *   markdown?: (block: Block, md: Writers) => string | string[],
 *   html?: (block: Block, inner: string, kids: string, h: Writers) => string,
 * }} [serialize] how it is copied; a Markdown writer returning lines has written its children itself
 * @property {(block: Block) => { type: string, props?: Record<string, any> }} [next] what Enter creates after it
 * @property {boolean} [cells] its children are a fixed grid (table, columns): not draggable, never merged
 * @property {boolean} [container] holds blocks but no text (a column)
 * @property {BlockModule[]} [blocks] block types it brings along (columns → column)
 * @property {MarkModule[]} [marks] marks it brings along (math → inline equations)
 * @property {(editor: Editor) => (() => void) | void} [mount] runs when the editor mounts; returns its cleanup
 */

/**
 * A mark: formatting over a range of text.
 * @typedef {object} MarkModule
 * @property {string} type unique mark type
 * @property {string[]} [tags] HTML tags that carry it; the first one renders it unless `view` is given
 * @property {(el: Element) => boolean} [match] finer test for pasted HTML than `tags`
 * @property {(mark: Mark) => HTMLElement} [view] the element that wraps marked text
 * @property {string} [shortcut] e.g. 'Mod-b'
 * @property {(editor: Editor) => boolean | void} [run] what the shortcut does (default: toggle the mark)
 * @property {RegExp} [markdown] typing rule, e.g. /\*\*([^*]+)\*\*$/
 * @property {string | string[] | ((mark: Mark) => [string, string])} [md] Markdown delimiter(s), or open/close for a mark with attributes
 * @property {[RegExp, (m: RegExpExecArray) => [string, Record<string, any>]]} [unmd] reads the attributed form back
 * @property {boolean} [inclusive] typing at its end continues it (default true)
 * @property {(mark: Mark) => boolean} [valid] refuses bad attributes (a link's href)
 * @property {{ label: string, title?: string, attr?: string, placeholder?: string }} [toolbar] selection-toolbar button
 * @property {(editor: Editor) => (() => void) | void} [mount] runs when the editor mounts; returns its cleanup
 */

/**
 * A framework-free UI module (menus, toolbars, drag & drop).
 * @typedef {object} UiModule
 * @property {string} name
 * @property {Record<string, (editor: Editor, e?: KeyboardEvent) => boolean | void>} [shortcuts]
 * @property {(editor: Editor) => (() => void) | void} [mount] runs when the editor mounts; returns its cleanup
 */

/**
 * Everything the modules contribute, by kind.
 * @typedef {{
 *   blocks: Record<string, BlockModule>,
 *   marks: Record<string, MarkModule & { rank: number }>,
 *   slash: Array<SlashEntry & { type: string }>,
 *   shortcuts: Record<string, { run: Function, owner: string }>,
 *   rules: Array<{ re: RegExp, to: Function, type: string }>,
 *   inline: Array<{ re: RegExp, type: string }>,
 * }} Registry
 */

/**
 * Collects module contributions; throws on duplicate types and conflicting shortcuts.
 * @param {BlockModule[]} blocks
 * @param {MarkModule[]} marks
 * @param {UiModule[]} ui
 * @param {Record<string, Function>} [shortcuts] core's own
 * @returns {Registry}
 */
export function registry(blocks, marks, ui, shortcuts = {}) {
  /** @type {Registry} */
  const r = { blocks: {}, marks: {}, slash: [], shortcuts: {}, rules: [], inline: [] };
  const key = (name, run, owner) => {
    if (r.shortcuts[name]) throw new Error(`Shortcut ${name} is claimed by both ${r.shortcuts[name].owner} and ${owner}`);
    r.shortcuts[name] = { run, owner };
  };
  const once = (map, m) => {
    if (map[m.type]) throw new Error(`"${m.type}" is registered twice`);
  };
  const mark = (m, i) => {
    once(r.marks, m);
    r.marks[m.type] = { rank: i, ...m };
    if (m.shortcut) key(m.shortcut, m.run ?? ((ed) => ed.toggleMark(m.type)), m.type);
    if (m.markdown) r.inline.push({ re: m.markdown, type: m.type });
  };
  const block = (m) => {
    once(r.blocks, m);
    r.blocks[m.type] = m;
    for (const e of [m.slash ?? []].flat()) r.slash.push({ type: m.type, ...e });
    for (const [name, run] of Object.entries(m.input?.shortcuts ?? {})) key(name, run, m.type);
    for (const [re, to] of m.input?.markdown ?? []) r.rules.push({ re, to, type: m.type });
    m.blocks?.forEach(block);
    m.marks?.forEach(mark);
  };
  for (const [name, run] of Object.entries(shortcuts)) key(name, run, 'core');
  for (const u of ui) for (const [name, run] of Object.entries(u.shortcuts ?? {})) key(name, run, u.name);
  blocks.forEach(block);
  marks.forEach(mark);
  return r;
}
