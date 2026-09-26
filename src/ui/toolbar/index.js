/**
 * Selection toolbar — floats over a text selection with one button per registered mark (F-42).
 * Marks that carry an attribute (a link's href) get an inline field. Framework-free: a native
 * popover in the top layer, positioned inside the viewport.
 */
import s from './toolbar.module.css';

/** @type {import('../../core/registry.js').UiModule} */
export default {
  name: 'toolbar',
  mount(editor) {
    const bar = document.createElement('div');
    bar.className = s.bar;
    bar.popover = 'manual';
    bar.role = 'toolbar';
    bar.ariaLabel = 'Formatting';
    const marks = editor.registry.marks;
    for (const m of Object.values(marks).filter((m) => m.toolbar)) {
      const b = bar.appendChild(document.createElement('button'));
      b.type = 'button';
      b.textContent = m.toolbar.label;
      b.title = b.ariaLabel = m.toolbar.title;
      b.dataset.mark = m.type;
    }
    const field = bar.appendChild(document.createElement('input'));
    field.ariaLabel = 'URL';
    document.body.append(bar);
    let down = false;
    let editing = null;
    let saved = null;
    const open = () => bar.matches(':popover-open');
    const place = () => {
      if (editing) return;
      const sel = editor.selection;
      const ok = !down && sel?.anchor && sel.anchor.block === sel.focus.block && sel.anchor.offset !== sel.focus.offset;
      if (!ok || editor.mod(sel.focus.block)?.schema?.content === 'code' || !getSelection().rangeCount) return open() && bar.hidePopover();
      const r = getSelection().getRangeAt(0).getBoundingClientRect();
      if (!open()) bar.showPopover();
      for (const b of bar.querySelectorAll('button')) b.ariaPressed = editor.active(b.dataset.mark);
      // Above the selection with a mouse, below it on touch (clear of the native callout), flipped when
      // the preferred side leaves the visible viewport (on-screen keyboard included).
      const v = visualViewport;
      const y = [r.top - bar.offsetHeight - 8, r.bottom + 8];
      const fits = (t) => t > v.offsetTop + 8 && t + bar.offsetHeight < v.offsetTop + v.height - 8;
      let above = !matchMedia('(pointer: coarse)').matches;
      if (!fits(y[+!above]) && fits(y[+above])) above = !above;
      bar.style.top = `${y[+!above]}px`;
      bar.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - bar.offsetWidth / 2), innerWidth - bar.offsetWidth - 8)}px`;
      bar.style.transformOrigin = above ? 'bottom' : 'top';
    };
    /** The mark of `type` at the selection start, if any. */
    const current = (type) => {
      const { anchor, focus } = editor.selection;
      let pos = 0;
      for (const run of editor.get(focus.block).content) {
        if ((pos += run.text.length) > Math.min(anchor.offset, focus.offset)) return run.marks.find((m) => m.type === type);
      }
    };
    const ask = (m) => {
      place();
      if (!open()) return false;
      saved = editor.selection;
      editing = m;
      field.placeholder = m.toolbar.placeholder ?? '';
      field.value = current(m.type)?.[m.toolbar.attr] ?? '';
      field.ariaInvalid = false;
      bar.dataset.editing = '';
      field.focus();
      return true;
    };
    const close = () => {
      editing = null;
      delete bar.dataset.editing;
      editor.select(saved);
      place();
    };
    field.onkeydown = (e) => {
      if (e.key === 'Escape') e.preventDefault(), close();
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = field.value.trim();
      const value = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : v;
      editor.select(saved);
      if (editor.toggleMark(editing.type, value && { [editing.toolbar.attr]: value }, !!value)) return close();
      field.ariaInvalid = true;
      field.focus();
    };
    bar.onpointerdown = (e) => e.target !== field && e.preventDefault();
    bar.onclick = (e) => {
      const m = marks[e.target.dataset.mark];
      if (m) m.toolbar.attr ? ask(m) : editor.toggleMark(m.type);
    };
    const press = (e) => {
      down = e.type === 'pointerdown' && !bar.contains(e.target);
      if (down && editing) close();
      place();
    };
    const offs = [editor.on('selectionchange', place), editor.on('change', place), editor.on('prompt', (type) => marks[type]?.toolbar && ask(marks[type]))];
    for (const t of ['pointerdown', 'pointerup']) addEventListener(t, press, true);
    addEventListener('scroll', place, true);
    visualViewport.addEventListener('resize', place);
    return () => {
      offs.forEach((f) => f());
      for (const t of ['pointerdown', 'pointerup']) removeEventListener(t, press, true);
      removeEventListener('scroll', place, true);
      visualViewport.removeEventListener('resize', place);
      bar.remove();
    };
  },
};
