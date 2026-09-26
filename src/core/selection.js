// Model selection: text points { block, offset }, or whole blocks { blocks } (F-04).
import { order, parentOf } from './model.js';

/** @typedef {{ block: string, offset: number }} Point */
/** @typedef {{ anchor: Point, focus: Point } | { blocks: string[] }} Selection */

/** Collapsed selection at a point. */
export const caret = (block, offset = 0) => ({ anchor: { block, offset }, focus: { block, offset } });

/** Selection inside a single block as { block, from, to }, else null. */
export const within = (s) =>
  s?.anchor && s.anchor.block === s.focus.block
    ? { block: s.anchor.block, from: Math.min(s.anchor.offset, s.focus.offset), to: Math.max(s.anchor.offset, s.focus.offset) }
    : null;

/** Outermost blocks from a to b inclusive, in document order. */
export function span(doc, a, b) {
  const ids = order(doc);
  const [i, j] = [ids.indexOf(a), ids.indexOf(b)].sort((x, y) => x - y);
  const picked = new Set(ids.slice(i, j + 1));
  return [...picked].filter((id) => !picked.has(parentOf(doc, id)));
}
