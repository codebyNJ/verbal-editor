// Plate core: the React editor with paragraphs only.
import { start } from './_plate.js';

export const packages = ['platejs'];
export const mount = (el, texts) => start(el, texts);
