/**
 * Equations (F-34) — LaTeX compiled to MathML that the browser renders itself: no JS renderer, no
 * fonts. Block mode is a void block edited in a popover with live preview (click it, or Enter when
 * selected); inline mode is a `math` mark whose text is the source, shown rendered until the caret
 * enters it. Unsupported commands show a visible error. Markdown: `$$…$$` and `$…$`.
 */
import { latex } from './latex.js';
import s from './math.module.css';

/** Renders LaTeX into an element, with any errors spelled out underneath. */
function render(el, src) {
  const { mathml, errors } = latex(src, true);
  el.innerHTML = src.trim() ? mathml : `<span class="${s.empty}">Empty equation — click to edit</span>`;
  if (errors.length) el.insertAdjacentHTML('beforeend', `<p class="${s.error}" role="alert"></p>`), (el.lastChild.textContent = errors.join(' · '));
}

/** Opens the LaTeX editor under a math block; Enter commits, Esc restores. */
function edit(editor, id) {
  const el = editor.view.el(id);
  const old = editor.get(id)?.props.latex ?? '';
  if (!el?.isConnected) return;
  const pop = document.createElement('div');
  pop.popover = 'manual';
  pop.className = s.pop;
  pop.innerHTML = '<textarea aria-label="LaTeX" spellcheck="false" rows="3"></textarea><button type="button">Done ⏎</button>';
  document.body.append(pop);
  pop.showPopover();
  /** Sits under the equation, following it as the preview grows. */
  const place = () => {
    const r = el.getBoundingClientRect();
    Object.assign(pop.style, { top: `${Math.min(r.bottom + 6, visualViewport.offsetTop + visualViewport.height - pop.offsetHeight - 8)}px`, left: `${Math.max(8, r.left + r.width / 2 - pop.offsetWidth / 2)}px` });
  };
  place();
  const [area, button] = pop.children;
  area.value = old;
  area.focus();
  const done = (commit) => {
    pop.remove();
    if (commit && area.value !== old) editor.dispatch(editor.tx().setProps(id, { latex: area.value }), { selection: { blocks: [id] } });
    else render(el, old), editor.select({ blocks: [id] });
  };
  area.oninput = () => (render(el, area.value), place());
  area.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(), done(true);
    if (e.key === 'Escape') e.preventDefault(), done(false);
  };
  button.onpointerdown = (e) => e.preventDefault();
  button.onclick = () => done(true);
}

/** Inline equations: the run's text is the LaTeX source. */
const inline = {
  type: 'math',
  tags: ['SPAN'],
  match: (el) => el.dataset?.math != null,
  inclusive: false,
  markdown: /(?<!\$)\$([^$\n]+)\$$/,
  md: '$',
  toolbar: { label: '∑', title: 'Inline equation' },
  view() {
    const el = document.createElement('span');
    el.className = s.inline;
    el.dataset.math = '';
    return el;
  },
};

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'math',
  className: s.math,
  schema: { props: { latex: String }, content: 'none' },
  create: (props) => ({ type: 'math', props: { latex: '', ...props } }),
  marks: [inline],
  view: {
    create(b, editor) {
      const el = document.createElement('div');
      el.onclick = () => edit(editor, el.closest('[data-block]').dataset.block);
      render(el, b.props.latex);
      return el;
    },
    patch: (el, b) => (render(el, b.props.latex), el),
  },
  input: {
    markdown: [[/^\$\$\s$/, () => ({ type: 'math' })]],
    keys: { Enter: (editor, { block }) => !!editor.selection?.blocks && (edit(editor, block), true) },
  },
  slash: { label: 'Equation', keywords: ['math', 'latex', 'formula', 'tex'], icon: '∑' },
  parse: {
    lines(lines, i) {
      const one = /^\s*\$\$(.+)\$\$\s*$/.exec(lines[i]);
      if (one) return [{ type: 'math', props: { latex: one[1].trim() } }, i];
      if (!/^\s*\$\$\s*$/.test(lines[i])) return;
      let j = i + 1;
      while (j < lines.length && !/^\s*\$\$\s*$/.test(lines[j])) j++;
      return [{ type: 'math', props: { latex: lines.slice(i + 1, j).join('\n') } }, j];
    },
  },
  serialize: { markdown: (b) => `$$\n${b.props.latex}\n$$`, html: (b) => latex(b.props.latex, true).mathml },
  /** Keeps inline equations rendered: each gets a skipped island holding its MathML. */
  mount(editor) {
    const root = editor.view.root();
    const decorate = () => {
      for (const span of root.querySelectorAll('[data-content] [data-math]')) {
        const src = [...span.childNodes].map((n) => (n.nodeType === 3 ? n.data : '')).join('');
        let isle = span.querySelector(':scope > [data-skip]');
        if (isle?.dataset.src === src) continue;
        isle ??= span.appendChild(Object.assign(document.createElement('span'), { contentEditable: 'false' }));
        isle.dataset.skip = '';
        isle.dataset.src = src;
        isle.innerHTML = latex(src).mathml;
      }
    };
    const watch = new MutationObserver(decorate);
    watch.observe(root, { childList: true, subtree: true, characterData: true });
    decorate();
    const offs = [
      editor.on('selectionchange', () => {
        for (const span of root.querySelectorAll('[data-math]')) span.classList.toggle(s.editing, span.contains(getSelection().anchorNode));
      }),
      // A new empty equation — from "/equation" or "$$ " — opens its editor; undo and redo never do.
      editor.on('change', ({ ops, origin }) => {
        for (const o of origin === 'history' ? [] : ops) if (o.op === 'insertBlock' && o.block.type === 'math' && !o.block.props?.latex) requestAnimationFrame(() => edit(editor, o.id));
      }),
    ];
    return () => (watch.disconnect(), offs.forEach((f) => f()));
  },
};
