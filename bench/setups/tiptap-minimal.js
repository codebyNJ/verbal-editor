// Tiptap core with the three nodes a document needs: document, paragraph, text.
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

export const packages = ['@tiptap/core', '@tiptap/pm', '@tiptap/extension-document', '@tiptap/extension-paragraph', '@tiptap/extension-text'];
import { html } from './_text.js';
export const mount = (el, texts) => new Editor({ element: el, extensions: [Document, Paragraph, Text], content: html(texts) });
