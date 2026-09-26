// Plate with its first-party plugins: blocks and marks, lists and to-dos, tables, code, links, images.
import { BasicBlocksPlugin, BasicMarksPlugin } from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list/react';
import { TablePlugin } from '@platejs/table/react';
import { CodeBlockPlugin } from '@platejs/code-block/react';
import { LinkPlugin } from '@platejs/link/react';
import { ImagePlugin } from '@platejs/media/react';
import { start } from './_plate.js';

export const packages = ['platejs', '@platejs/basic-nodes', '@platejs/list', '@platejs/table', '@platejs/code-block', '@platejs/link', '@platejs/media'];
export const mount = (el, texts) => start(el, texts, [BasicBlocksPlugin, BasicMarksPlugin, ListPlugin, TablePlugin, CodeBlockPlugin, LinkPlugin, ImagePlugin]);
