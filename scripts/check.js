// Build gates: gzip budgets read from the PRD/FTR tables, and the architecture's hard rules.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const at = (...p) => join(root, ...p);
const read = (f) => readFileSync(f, 'utf8');
const walk = (d) =>
  existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])) : [];
const fails = [];
const rule = (ok, msg) => ok || fails.push(msg);

const pkg = JSON.parse(read(at('package.json')));
const devAllowed = ['vite', '@vitejs/plugin-react', 'react', 'react-dom', 'joi', '@playwright/test', 'typescript'];
rule(!Object.keys(pkg.dependencies ?? {}).length, 'package.json: dependencies must be empty');
rule(Object.keys(pkg.devDependencies ?? {}).every((d) => devAllowed.includes(d)), 'package.json: devDependency outside the allowed list');
rule(pkg.peerDependenciesMeta?.react?.optional && pkg.peerDependenciesMeta?.joi?.optional, 'package.json: react and joi must be optional peers');

for (const f of walk(at('src')).filter((f) => f.endsWith('.js'))) {
  const rel = relative(root, f);
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const imports = [...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (rel.startsWith('src/core/') || rel === 'src/index.js') {
    rule(!imports.some((i) => /^react/.test(i)), `${rel}: core imports React`);
    rule(!imports.some((i) => /blocks\/(?!paragraph)/.test(i)), `${rel}: core imports a block other than paragraph`);
  }
  if (rel.startsWith('src/core/') && !rel.endsWith('/view.js'))
    rule(!/\b(document|window|navigator|DOMParser|HTMLElement|getSelection|CSS\.highlights)\b/.test(src), `${rel}: DOM access outside core/view.js`);
  if (rel.startsWith('src/react/')) rule(!/\.(dispatch|setDoc|undo|redo)\(/.test(src), `${rel}: the binding mutates the model`);
  if (rel.startsWith('src/ui/')) rule(!imports.some((i) => /^react/.test(i)), `${rel}: ui/ imports React`);
  rule(!/execCommand/.test(src), `${rel}: execCommand is prohibited`);
  rule(!/draggable|dragstart|setDragImage/.test(src), `${rel}: HTML5 drag-and-drop is prohibited`);
  rule(!imports.includes('joi') || /^src\/(config|server)\//.test(rel), `${rel}: joi imported outside config/ and server/`);
  rule(!imports.some((i) => /(^|\/)demo\//.test(i)), `${rel}: the package imports from the site (demo/)`);
}

const dist = at('dist');
if (!existsSync(join(dist, 'index.js'))) fails.push('dist/ is missing: run `npm run build` first');
const files = walk(dist).filter((f) => !/[\\/](node|types)[\\/]/.test(f));
const deps = (file) =>
  [...read(file).matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{},\s]*?from\s*)?["'](\.[^"']+)["']/g)].map((m) => resolve(dirname(file), m[1]));
const graph = (entries) => {
  const seen = new Set();
  const go = (f) => { if (!seen.has(f)) { seen.add(f); if (f.endsWith('.js')) deps(f).forEach(go); } };
  entries.forEach(go);
  return [...seen];
};
const gz = (list) => gzipSync(Buffer.concat(list.map((f) => readFileSync(f)))).length;
const entry = (key) => join(dist, `${key}.js`);
const isEntry = (f) => f.endsWith('.js') && !f.startsWith(join(dist, 'chunks'));
const isModule = (f) => isEntry(f) && /^(blocks|marks|ui|ai)[\\/]/.test(relative(dist, f));

for (const f of files) rule(!/["']joi["']/.test(read(f)), `${relative(root, f)}: Joi reachable from a browser build`);

const modules = files.filter(isModule);
for (const f of modules) {
  const key = relative(dist, f).replace(/\.js$/, '');
  const own = deps(f);
  rule(own.every((d) => d.endsWith('.css') || isModule(d)), `${key}: imports something other than its own CSS and module entries`);
  const styled = existsSync(at('src', `${key}.module.css`)) || walk(at('src', key.split('/').slice(0, 2).join('/'))).some((s) => s.endsWith('.module.css'));
  if (!key.includes('/lang/') && !key.endsWith('/detect') && styled)
    rule(own.some((d) => d.endsWith('.css')), `${key}: its CSS does not travel with its JS`);
}

const ftr = read(at('docs/02-ftr.md'));
const prd = read(at('docs/01-prd.md'));
const kb = (cell) => { const m = cell && /≤\s*([\d.]+)\s*KB/.exec(cell); return m ? +m[1] * 1000 : null; };
const F = (id) => kb(ftr.split('\n').find((l) => l.startsWith(`| ${id} |`))?.split('|').at(-2));
const P = (name) => kb(prd.split('\n').find((l) => l.startsWith(`| ${name}`)));
const feature = {
  'marks/bold': ['F-10'], 'marks/italic': ['F-10'], 'marks/strike': ['F-10'], 'marks/code': ['F-10'],
  'blocks/heading': ['F-11'], 'blocks/quote': ['F-12'], 'blocks/divider': ['F-13'], 'marks/link': ['F-15'],
  'blocks/list': ['F-20'], 'blocks/todo': ['F-21'], 'blocks/columns': ['F-23'],
  'blocks/code': ['F-30'], 'blocks/code/detect': ['F-32'], 'blocks/table': ['F-33'], 'blocks/math': ['F-34'],
  'blocks/chart': ['F-35'], 'blocks/embed': ['F-36'], 'blocks/image': ['F-37'],
  'ui/slash': ['F-40'], 'ui/dnd': ['F-41'], 'ui/toolbar': ['F-42'], 'ui/emoji': ['F-43'],
  'ai/pending': ['F-50', 'F-53'], 'ai/diff': ['F-51'],
};

const rows = [];
const gate = (name, size, budget) => {
  rows.push([name, size, budget]);
  rule(budget != null && size <= budget, `${name}: ${size} B gz exceeds ${budget} B`);
};
if (existsSync(entry('index'))) {
  const js = (keys) => graph(keys.map(entry)).filter((f) => f.endsWith('.js'));
  gate('core (index + react + paragraph)', gz(js(['index', 'react'])), P('Core bundle'));
  if (existsSync(entry('preset'))) {
    gate('preset (preset + react)', gz(js(['preset', 'react'])), P('Full default preset'));
    rule(!graph([entry('preset')]).some((f) => f.includes('/lang/')), 'preset: a code language is bundled instead of lazy');
  }
  for (const f of modules) {
    const key = relative(dist, f).replace(/\.js$/, '');
    const ids = key.includes('/lang/') ? ['F-31'] : feature[key];
    rule(ids, `${key}: no FTR feature mapped to this module`);
    if (ids) gate(key, gz([f]), ids.reduce((sum, id) => sum + F(id), 0));
  }
  gate('all CSS', gz(files.filter((f) => f.endsWith('.css'))), P('Total CSS'));
}

const pad = (v, n) => String(v).padStart(n);
for (const [name, size, budget] of rows)
  console.log(`${size <= budget ? '✓' : '✗'} ${name.padEnd(34)} ${pad((size / 1000).toFixed(2), 6)} KB  / ${pad((budget / 1000).toFixed(1), 5)} KB`);
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
