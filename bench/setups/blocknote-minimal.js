// BlockNote core: the block editor without its React UI.
import { BlockNoteEditor } from '@blocknote/core';
import '@blocknote/core/style.css';
import { blocks } from './_text.js';

export const packages = ['@blocknote/core'];
export const mount = (el, texts) => BlockNoteEditor.create({ initialContent: blocks(texts) }).mount(el);
