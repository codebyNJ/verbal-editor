// Gzip sizes of the built package, measured the way scripts/check.js measures them: everything an entry
// imports statically (lazy chunks load later), JS and CSS each gzipped as one file.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(import.meta.dirname, '../dist');
const gz = (files) => (files.length ? gzipSync(Buffer.concat(files.map((f) => readFileSync(f)))).length : 0);
const deps = (f) => [...readFileSync(f, 'utf8').matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{},\s]*?from\s*)?["'](\.[^"']+)["']/g)].map((m) => resolve(dirname(f), m[1]));

/** JS and CSS gzip of dist entries (e.g. 'index', 'react', 'blocks/table') with everything they import. */
export function sizeOf(...keys) {
  const seen = new Set();
  const go = (f) => seen.has(f) || (seen.add(f), f.endsWith('.js') && deps(f).forEach(go));
  keys.forEach((k) => go(join(dist, k.endsWith('.css') ? k : `${k}.js`)));
  const all = [...seen];
  return { js: gz(all.filter((f) => f.endsWith('.js'))), css: gz(all.filter((f) => f.endsWith('.css'))) };
}

/** Each module's own JS and CSS (its entry file only, as check.js gates it), and the totals. null before a build. */
export function measure() {
  if (!existsSync(join(dist, 'index.js'))) return null;
  const modules = {};
  for (const kind of ['blocks', 'marks', 'ui', 'ai'])
    for (const f of readdirSync(join(dist, kind)).filter((n) => n.endsWith('.js'))) {
      const file = join(dist, kind, f);
      modules[`${kind}/${f.replace(/\.js$/, '')}`] = { js: gz([file]), css: gz(deps(file).filter((d) => d.endsWith('.css'))) };
    }
  const css = readdirSync(dist).filter((n) => n.endsWith('.css')).map((n) => join(dist, n));
  const core = sizeOf('index', 'react');
  // coreCss: what the core itself imports (the paragraph); tokens: tokens.css, which every app imports once.
  return { modules, core: core.js, coreCss: core.css, tokens: sizeOf('tokens.css').css, preset: sizeOf('preset', 'react').js, css: gz(css) };
}
