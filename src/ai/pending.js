/**
 * AI edits as a reviewable diff (F-50…F-53). A proposal is a valid but uncommitted transaction: the
 * document is untouched until you accept. Deleted words are painted over the real text with the
 * Custom Highlight API; the proposal sits beside the block with its insertions highlighted. Accept or
 * reject everything (⌘⏎ / Esc) or hunk by hunk; an accepted edit is one ordinary undo step.
 */
import { diffWords, hunks } from './diff.js';
import s from './pending.module.css';

const text = (b) => b.content.map((r) => r.text).join('');
const highlight = (kind) => {
  const name = `verbal-${kind}`;
  if (!CSS.highlights.has(name)) CSS.highlights.set(name, new Highlight());
  return CSS.highlights.get(name);
};
const point = (el, o) => {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); o -= n.length) if (o <= n.length) return [n, o];
  return [el, 0];
};
/** The marks typing at `at` would get: those of the character before it. */
const marksAt = (b, at) => {
  let pos = 0;
  for (const r of b.content) if ((pos += r.text.length) >= at && at) return r.marks;
  return [];
};

/**
 * Proposes new text for blocks and shows it as a diff until accepted or rejected.
 * @param {object} editor the Editor
 * @param {Record<string, string>} changes block id → proposed text
 * @returns {{ done: Promise<void>, preview: () => Record<string, string>, accept: () => true, reject: () => true }}
 */
export function review(editor, changes) {
  const targets = new Map(Object.entries(changes).filter(([id]) => editor.get(id)?.content));
  const panels = new Map();
  let ranges = [];
  let finish;

  /** The uncommitted transaction for one hunk, or all of them. */
  const build = (only) => {
    const t = editor.tx();
    for (const [id, target] of targets) {
      const list = hunks(diffWords(text(t.get(id)), target));
      for (let i = list.length - 1; i >= 0; i--) {
        const h = list[i];
        if (!only || (only[0] === id && only[1] === i))
          t.deleteText(id, h.at, h.at + h.del.length).insertText(id, h.at, h.ins, marksAt(t.get(id), h.at));
      }
    }
    return t;
  };
  const add = (kind, r) => {
    highlight(kind).add(r);
    ranges.push([highlight(kind), r]);
  };
  const panel = (id) => {
    const el = document.createElement('div');
    el.className = s.panel;
    el.innerHTML = `<div></div><footer><span>Suggested edit</span><button data-all="accept">Accept <kbd>⌘⏎</kbd></button><button data-all="reject">Reject <kbd>Esc</kbd></button></footer>`;
    el.onpointerdown = (e) => e.preventDefault();
    el.onclick = (e) => {
      const b = e.target.closest('button');
      const hunk = b?.parentElement.dataset.hunk;
      if (b?.dataset.all) return api[b.dataset.all]();
      if (!b) return;
      const parts = diffWords(text(editor.get(id)), targets.get(id));
      if (b.dataset.ok) editor.dispatch(build([id, +hunk]), { selection: editor.selection });
      else targets.set(id, parts.filter((p) => p.op === '=' || (p.op === '-') === (p.hunk === +hunk)).map((p) => p.text).join('')), paint();
    };
    return el;
  };
  const paint = () => {
    for (const [h, r] of ranges) h.delete(r);
    ranges = [];
    for (const [id, target] of targets) {
      const b = editor.get(id);
      const parts = b && diffWords(text(b), target);
      if (!parts?.some((p) => p.op !== '=')) {
        targets.delete(id);
        panels.get(id)?.remove();
        continue;
      }
      if (!panels.has(id)) panels.set(id, panel(id));
      const el = panels.get(id);
      editor.view.el(id).after(el);
      const content = editor.view.content(id);
      const body = el.firstChild;
      body.replaceChildren();
      let at = 0;
      parts.forEach((p, i) => {
        if (p.op === '-') {
          const r = new Range();
          r.setStart(...point(content, at));
          r.setEnd(...point(content, at + p.text.length));
          add('del', r);
        } else {
          const n = body.appendChild(document.createTextNode(p.text));
          if (p.op === '+') add('ins', new StaticRange({ startContainer: n, startOffset: 0, endContainer: n, endOffset: p.text.length }));
        }
        if (p.op !== '+') at += p.text.length;
        if (p.op !== '=' && parts[i + 1]?.hunk !== p.hunk) {
          const ctl = body.appendChild(document.createElement('span'));
          ctl.className = s.hunk;
          ctl.dataset.hunk = p.hunk;
          ctl.innerHTML = '<button data-ok="1" title="Accept this change">✓</button><button title="Reject this change">✕</button>';
        }
      });
    }
    if (!targets.size) close();
  };
  /** The keys also work with focus outside the document (on the button that asked for the review), unless it is in a field. */
  const idle = (e) => {
    const f = document.activeElement;
    if (e.defaultPrevented || f.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' ? api.accept() : e.key === 'Escape' && api.reject()) e.preventDefault();
  };
  addEventListener('keydown', idle);
  const offs = [
    editor.on('change', paint),
    editor.on('key', ({ name }) => (name === 'Mod-Enter' ? api.accept() : name === 'Escape' && api.reject())),
    () => removeEventListener('keydown', idle),
  ];
  const close = () => {
    offs.forEach((f) => f());
    for (const [h, r] of ranges) h.delete(r);
    panels.forEach((el) => el.remove());
    targets.clear();
    finish?.();
  };
  const api = {
    /** Resolves once every hunk is accepted or rejected. */
    done: new Promise((resolve) => (finish = resolve)),
    /** The document text each block would have if accepted now. */
    preview: () => Object.fromEntries([...targets.keys()].map((id) => [id, text(build().doc.blocks[id])])),
    accept() {
      const t = build();
      close();
      editor.dispatch(t, { selection: editor.selection });
      return true;
    },
    reject: () => (close(), true),
  };
  paint();
  return api;
}
