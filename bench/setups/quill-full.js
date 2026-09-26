// Quill as documented: every format, the toolbar and the Snow theme.
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { html } from './_text.js';

export const packages = ['quill'];
export function mount(el, texts) {
  el.innerHTML = html(texts);
  return new Quill(el, { theme: 'snow' });
}
