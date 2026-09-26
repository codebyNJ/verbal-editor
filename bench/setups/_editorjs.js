import EditorJS from '@editorjs/editorjs';
import { editorjs } from './_text.js';

export const start = (el, texts, tools = {}) => new EditorJS({ holder: el, tools, data: editorjs(texts) }).isReady;
