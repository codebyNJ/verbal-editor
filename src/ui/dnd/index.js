/**
 * Drag & drop blocks (F-41) with Pointer Events — no HTML5 drag-and-drop, so it works with touch
 * and the drop target is exact. A handle follows the hovered block; a transform-positioned line
 * shows where it will land; release dispatches one transaction. Grabbing a selected block moves the
 * whole selection; the page scrolls near its edges; Esc cancels; a click on the handle selects.
 * ⌘⇧↑ / ⌘⇧↓ move blocks by keyboard, dragging across text or ⇧-clicking selects whole blocks, and
 * every reorder animates (FLIP).
 */
import s from './dnd.module.css';

const box = (el) => el.getBoundingClientRect();
/** The block host under the pointer. */
/** The block under the pointer; in the few pixels between two blocks, the nearest one above or below. */
const at = (e) => [0, -4, 4].reduce((hit, dy) => hit ?? document.elementFromPoint(e.clientX, e.clientY + dy)?.closest('[data-block]'), undefined);

/** Runs `move`, then slides each block from its old position to its new one with a CSS transition. */
function flip(editor, move) {
  const hosts = () => [...editor.view.root().querySelectorAll('[data-block]')];
  const top = new Map(hosts().map((h) => [h.dataset.block, box(h).top]));
  move();
  requestAnimationFrame(() => {
    for (const h of hosts()) {
      const dy = top.get(h.dataset.block) - box(h).top;
      if (!dy) continue;
      h.style.transition = 'none';
      h.style.translate = `0 ${dy}px`;
      box(h);
      h.style.transition = h.style.translate = '';
    }
  });
}

/** Moves the selected blocks one place up (-1) or down (1). */
function shift(editor, dir) {
  const ids = editor.selection?.blocks ?? [editor.range?.block];
  if (!ids[0]) return false;
  const t = editor.tx();
  const kids = t.get(t.parent(ids[0])).children;
  const [i, j] = [kids.indexOf(ids[0]), kids.indexOf(ids.at(-1))];
  if (i < 0 || j < 0 || !kids[i + dir] || !kids[j + dir]) return true;
  for (const id of dir < 0 ? ids : ids.toReversed()) t.move(id, t.parent(id), t.index(id) + dir);
  flip(editor, () => editor.dispatch(t, { selection: editor.selection }));
  return true;
}

