// Lexical core with plain text and history.
import { registerPlainText } from '@lexical/plain-text';
import { start } from './_lexical.js';

export const packages = ['lexical', '@lexical/plain-text', '@lexical/history'];
export const mount = (el, texts) => start(el, texts, { register: [registerPlainText] });
