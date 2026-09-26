// Quill core: the editor without its formats, modules or themes.
import Quill from 'quill/core';
import 'quill/dist/quill.core.css';

export const packages = ['quill (core)'];
import { html } from './_text.js';
export function mount(el, texts) {
  el.innerHTML = html(texts);
  return new Quill(el);
}
