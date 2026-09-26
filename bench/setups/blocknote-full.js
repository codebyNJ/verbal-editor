// BlockNote as documented: the React view with its Mantine UI (menus, toolbars, side menu).
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BlockNoteEditor } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { blocks } from './_text.js';

export const packages = ['@blocknote/core', '@blocknote/react', '@blocknote/mantine', '@mantine/core', '@mantine/hooks'];
export function mount(el, texts) {
  const editor = BlockNoteEditor.create({ initialContent: blocks(texts) });
  createRoot(el).render(createElement(BlockNoteView, { editor }));
}
