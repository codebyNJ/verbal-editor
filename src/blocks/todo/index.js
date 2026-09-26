/**
 * To-do (F-21) — `checked` prop. The checkbox sits outside the editable region, so toggling it never moves
 * the caret. `[] ` / `[x] ` input rules, ⌘⏎ toggles. Markdown: `- [ ]` / `- [x]`.
 */
import s from './todo.module.css';

const toggle = (editor, id) => editor.dispatch(editor.tx().setProps(id, { checked: !editor.get(id).props.checked }));

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'todo',
  className: s.todo,
  schema: { props: { checked: Boolean }, content: 'inline' },
  create: (props) => ({ type: 'todo', props: { checked: false, ...props }, content: [] }),
  next: () => ({ type: 'todo' }),
  view: {
    create(b, editor) {
      const el = document.createElement('div');
      const box = el.appendChild(document.createElement('button'));
      box.type = 'button';
      box.role = 'checkbox';
      box.ariaLabel = 'Done';
      box.ariaChecked = b.props.checked;
      box.className = s.box;
      box.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>';
      box.onpointerdown = (e) => e.preventDefault();
      box.onclick = () => toggle(editor, box.closest('[data-block]').dataset.block);
      el.appendChild(document.createElement('div')).dataset.content = '';
      return el;
    },
    patch: (el, b) => ((el.firstChild.ariaChecked = b.props.checked), el),
  },
  input: {
    markdown: [[/^\[([ xX]?)\]\s$/, (m) => ({ type: 'todo', props: { checked: !!m[1].trim() } })]],
    keys: { 'Mod-Enter': (editor, { block }) => (toggle(editor, block), true) },
  },
  slash: { label: 'To-do', keywords: ['todo', 'task', 'checkbox'], icon: '▢' },
  parse: {
    tags: ['LI'],
    html: (el, box = el.querySelector('[type=checkbox]')) => box && { checked: box.checked },
    markdown: [/^[-*+]\s+\[([ xX])\]\s+(.*)$/, (m) => ({ props: { checked: m[1] !== ' ' }, text: m[2] })],
  },
  serialize: {
    markdown: (b, md) => `- [${b.props.checked ? 'x' : ' '}] ${md.inline(b.content)}`,
    html: (b, inner, kids) => `<ul><li><input type="checkbox"${b.props.checked ? ' checked' : ''}>${inner}${kids}</li></ul>`,
  },
};
