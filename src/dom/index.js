// DOM binding: block hosts and child lists without a framework; each host re-renders only when its block's
// version bumps — structural or prop changes, never typing (the same contract as the React binding, F-07).

/**
 * Renders the editor into `element` with no framework. Returns the function that takes it out again.
 * @example
 * const editor = new Editor({ blocks: [heading] });
 * const stop = mount(editor, document.querySelector('#editor'));
 * @param {import('../index.js').Editor} editor @param {HTMLElement} element @returns {() => void}
 */
export function mount(editor, element) {
  /** @type {Map<string, { el: HTMLElement, kids?: HTMLElement, attrs: string[], styles: string[], off: () => void }>} */
  const hosts = new Map();

  const host = (id) => {
    if (!hosts.has(id)) {
      hosts.set(id, { el: document.createElement('div'), attrs: [], styles: [], off: editor.store.subscribe(id, () => paint(id)) });
      paint(id);
      editor.view.mount(id, hosts.get(id).el);
    }
    return hosts.get(id).el;
  };
  const drop = (id, el) => {
    const h = hosts.get(id);
    if (h?.el !== el) return;
    h.off();
    hosts.delete(id);
    editor.view.unmount(id, el);
    for (const c of h.kids?.children ?? []) drop(c.dataset.block, c);
  };
  /** Puts exactly these blocks' hosts in `box`, in order, reusing the ones already there. */
  const list = (box, ids) => {
    const want = ids.map(host);
    for (const el of [...box.children]) if (!want.includes(el)) drop(el.dataset.block, el), el.remove();
    want.forEach((el, i) => box.children[i] !== el && box.insertBefore(el, box.children[i] ?? null));
  };

  function paint(id) {
    const h = hosts.get(id);
    const b = editor.get(id);
    if (!h || !b) return;
    editor.options.onRender?.(id);
    const mod = editor.registry.blocks[b.type];
    const attrs = { 'data-block': id, 'data-type': b.type, class: mod.className, ...mod.view?.host?.(b) };
    // Only what this binding set before is cleared; attributes the view sets (data-selected) stay.
    h.attrs.forEach((a) => h.el.removeAttribute(a));
    h.styles.forEach((p) => h.el.style.removeProperty(p));
    const { style = {}, ...rest } = attrs;
    h.attrs = Object.keys(rest).filter((k) => rest[k] != null);
    h.styles = Object.keys(style);
    h.attrs.forEach((k) => h.el.setAttribute(k, rest[k]));
    h.styles.forEach((p) => h.el.style.setProperty(p, style[p]));
    if (b.children) {
      h.kids ??= h.el.appendChild(document.createElement('div'));
      h.kids.dataset.children = '';
      list(h.kids, b.children);
    } else if (h.kids) {
      for (const c of h.kids.children) drop(c.dataset.block, c);
      h.kids.remove();
      delete h.kids;
    }
  }

  const root = editor.doc.root;
  const top = () => (editor.options.onRender?.(root), list(element, editor.get(root).children));
  const off = editor.store.subscribe(root, top);
  element.dataset.verbal = '';
  top();
  editor.mount(element);
  return () => {
    off();
    editor.unmount();
    for (const el of [...element.children]) drop(el.dataset.block, el);
    element.replaceChildren();
  };
}