/** @type {import('../../core/registry.js').UiModule} */
export default {
  name: 'dnd',
  shortcuts: { 'Mod-Shift-ArrowUp': (editor) => shift(editor, -1), 'Mod-Shift-ArrowDown': (editor) => shift(editor, 1) },
  mount(editor) {
    const root = editor.view.root();
    const handle = document.createElement('button');
    const line = document.createElement('div');
    handle.className = s.handle;
    handle.ariaLabel = 'Drag to move';
    handle.textContent = '⠿';
    line.className = s.line;
    document.body.append(handle, line);
    let scroller = root;
    while ((scroller = scroller.parentElement) && !/auto|scroll/.test(getComputedStyle(scroller).overflowY));
    let hover = null;
    let drag = null;
    let dest = null;
    let from = null;
    let last = null;
    /** Nearest movable block host under the pointer: not a table cell, not inside a dragged block. */
    const under = (e) => {
      for (let el = at(e); el; el = el.parentElement.closest('[data-block]'))
        if (!editor.mod(editor.parent(el.dataset.block))?.cells && !drag?.some((id) => editor.view.host(id).contains(el))) return el;
    };
    const show = (host) => {
      hover = host?.dataset.block;
      handle.hidden = !host;
      const r = host && box(host);
      if (r) handle.style.translate = `${Math.max(r.left - 24, 2)}px ${r.top + 2}px`;
    };
    const mark = (r, y) => {
      line.style.translate = `${r.left}px ${y}px`;
      line.style.width = `${r.width}px`;
    };
    /** Where a drop at the pointer lands: before or after the block under it, at the end of a column, or at the end of the page. */
    const target = (e) => {
      const raw = at(e);
      const col = raw?.dataset.block;
      if (editor.mod(col)?.container) {
        mark(box(raw), box(raw).bottom);
        return { parent: col, index: editor.get(col).children?.length ?? 0 };
      }
      const host = under(e);
      const top = editor.get(editor.doc.root).children;
      const end = box(editor.view.host(top.at(-1)));
      if (!host) return e.clientY > end.bottom && (mark(end, end.bottom), { parent: editor.doc.root, index: top.length });
      const id = host.dataset.block;
      const r = box(host);
      const after = e.clientY > r.top + Math.min(r.height, 32) / 2;
      mark(r, after ? r.bottom : r.top);
      const parent = editor.parent(id);
      return { parent, index: editor.get(parent).children.indexOf(id) + after };
    };
    /** While dragging, the page scrolls when the pointer nears its top or bottom edge. */
    const scroll = () => {
      if (!drag) return;
      const r = scroller ? box(scroller) : { top: 0, bottom: innerHeight };
      const dy = (last.clientY > r.bottom - 40) - (last.clientY < r.top + 40);
      if (dy) (scroller ?? document.scrollingElement).scrollBy(0, dy * 12), move(last);
      requestAnimationFrame(scroll);
    };
    const end = () => {
      for (const id of drag ?? []) delete editor.view.host(id)?.dataset.moving;
      line.hidden = true;
      drag = null;
    };
    const move = (e) => {
      if (drag) return void (line.hidden = !(dest = target((last = e))));
      if (from && e.buttons & 1) {
        const id = at(e)?.dataset.block;
        if (id && id !== from) {
          root.dataset.dragging = '';
          editor.select({ blocks: editor.span(from, id) });
        }
        return;
      }
      const r = hover && box(editor.view.host(hover));
      if (r && e.clientX < r.left && Math.abs(e.clientY - r.top - 14) < 16) return;
      if (e.pointerType === 'mouse') show(e.target.closest?.('[data-block]') && under(e));
    };
    handle.onpointerdown = (e) => {
      if (!hover) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const sel = editor.selection?.blocks;
      drag = sel?.includes(hover) ? sel : [hover];
      dest = null;
      last = e;
      for (const id of drag) editor.view.host(id).dataset.moving = '';
      requestAnimationFrame(scroll);
    };
    handle.onpointermove = (e) => drag && move(e);
    handle.onpointerup = handle.onpointercancel = (e) => {
      const ids = drag;
      if (!ids) return;
      end();
      if (e.type === 'pointercancel') return;
      if (!dest) return editor.select({ blocks: ids });
      // Each block goes where the drop line is, the next one right after it.
      const t = editor.tx();
      let i = dest.index;
      for (const id of ids) {
        if (t.parent(id) === dest.parent && t.index(id) < i) i--;
        if (t.parent(id) !== dest.parent || t.index(id) !== i) t.move(id, dest.parent, i);
        i++;
      }
      flip(editor, () => editor.dispatch(t, { selection: { blocks: ids } }));
    };
    const down = (e) => {
      const host = !e.button && e.target.closest('[data-content]')?.closest('[data-block]');
      const sel = editor.selection;
      const a = sel?.blocks?.[0] ?? sel?.anchor?.block;
      if (host && e.shiftKey && a && a !== host.dataset.block) {
        e.preventDefault();
        return editor.select({ blocks: editor.span(a, host.dataset.block) });
      }
      from = host?.dataset.block;
      if (e.pointerType !== 'mouse') show(under(e));
    };
    const up = () => {
      if (root.dataset.dragging != null) setTimeout(() => editor.select(editor.selection));
      from = null;
      delete root.dataset.dragging;
    };
    const hide = () => show(null);
    const ac = new AbortController();
    const { signal } = ac;
    root.addEventListener('pointerdown', down, { signal });
    root.addEventListener('pointermove', move, { signal });
    root.addEventListener('keydown', hide, { signal });
    addEventListener('keydown', (e) => drag && e.key === 'Escape' && (e.preventDefault(), end()), { signal, capture: true });
    addEventListener('pointerup', up, { signal });
    addEventListener('scroll', (e) => drag || hide(e), { signal, capture: true });
    line.hidden = handle.hidden = true;
    return () => (ac.abort(), handle.remove(), line.remove());
  },
};
