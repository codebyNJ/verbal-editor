// Tiptap StarterKit (headings, lists, quote, code block, marks, links, history) + to-dos, tables and images.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { html } from './_text.js';

export const packages = ['@tiptap/core', '@tiptap/pm', '@tiptap/starter-kit', '@tiptap/extension-list', '@tiptap/extension-table', '@tiptap/extension-image'];
export const mount = (el, texts) =>
  new Editor({ element: el, extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), TableKit, Image], content: html(texts) });
