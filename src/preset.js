// Every module: the full-weight configuration (PRD §5, 31.5KB budget).
import chart from './blocks/chart/index.js';
import codeBlock from './blocks/code/index.js';
import columns from './blocks/columns/index.js';
import divider from './blocks/divider/index.js';
import embed from './blocks/embed/index.js';
import heading from './blocks/heading/index.js';
import image from './blocks/image/index.js';
import list from './blocks/list/index.js';
import math from './blocks/math/index.js';
import quote from './blocks/quote/index.js';
import table from './blocks/table/index.js';
import todo from './blocks/todo/index.js';
import bold from './marks/bold.js';
import inlineCode from './marks/code.js';
import italic from './marks/italic.js';
import link from './marks/link.js';
import strike from './marks/strike.js';
import dnd from './ui/dnd/index.js';
import emoji from './ui/emoji/index.js';
import slash from './ui/slash/index.js';
import toolbar from './ui/toolbar/index.js';

export { diffWords, hunks } from './ai/diff.js';
export { review } from './ai/pending.js';

export const blocks = [heading, todo, list, quote, divider, codeBlock, table, chart, math, columns, image, embed];
export const marks = [bold, italic, strike, inlineCode, link];
export const ui = [slash, toolbar, dnd, emoji];

export default { blocks, marks, ui };
