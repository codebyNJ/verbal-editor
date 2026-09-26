// Lexical rich text: headings, quotes, lists and to-dos, code, tables, links and Markdown shortcuts.
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { ListItemNode, ListNode, registerList, registerCheckList } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { TableCellNode, TableNode, TableRowNode, registerTablePlugin } from '@lexical/table';
import { TRANSFORMERS, registerMarkdownShortcuts } from '@lexical/markdown';
import { start } from './_lexical.js';

export const packages = ['lexical', '@lexical/rich-text', '@lexical/history', '@lexical/list', '@lexical/code', '@lexical/link', '@lexical/table', '@lexical/markdown', '@lexical/utils'];
export const mount = (el, texts) =>
  start(el, texts, {
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode, AutoLinkNode, TableNode, TableRowNode, TableCellNode],
    register: [registerRichText, registerList, registerCheckList, registerTablePlugin, (e) => registerMarkdownShortcuts(e, TRANSFORMERS)],
  });
