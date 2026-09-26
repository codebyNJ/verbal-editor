// React binding: React renders block hosts and child lists; each block subscribes to its own version (F-07).
import { createElement as h, memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Editor } from '../index.js';

/**
 * One Editor for the lifetime of the calling component.
 * @param {import('../index.js').EditorOptions} [options] @returns {Editor}
 */
export function useEditor(options) {
  return useState(() => new Editor(options))[0];
}

/**
 * A block's data, re-read only when its version bumps — structural or prop changes, never typing.
 * @param {Editor} editor @param {string} id @returns {import('../index.js').Block | undefined}
 */
export function useBlock(editor, id) {
  const subscribe = useCallback((fn) => editor.store.subscribe(id, fn), [editor, id]);
  const version = useSyncExternalStore(subscribe, () => editor.store.version(id));
  editor.options.onRender?.(id);
  return useMemo(() => editor.get(id), [editor, id, version]);
}

/** What a host draws: type, class, host attributes, child list. A prop the module patches in place changes none of them. */
const drawn = (editor, id) => {
  const b = editor.get(id);
  const mod = b && editor.registry.blocks[b.type];
  return b ? `${b.type} ${mod?.className} ${JSON.stringify(mod?.view?.host?.(b) ?? null)} ${b.children ?? ''}` : '';
};

const Block = memo(function Host({ editor, id }) {
  const subscribe = useCallback((fn) => editor.store.subscribe(id, fn), [editor, id]);
  useSyncExternalStore(subscribe, () => drawn(editor, id));
  editor.options.onRender?.(id);
  const b = editor.get(id);
  const ref = useCallback((el) => {
    editor.view.mount(id, el);
    return () => editor.view.unmount(id, el);
  }, [editor, id]);
  if (!b) return null;
  const mod = editor.registry.blocks[b.type];
  return h(
    'div',
    { ref, 'data-block': id, 'data-type': b.type, className: mod.className, ...mod.view?.host?.(b) },
    b.children && h('div', { 'data-children': '' }, b.children.map((c) => h(Block, { key: c, editor, id: c }))),
  );
});

/**
 * Renders the document; re-renders of the host app stop here. Everything inside a block's content element belongs to the core view.
 * @type {import('react').NamedExoticComponent<{ editor: Editor, className?: string }>}
 */
export const Blocks = memo(function Blocks({ editor, className }) {
  const root = useBlock(editor, editor.doc.root);
  const ref = useCallback((el) => {
    editor.mount(el);
    return () => editor.unmount();
  }, [editor]);
  return h('div', { ref, className, 'data-verbal': '' }, root.children.map((c) => h(Block, { key: c, editor, id: c })));
});
