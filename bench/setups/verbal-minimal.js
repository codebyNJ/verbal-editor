// Verbal core: the editor, the React binding and paragraph — what `@verbal/editor` + `/react` ship.
import { start } from './_verbal.js';

export const packages = ['@verbal/editor', '@verbal/editor/react'];
export const mount = (el, texts) => start(el, texts);
