// The only core file that touches the DOM: content elements, input routing, selection mapping (F-04, F-05).
import { nest, norm, sortMarks, text } from './model.js';
import { caret } from './selection.js';

/** Input types the browser performs itself; the model reads the result back silently (D-3). */
const PASS = /^(insertText|deleteContentBackward|\w*Composition\w*)$/;

/** Normalized key name such as "Mod-Shift-z", "Enter" or "ArrowUp". */
function keyName(e) {
  const mac = /Mac|iP/.test(navigator.platform);
  const k = /^(Key|Digit)(.)$/.exec(e.code)?.[2].toLowerCase() ?? e.key;
  return `${(mac ? e.metaKey : e.ctrlKey) ? 'Mod-' : ''}${mac && e.ctrlKey ? 'Ctrl-' : ''}${e.altKey ? 'Alt-' : ''}${e.shiftKey ? 'Shift-' : ''}${k}`;
}


export function view(editor) {
  const views = new Map();
  const hosts = new Map();
  const ours = new WeakSet();
  const off = [];
  let root;
  let want;
  let before;
  const reg = () => editor.registry;
  const el = (n) => (n?.nodeType === 1 ? n : n?.parentElement);
  const contentOf = (n) => el(n)?.closest('[data-content]');
  const idOf = (n) => el(n)?.closest('[data-block]')?.dataset.block;

  /** Text nodes that count toward model offsets (islands marked data-skip do not). */
  function texts(content) {
    const out = [];
    const w = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) if (n.parentElement.closest('[data-skip],[data-content]') === content) out.push(n);
    return out;
  }

  function markOf(node) {
    for (const m of Object.values(reg().marks)) if (m.match?.(node) ?? m.tags?.includes(node.tagName)) return { type: m.type, ...m.attrs?.(node) };
  }

  const marksAt = (n, top) => {
    const marks = [];
    for (let p = n.parentElement; p && p !== top; p = p.parentElement) {
      const m = markOf(p);
      if (m && !marks.some((x) => x.type === m.type)) marks.push(m);
    }
    return sortMarks(marks);
  };
  /** Runs as the browser left them. */
  const read = (content) => norm(texts(content).map((n) => ({ text: n.data, marks: marksAt(n, content) })));

  /** Canonical markup for runs: identical in every engine, never execCommand (F-10, D-12). */
  function paint(content, runs) {
    const at = [document.createDocumentFragment()];
    const add = (node) => (ours.add(node), at.at(-1).append(node), node);
    nest(runs, (m) => reg().marks[m.type]?.rank ?? 0, {
      open: (m) => at.push(add(reg().marks[m.type].view?.(m) ?? document.createElement(reg().marks[m.type].tags[0]))),
      close: () => at.pop(),
      text: (t) => at.at(-1).append(t),
    });
    if (text(runs).endsWith('\n')) add(document.createElement('br'));
    content.replaceChildren(at[0]);
  }
  const tidy = (content) => [...content.querySelectorAll('*')].every((n) => ours.has(n) || n.closest('[data-skip]'));

  const SKIP = /^(SCRIPT|STYLE|TEMPLATE)$/;
  const BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|D[DLT]|DIV|FIGURE|FOOTER|H\d|HEADER|LI|MAIN|NAV|OL|P|PRE|SECTION|T(ABLE|BODY|HEAD|R|D|H)|UL)$/;
  /** Inline runs under a node, stopping at nested block elements. */
  const runsIn = (n, top, out = []) => {
    if (n.nodeType === 3) out.push({ text: n.parentElement.closest('pre') ? n.data : n.data.replace(/\s+/g, ' '), marks: marksAt(n, top) });
    else if (n.nodeName === 'BR') out.push({ text: '\n', marks: [] });
    else if (n.nodeType === 1 && !SKIP.test(n.nodeName)) for (const c of n.childNodes) if (!(c.nodeType === 1 && BLOCK.test(c.tagName))) runsIn(c, top, out);
    return out;
  };
  /** Pasted HTML → block literals through each module's parse rules, in an inert document. @param {string} html @returns {object[] | null} */
  function parseHTML(html) {
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    const raw = body.querySelector('[data-verbal]')?.dataset.verbal;
    if (raw) return JSON.parse(raw);
    const walk = (el, list) => {
      let para = null;
      for (const n of el.childNodes) {
        if (SKIP.test(n.nodeName)) continue;
        let props;
        const mod = n.nodeType === 1 && Object.values(reg().blocks).find((m) => m.parse?.tags?.includes(n.tagName) && (props = m.parse.html ? m.parse.html(n) : {}));
        if (mod) {
          const b = { type: mod.type, props, content: runsIn(n, body), children: [] };
          for (const c of n.children) if (BLOCK.test(c.tagName)) walk(c, b.children);
          list.push(b);
          para = null;
        } else if (n.nodeType === 1 && [n, ...n.children].some((c) => BLOCK.test(c.tagName))) {
          walk(n, list);
          para = null;
        } else if (n.textContent.trim()) {
          if (!para) list.push((para = { type: 'paragraph', content: [] }));
          runsIn(n, body, para.content);
        }
      }
      return list;
    };
    return walk(body, []);
  }

  function offsetOf(content, node, off) {
    const at = document.createRange();
    at.setStart(node, off);
    let n = 0;
    for (const t of texts(content)) {
      if (t === node) return n + off;
      if (at.comparePoint(t, t.length) > 0) return n;
      n += t.length;
    }
    return n;
  }
  function domAt(content, off) {
    for (const t of texts(content)) {
      if (off <= t.length) return [t, off];
      off -= t.length;
    }
    return [content, 0];
  }
  const pointOf = (node, off) => {
    const c = contentOf(node);
    return c && root?.contains(c) ? { block: idOf(c), offset: offsetOf(c, node, off) } : null;
  };
  /** DOM selection → model selection. @returns {import('./selection.js').Selection | null} */
  function readSelection() {
    const s = getSelection();
    const anchor = s.rangeCount && pointOf(s.anchorNode, s.anchorOffset);
    const focus = anchor && pointOf(s.focusNode, s.focusOffset);
    return focus ? { anchor, focus } : null;
  }

  /** Model selection → DOM; waits for the block to mount when it is not in the DOM yet. @param {import('./selection.js').Selection | null} sel */
  function select(sel) {
    want = null;
    for (const h of root?.querySelectorAll('[data-selected]') ?? []) delete h.dataset.selected;
    if (!sel || !root) return;
    if (sel.blocks) {
      getSelection().removeAllRanges();
      root.focus({ preventScroll: true });
      for (const id of sel.blocks) if (hosts.get(id)) hosts.get(id).dataset.selected = '';
      hosts.get(sel.blocks.at(-1))?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const a = views.get(sel.anchor.block)?.content;
    const f = views.get(sel.focus.block)?.content;
    if (!a?.isConnected || !f?.isConnected) return void (want = sel);
    if (document.activeElement !== f) f.focus();
    getSelection().setBaseAndExtent(...domAt(a, sel.anchor.offset), ...domAt(f, sel.focus.offset));
  }

  function create(id) {
    const b = editor.get(id);
    const mod = reg().blocks[b.type];
    const node = mod.view?.create?.(b, editor) ?? null;
    const content = node && b.content && (node.querySelector('[data-content]') ?? node);
    if (content) {
      content.dataset.content = '';
      content.contentEditable = `${editor.options.editable !== false}`;
      content.spellcheck = mod.schema?.content !== 'code';
      if (mod.placeholder) content.dataset.placeholder = mod.placeholder;
      paint(content, b.content);
    }
    mod.view?.text?.(node, b, editor);
    return { el: node, content, block: b };
  }

  /** Re-renders a block's content from the model (undo, marks, commands — never plain typing). @param {string} id */
  function repaint(id) {
    const v = views.get(id);
    if (!v?.content) return;
    v.block = editor.get(id);
    paint(v.content, v.block.content);
    reg().blocks[v.block.type].view?.text?.(v.el, v.block, editor);
  }

  /** Props or type changed: let the module patch its element, or recreate it. @param {string} id */
  function update(id) {
    const v = views.get(id);
    const b = editor.get(id);
    if (!v || !b || v.block === b) return;
    const patched = v.block.type === b.type && reg().blocks[b.type].view?.patch?.(v.el, b, v.block, editor) !== null;
    if (patched) return void (v.block = b);
    const next = create(id);
    views.set(id, next);
    if (v.el?.isConnected) v.el.replaceWith(next.el ?? '');
    else if (next.el) hosts.get(id)?.prepend(next.el);
  }

  /** Called by the binding when a block host enters the DOM. @param {string} id @param {HTMLElement} host */
  function mount(id, host) {
    hosts.set(id, host);
    let v = views.get(id);
    if (!v) views.set(id, (v = create(id)));
    const moved = v.el && v.el.parentNode !== host;
    if (moved) host.prepend(v.el);
    if (editor.selection?.blocks?.includes(id)) host.dataset.selected = '';
    if (want && [want.focus?.block, want.anchor?.block].includes(id)) select(want);
    else if (moved && editor.selection?.focus?.block === id) select(editor.selection);
  }

  function sync(content) {
    const id = idOf(content);
    const b = editor.get(id);
    if (!b?.content) return;
    const code = reg().blocks[b.type].schema?.content === 'code';
    const runs = code ? norm(read(content).map((r) => ({ text: r.text, marks: [] }))) : read(content);
    const after = readSelection();
    editor.input(id, runs, before, after);
    before = null;
    const now = editor.get(id);
    if (!now || !views.get(id)) return;
    const same = (a) => JSON.stringify(now.content) === JSON.stringify(a);
    if (!tidy(content) || (!same(runs) && !same(read(content)))) {
      paint(content, now.content);
      select(editor.selection);
    }
    views.get(id).block = now;
    reg().blocks[now.type].view?.text?.(views.get(id).el, now, editor);
  }

  /** selectionchange is async; key handling must see where the caret is now. */
  const refresh = () => {
    const s = readSelection();
    if (s && JSON.stringify(s) !== JSON.stringify(editor.selection)) editor.selected(s);
  };

  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    off.push(() => target.removeEventListener(type, fn));
  };

  /** @param {HTMLElement} node */
  function attach(node) {
    root = node;
    root.tabIndex = -1;
    if (editor.options.editable === false) root.dataset.readonly = '';
    on(root, 'beforeinput', (e) => {
      const t = e.inputType;
      if (PASS.test(t)) {
        before ??= readSelection();
        const at = t === 'deleteContentBackward' && before;
        if (at && at.anchor.offset === 0 && at.focus.offset === 0 && editor.key('Backspace')) e.preventDefault();
        return;
      }
      e.preventDefault();
      refresh();
      const r = e.getTargetRanges?.()[0];
      const range = r && { from: pointOf(r.startContainer, r.startOffset), to: pointOf(r.endContainer, r.endOffset) };
      const dt = e.dataTransfer;
      editor.inputType(t, range, e.data ?? dt?.getData('text/plain'), dt && { html: dt.getData('text/html'), text: dt.getData('text/plain') });
    });
    on(root, 'input', (e) => !e.isComposing && contentOf(e.target) && sync(contentOf(e.target)));
    const clip = (e, cut) => {
      refresh();
      const data = editor.copy(cut);
      if (!data) return;
      e.preventDefault();
      e.clipboardData.setData('text/html', data.html);
      e.clipboardData.setData('text/plain', data.text);
    };
    on(root, 'copy', (e) => clip(e, false));
    on(root, 'cut', (e) => clip(e, true));
    on(root, 'paste', (e) => {
      e.preventDefault();
      refresh();
      const c = e.clipboardData;
      editor.paste({ html: c.getData('text/html'), text: c.getData('text/plain'), files: [...c.files] });
    });
    on(root, 'compositionstart', () => (before = readSelection()));
    on(root, 'compositionend', (e) => contentOf(e.target) && sync(contentOf(e.target)));
    on(root, 'keydown', (e) => {
      if (e.isComposing || e.keyCode === 229 || (e.target !== root && !contentOf(e.target))) return;
      refresh();
      if (editor.key(keyName(e), e)) e.preventDefault();
    });
    on(root, 'pointerdown', (e) => {
      const id = idOf(e.target);
      if (id && root.dataset.readonly == null && !contentOf(e.target) && !e.target.closest('button,input,select,textarea,a,[contenteditable]') && !editor.get(id)?.content)
        editor.select({ blocks: [id] });
    });
    on(document, 'selectionchange', () => {
      const s = readSelection();
      if (root.dataset.dragging == null && (s || !editor.selection?.blocks)) {
        if (s) for (const h of root.querySelectorAll('[data-selected]')) delete h.dataset.selected;
        editor.selected(s);
      }
    });
  }

  /** Whether a collapsed caret sits on the first (up) or last (down) line of its block. @param {'up' | 'down'} dir @returns {boolean} */
  function edge(dir) {
    const s = getSelection();
    const c = s.isCollapsed && contentOf(s.focusNode);
    if (!c) return false;
    const r = s.getRangeAt(0).getClientRects()[0];
    if (!r) return true;
    const box = c.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(c).lineHeight) || r.height;
    return dir === 'up' ? r.top - box.top < lh * 0.8 : box.bottom - r.bottom < lh * 0.8;
  }

  /** Puts the caret in block `id` at client x, on its first line (top) or last line. @param {string} id @param {number} x @param {boolean} top */
  function caretAt(id, x, top) {
    const c = views.get(id)?.content;
    if (!c) return;
    c.scrollIntoView({ block: 'nearest' });
    const box = c.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(c).lineHeight) || 20;
    const hit = x != null && document.caretPositionFromPoint(x, top ? box.top + lh / 2 : box.bottom - lh / 2);
    editor.select(caret(id, hit && c.contains(hit.offsetNode) ? offsetOf(c, hit.offsetNode, hit.offset) : top ? 0 : editor.len(id)));
  }

  return {
    attach,
    detach: () => off.splice(0).forEach((f) => f()),
    mount,
    /** @param {string} id @param {HTMLElement} host */
    unmount: (id, host) => hosts.get(id) === host && hosts.delete(id),
    repaint,
    update,
    /** @param {string} id */
    drop: (id) => views.delete(id),
    reset() {
      for (const v of views.values()) v.el?.remove();
      views.clear();
      for (const [id, host] of hosts) if (editor.get(id)) mount(id, host);
    },
    select,
    read: readSelection,
    edge,
    caretAt,
    /** @returns {number | undefined} */
    caretX: () => getSelection().rangeCount && getSelection().getRangeAt(0).getClientRects()[0]?.left,
    parseHTML,
    /** A block's editable text element. @param {string} id @returns {HTMLElement | undefined} */
    content: (id) => views.get(id)?.content,
    /** A block's own element (its view). @param {string} id @returns {HTMLElement | undefined} */
    el: (id) => views.get(id)?.el,
    /** A block's host element (rendered by the binding). @param {string} id @returns {HTMLElement | undefined} */
    host: (id) => hosts.get(id),
    /** The editor's root element. @returns {HTMLElement} */
    root: () => root,
  };
}
