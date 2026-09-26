// Undo/redo stacks of transactions; consecutive typing in one block coalesces into one step (F-03).

/** @typedef {{ ops: object[], before: import('./selection.js').Selection | null, after: import('./selection.js').Selection | null, kind?: string, block?: string, time: number }} Entry */

/** Newest 500 steps; typing within a second of the last keystroke joins its step. */
export function history() {
  const done = [];
  const undone = [];
  return {
    /** Records an entry, merging it into the previous one when both are typing in the same block. @param {Entry} e */
    push(e) {
      const last = done.at(-1);
      if (last && e.kind === 'text' && last.kind === 'text' && last.block === e.block && e.time - last.time < 1000) {
        last.ops.push(...e.ops);
        Object.assign(last, { after: e.after, time: e.time });
      } else if (done.push(e) > 500) done.shift();
      undone.length = 0;
    },
    /** Stops the last entry from absorbing further typing. */
    seal: () => done.at(-1) && (done.at(-1).kind = 'sealed'),
    /** @returns {Entry | null} */
    undo: () => (done.length ? undone[undone.push(done.pop()) - 1] : null),
    /** @returns {Entry | null} */
    redo: () => (undone.length ? done[done.push(undone.pop()) - 1] : null),
    clear: () => (done.length = undone.length = 0),
  };
}
