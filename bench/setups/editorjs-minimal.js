// Editor.js core, which ships the paragraph tool.
import { start } from './_editorjs.js';

export const packages = ['@editorjs/editorjs'];
export const mount = (el, texts) => start(el, texts);
