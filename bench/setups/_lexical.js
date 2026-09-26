import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';

export function start(el, texts, { nodes = [], register = [] } = {}) {
  const editor = createEditor({ namespace: 'bench', nodes, onError: (e) => { throw e; } });
  editor.setRootElement(el);
  el.contentEditable = 'true';
  register.forEach((fn) => fn(editor));
  registerHistory(editor, createEmptyHistoryState(), 300);
  editor.update(() => $getRoot().append(...texts.map((t) => $createParagraphNode().append($createTextNode(t)))));
  return editor;
}
