// Editor.js with its official tools: headings, lists and to-dos, quotes, code, tables, images, embeds, dividers, inline code.
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Code from '@editorjs/code';
import Table from '@editorjs/table';
import SimpleImage from '@editorjs/simple-image';
import Embed from '@editorjs/embed';
import Delimiter from '@editorjs/delimiter';
import InlineCode from '@editorjs/inline-code';
import { start } from './_editorjs.js';

export const packages = ['@editorjs/editorjs', '@editorjs/header', '@editorjs/list', '@editorjs/quote', '@editorjs/code', '@editorjs/table', '@editorjs/simple-image', '@editorjs/embed', '@editorjs/delimiter', '@editorjs/inline-code'];
export const mount = (el, texts) =>
  start(el, texts, { header: Header, list: List, quote: Quote, code: Code, table: Table, image: SimpleImage, embed: Embed, delimiter: Delimiter, inlineCode: InlineCode });
