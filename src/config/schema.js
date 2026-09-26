// Joi at the trust boundaries (HLD §3.9): verbal.config.js, and documents a server ingests. Never in the browser.
import Joi from 'joi';
import paragraph from '../blocks/paragraph/index.js';
import { registry } from '../core/registry.js';
import preset from '../preset.js';

/** Module names a config can enable, by kind — the same names as the package subpaths. */
export const available = {
  blocks: preset.blocks.map((m) => m.type),
  marks: preset.marks.map((m) => m.type),
  ui: preset.ui.map((m) => m.name),
};

const names = (list) => Joi.array().items(Joi.string().valid(...list)).unique().default([]);

/** verbal.config.js */
export const config = Joi.object({
  blocks: names(available.blocks),
  marks: names(available.marks),
  ui: names(available.ui),
  ai: Joi.boolean().default(false),
  budget: Joi.number().positive().default(30),
}).custom((c, h) => (c.blocks.includes('chart') && !c.blocks.includes('table') ? h.message('"blocks" has chart, which draws from a table: add "table"') : c));

/** The registry of the modules a config enables (all of them by default). */
export function enabled(cfg = {}) {
  const pick = (list, key, want) => (want ? list.filter((m) => want.includes(m[key])) : list);
  return registry([paragraph, ...pick(preset.blocks, 'type', cfg.blocks)], pick(preset.marks, 'type', cfg.marks), []);
}

const prop = (spec) =>
  Array.isArray(spec) ? Joi.valid(...spec) : { Boolean: Joi.boolean(), Number: Joi.number(), Array: Joi.array() }[spec.name] ?? Joi.string().allow('');

/** A document payload (HLD §3.3) whose blocks, props and marks all belong to `reg`, forming one tree. */
export function document(reg) {
  const mods = Object.values(reg.blocks);
  const mark = Joi.object({ type: Joi.string().valid(...Object.keys(reg.marks)).required() })
    .unknown()
    .custom((m, h) => (reg.marks[m.type].valid?.(m) === false ? h.error('any.invalid') : m));
  const runs = (marks) => Joi.array().items(Joi.object({ text: Joi.string().allow('').required(), marks: marks.required() })).required();
  const per = (fn) => ({ switch: mods.map((m) => ({ is: m.type, then: fn(m) })), otherwise: Joi.forbidden() });
  const block = Joi.object({
    type: Joi.string().valid('doc', ...mods.map((m) => m.type)).required(),
    props: Joi.when('type', per((m) => Joi.object(Object.fromEntries(Object.entries(m.schema?.props ?? {}).map(([k, s]) => [k, prop(s)]))))),
    content: Joi.when('type', per((m) => ({ none: Joi.forbidden(), code: runs(Joi.array().length(0)) })[m.schema?.content] ?? runs(Joi.array().items(mark).unique('type')))),
    children: Joi.array().items(Joi.string()).unique(),
  });
  return Joi.object({
    version: Joi.valid(1).required(),
    root: Joi.string().required(),
    blocks: Joi.object().pattern(Joi.string(), block).required(),
  }).custom((d, h) => {
    const at = (id) => `"blocks.${id}"`;
    if (d.blocks[d.root]?.type !== 'doc') return h.message(`${at(d.root)} is the root and must exist with type "doc"`);
    const parent = { [d.root]: null };
    for (const [id, b] of Object.entries(d.blocks)) {
      if (b.type === 'doc' && id !== d.root) return h.message(`${at(id)} has type "doc" but is not the root`);
      for (const [i, c] of (b.children ?? []).entries()) {
        if (!d.blocks[c]) return h.message(`"blocks.${id}.children[${i}]" refers to missing block "${c}"`);
        if (c in parent) return h.message(`"blocks.${id}.children[${i}]" puts "${c}" in a second place`);
        parent[c] = id;
      }
    }
    const tree = new Set();
    const walk = (id) => tree.add(id) && d.blocks[id].children?.forEach(walk);
    walk(d.root);
    const orphan = Object.keys(d.blocks).find((id) => !tree.has(id));
    if (orphan) return h.message(`${at(orphan)} is not in the tree under "${d.root}"`);
    return d;
  });
}
