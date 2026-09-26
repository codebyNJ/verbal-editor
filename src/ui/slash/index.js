/**
 * Slash menu (F-40) — "/" opens a menu built from `registry.slash`: every module contributes its own
 * entries, so registering a module is all it takes to appear. Filters on label and keywords;
 * ↑ ↓ ⏎ Tab and Esc drive it. Choosing removes the "/query" text in the same undo step.
 * `menu()` is the same trigger menu for other characters (the emoji picker uses ":").
 */
import s from './slash.module.css';

/** @typedef {{ label: string, keywords?: string[], icon?: string }} Entry */

/** Entries matching `q`: label prefix first, then keyword prefix, then anywhere. */
const rank = (entries, q) =>
  entries
    .map((e) => {
      const words = [e.label, ...(e.keywords ?? [])].map((w) => w.toLowerCase());
      const score = words[0].startsWith(q) ? 3 : words.some((w) => w.startsWith(q)) ? 2 : words.some((w) => w.includes(q)) ? 1 : 0;
      return [score, e];
    })
    .filter(([score]) => score)
    .sort((a, b) => b[0] - a[0])
    .map(([, e]) => e);

/**
 * A menu that opens when `char` is typed at the start of a word, ranks `items(query)` as you type and
 * closes on whitespace with no match.
 * @param {import('../../index.js').Editor} editor
 * @param {{ char: string, label: string, items: (q: string) => Entry[] | Promise<Entry[]>, pick: (entry: Entry, t: any, at: { block: string, offset: number }) => void }} options
 *   `pick` runs with the "<char>query" text already deleted in `t`.
 * @returns {() => void} cleanup
 */
export function menu(editor, { char, label, items, pick }) {
  const el = document.createElement('div');
  el.className = s.menu;
  el.popover = 'manual';
  el.role = 'listbox';
  el.ariaLabel = label;
  document.body.append(el);
  let at = null;
  let list = [];
  let active = 0;
  const open = () => el.matches(':popover-open');
  const hide = () => open() && el.hidePopover();
  const close = () => ((at = null), hide());
  const render = () => {
    el.replaceChildren(
      ...list.map((e, i) => {
        const item = document.createElement('div');
        item.role = 'option';
        item.ariaSelected = i === active;
        item.innerHTML = `<i aria-hidden="true"></i><span></span>`;
        item.firstChild.textContent = e.icon ?? '';
        item.lastChild.textContent = e.label;
        item.onpointerdown = (ev) => ev.preventDefault();
        item.onclick = () => choose(e);
        item.onpointermove = () => active !== i && ((active = i), render());
        return item;
      }),
    );
    el.children[active]?.scrollIntoView({ block: 'nearest' });
  };
  const update = async () => {
    const r = editor.range;
    const text = r && at?.block === r.block && r.from === r.to && r.to > at.offset && editor.get(r.block).content.map((x) => x.text).join('').slice(at.offset, r.to);
    if (!text?.startsWith(char) || /\s\s|^.\s/.test(text)) return close();
    const q = text.slice(1).toLowerCase();
    const found = rank(await items(q), q).slice(0, 50);
    if (!at) return;
    list = found;
    if (!list.length) return /\s/.test(text) ? close() : hide();
    active = Math.min(active, list.length - 1);
    render();
    if (!open()) el.showPopover();
    const box = getSelection().getRangeAt(0).getBoundingClientRect();
    const v = visualViewport;
    const below = box.bottom + 8 + el.offsetHeight < v.offsetTop + v.height || box.top - el.offsetHeight - 6 < v.offsetTop;
    el.style.top = `${below ? box.bottom + 6 : box.top - el.offsetHeight - 6}px`;
    el.style.left = `${Math.min(box.left, innerWidth - el.offsetWidth - 8)}px`;
    el.style.transformOrigin = below ? 'top left' : 'bottom left';
  };
  const choose = (e) => {
    const from = at;
    const t = editor.tx().deleteText(from.block, from.offset, editor.range.to);
    close();
    editor.selection = { anchor: from, focus: from };
    pick(e, t, from);
  };
  const keys = {
    ArrowDown: () => ((active = (active + 1) % list.length), render()),
    ArrowUp: () => ((active = (active - 1 + list.length) % list.length), render()),
    Enter: () => choose(list[active]),
    Tab: () => choose(list[active]),
    Escape: close,
  };
  const offs = [
    editor.on('input', ({ id, data }) => {
      const r = editor.range;
      const before = r && editor.get(id).content.map((x) => x.text).join('')[r.to - 2];
      if (data === char && (!before || /\s/.test(before)) && editor.mod(id)?.schema?.content === 'inline') at = { block: id, offset: r.to - 1 };
      if (at) update();
    }),
    editor.on('selectionchange', () => at && update()),
    editor.on('key', ({ name }) => at && open() && keys[name] && (keys[name](), true)),
  ];
  const follow = () => at && update();
  addEventListener('scroll', close, true);
  visualViewport.addEventListener('resize', follow);
  return () => {
    offs.forEach((f) => f());
    removeEventListener('scroll', close, true);
    visualViewport.removeEventListener('resize', follow);
    el.remove();
  };
}

/** @type {import('../../core/registry.js').UiModule} */
export default {
  name: 'slash',
  mount: (editor) =>
    menu(editor, {
      char: '/',
      label: 'Insert block',
      items: () => editor.registry.slash,
      pick: (e, t) => (e.run ? e.run(editor, t) : editor.insert(e.type, e.props, t)),
    }),
};
