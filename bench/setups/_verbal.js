import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '../../dist/index.js';
import { Blocks } from '../../dist/react.js';
import '../../dist/tokens.css';
import { verbal } from './_text.js';

/** Counts React renders of editor blocks, so the harness can report renders per keystroke. */
export function start(el, texts, modules = {}) {
  window.__renders = 0;
  const editor = new Editor({ ...modules, doc: verbal(texts), onRender: () => window.__renders++ });
  createRoot(el).render(createElement(Blocks, { editor }));
}
