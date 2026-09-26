// Versioned per-block subscriptions: structural changes bump, text edits stay silent (HLD §3.5).

/** One version number per block id; bindings re-read a block when its version changes. */
export function store() {
  const versions = new Map();
  const subs = new Map();
  return {
    /** @param {string} id @returns {number} */
    version: (id) => versions.get(id) ?? 0,
    /** @param {string} id @param {() => void} fn @returns {() => void} unsubscribe */
    subscribe(id, fn) {
      if (!subs.has(id)) subs.set(id, new Set());
      subs.get(id).add(fn);
      return () => subs.get(id).delete(fn);
    },
    /** @param {string} id */
    bump(id) {
      versions.set(id, (versions.get(id) ?? 0) + 1);
      subs.get(id)?.forEach((fn) => fn());
    },
  };
}
