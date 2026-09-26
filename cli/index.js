#!/usr/bin/env node
// verbal init · verbal doctor (F-61). Build-time only: nothing here ships to the browser.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const [command, ...args] = process.argv.slice(2);
const file = resolve(args.find((a) => !a.startsWith('-')) ?? 'verbal.config.js');
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const usage = `Usage:
  verbal init [file] [--yes] [--force]   write verbal.config.js, asking which modules to enable
  verbal doctor [file]                   validate the config and report each module's gzip cost`;

/** defineConfig and the module names, from the built package (needs Joi, a build-time peer). */
async function load() {
  try {
    return await import(pathToFileURL(resolve(dist, 'node/config.js')));
  } catch (e) {
    fail(e.code === 'ERR_MODULE_NOT_FOUND' && /joi/.test(e.message) ? 'Joi is needed at build time: npm i -D joi' : e.message);
  }
}

async function init() {
  const { available, defineConfig } = await load();
  if (existsSync(file) && !args.includes('--force')) fail(`${file} exists; pass --force to replace it`);
  const want = { blocks: available.blocks, marks: available.marks, ui: available.ui, ai: false };
  if (!args.includes('--yes')) {
    const rl = createInterface({ input: process.stdin });
    const lines = rl[Symbol.asyncIterator]();
    const ask = async (q) => (process.stdout.write(q), (await lines.next()).value ?? '');
    for (const kind of ['blocks', 'marks', 'ui']) {
      const answer = await ask(`${kind}: ${available[kind].join(' ')}\n  Enter for all, or the ones you want: `);
      if (answer.trim()) want[kind] = answer.split(/[\s,]+/).filter(Boolean);
    }
    want.ai = /^y/i.test(await ask('AI diff review? (y/N) '));
    rl.close();
  }
  let cfg;
  try {
    cfg = defineConfig(want);
  } catch (e) {
    fail(e.message);
  }
  const list = (names) => `[${names.map((n) => `'${n}'`).join(', ')}]`;
  writeFileSync(
    file,
    `import { defineConfig } from '@verbal/editor/config';\n\nexport default defineConfig({\n  blocks: ${list(cfg.blocks)},\n  marks: ${list(cfg.marks)},\n  ui: ${list(cfg.ui)},\n  ai: ${cfg.ai},\n  budget: ${cfg.budget},\n});\n`,
  );
  const both = cfg.blocks.filter((n) => cfg.marks.includes(n));
  const name = (n, kind) => (both.includes(n) ? `${n}${kind === 'blocks' ? 'Block' : 'Mark'}` : n);
  const imports = ['blocks', 'marks', 'ui'].flatMap((kind) => cfg[kind].map((n) => `import ${name(n, kind)} from '@verbal/editor/${kind}/${n}';`));
  if (cfg.ai) imports.push("import { review } from '@verbal/editor/ai/pending';");
  const arg = ['blocks', 'marks', 'ui'].map((kind) => `${kind}: [${cfg[kind].map((n) => name(n, kind)).join(', ')}]`).join(', ');
  console.log(`✓ wrote ${file}\n\nimport { Editor } from '@verbal/editor';\nimport '@verbal/editor/tokens.css';\n${imports.join('\n')}\n\nconst editor = new Editor({ ${arg} });`);
}

/** Relative imports of a built file. */
const deps = (f) => [...readFileSync(f, 'utf8').matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{},\s]*?from\s*)?["'](\.[^"']+)["']/g)].map((m) => resolve(dirname(f), m[1]));
const gz = (files) => (files.length ? gzipSync(Buffer.concat(files.map((f) => readFileSync(f)))).length : 0);
const kb = (bytes) => (bytes ? `${(bytes / 1000).toFixed(2)} KB` : '—').padStart(9);

async function doctor() {
  const { defineConfig } = await load();
  if (!existsSync(file)) fail(`${file} not found — run \`verbal init\``);
  let cfg;
  try {
    cfg = defineConfig((await import(pathToFileURL(file))).default);
  } catch (e) {
    fail(`${file}: ${e.message}`);
  }
  const rows = [
    ['core', 'index'],
    ['react binding', 'react'],
    ...['blocks', 'marks', 'ui'].flatMap((kind) => cfg[kind].map((n) => [`${kind}/${n}`, `${kind}/${n}`])),
    ...(cfg.ai ? [['ai/diff', 'ai/diff'], ['ai/pending', 'ai/pending']] : []),
  ].map(([label, key]) => [label, resolve(dist, `${key}.js`)]);
  const seen = new Set();
  const walk = (f) => seen.has(f) || (seen.add(f), f.endsWith('.js') && deps(f).forEach(walk));
  rows.forEach(([, f]) => walk(f));
  console.log(`✓ ${file} is valid\n\n  ${'module'.padEnd(20)}  JS gzip   CSS gzip`);
  for (const [label, f] of rows) console.log(`  ${label.padEnd(20)}${kb(gz([f]))}${kb(gz(deps(f).filter((d) => d.endsWith('.css'))))}`);
  const js = gz([...seen].filter((f) => f.endsWith('.js')));
  const css = gz([resolve(dist, 'tokens.css'), ...[...seen].filter((f) => f.endsWith('.css'))]);
  console.log(`  ${'total'.padEnd(20)}${kb(js)}${kb(css)}   budget ${cfg.budget} KB JS`);
  if (js > cfg.budget * 1000) fail(`the configured editor weighs ${kb(js).trim()} of JS, over its ${cfg.budget} KB budget`);
}

if (command === 'init') await init();
else if (command === 'doctor') await doctor();
else {
  console.log(usage);
  process.exitCode = command && command !== '--help' ? 1 : 0;
}
