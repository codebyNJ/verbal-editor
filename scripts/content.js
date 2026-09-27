// Site content. Every page is Markdown under demo/content; reference tables and figures are filled in at
// build time from the package itself (registry, JSDoc, tokens.css, the size build) and bench/results.json,
// never written by hand. The same Markdown renders on the site, ships as <slug>.md and feeds llms.txt.
import './node-css.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measure, sizeOf } from './sizes.js';

const root = resolve(import.meta.dirname, '..');
const at = (...p) => join(root, ...p);
const read = (...p) => readFileSync(at(...p), 'utf8');
const ls = (...p) => readdirSync(at(...p)).sort();

const { Editor } = await import('../src/index.js');
const { default: preset } = await import('../src/preset.js');
const { pages: examples } = await import('../demo/pages.js');
const reg = new Editor(preset).registry;
const pkg = JSON.parse(read('package.json'));

/* ---------- Markdown writers ---------- */

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${' --- |'.repeat(head.length)}`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
/** Inline code; text with a backtick can't be a code span, so it is escaped plain text instead. */
const code = (s) => (String(s).includes('`') ? String(s).replace(/[\\*_~`[\]]/g, '\\$&') : `\`${s}\``);
const kb = (n) => (n == null ? '—' : `${(n / 1000).toFixed(2)} KB`);
const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: '⏎' };
/** 'Mod-Shift-ArrowUp' → '⌘⇧↑' (⌘ is Ctrl off Apple devices). */
const keys = (name) =>
  name.split('-').map((k) => ({ Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' })[k] ?? arrows[k] ?? (k.length === 1 ? k.toUpperCase() : k)).join('');
const page = (kind, name) => `#/docs/modules/${kind}/${name}`;
const owner = (type) => (reg.blocks[type] ? `[${type}](${page('blocks', type)})` : reg.marks[type] ? `[${type}](${page('marks', type)})` : type);
const prd = read('docs/01-prd.md');
const ftrText = read('docs/02-ftr.md');
const budget = (name) => /≤\s*([\d.]+\s*KB)/.exec(prd.split('\n').find((l) => l.startsWith(`| ${name}`)) ?? '')?.[1] ?? '';
const features = Object.fromEntries(
  ftrText.split('\n').filter((l) => /^\| F-\d\d /.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim())).map((c) => [c[0], c]),
);

/* ---------- JSDoc ---------- */

const unstar = (c) => c.split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join('\n').trim();
/** Reads a {type} that may nest braces; returns [type, rest]. */
const braced = (s) => {
  if (s[0] !== '{') return ['', s];
  let depth = 0;
  let i = 0;
  for (; i < s.length; i++) if (s[i] === '{') depth++; else if (s[i] === '}' && !--depth) break;
  return [s.slice(1, i).trim().replace(/\s+/g, ' '), s.slice(i + 1).trim()];
};
/** A JSDoc body → its prose, @param rows and @returns. */
function jsdoc(doc) {
  const [text, ...tags] = doc.split(/(?=@(?:param|returns?|example|type|typedef|internal)\b)/);
  const out = { text: text.trim(), params: [], returns: null, example: '' };
  for (const tag of tags) {
    const name = /^@(\w+)/.exec(tag)[1];
    const [type, rest] = braced(tag.slice(name.length + 1).trim());
    if (name === 'param') {
      const m = /^(\[)?(\.\.\.)?([\w.]+)(?:=[^\]]*)?\]?\s*([\s\S]*)$/.exec(rest);
      out.params.push({ name: `${m[2] ?? ''}${m[3]}`, optional: !!m[1], type, desc: m[4].replace(/^-\s*/, '').replace(/\s+/g, ' ').trim() });
    } else if (/^returns?$/.test(name)) out.returns = { type, desc: rest.replace(/\s+/g, ' ') };
    else if (name === 'example') out.example = tag.slice('@example'.length).trim();
  }
  return out;
}
/** Collapses wrapped JSDoc prose into Markdown paragraphs (a blank line separates them). */
const prose = (text) =>
  text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/```/g, '\\`\\`\\`').replace(/``\s?(.+?)\s?``/g, '`$1`')).join('\n\n');
const params = ({ params: ps, returns }) =>
  [
    ps.length ? table(['Parameter', 'Type', 'Description'], ps.map((p) => [code(p.optional ? `${p.name}?` : p.name), code(p.type), p.desc || '—'])) : '',
    returns ? `Returns ${code(returns.type)}${returns.desc ? ` — ${returns.desc}` : ''}.` : '',
  ].filter(Boolean).join('\n\n');
/** Every export of a source file with the JSDoc right above it. */
const exported = (src) =>
  [...src.matchAll(/(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*)?export\s+(?:async\s+)?(?:function\s+(\w+)\s*(\([^)]*\))|const\s+(\w+))/g)].map(
    ([, doc = '', fn, sig, name]) => ({ name: fn ?? name, sig: fn ? fn + sig : name, doc: unstar(doc) }),
  );
/** Names a file exports, default included. */
const exportNames = (src) => [
  ...(/export default/.test(src) ? ['default'] : []),
  ...[...src.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)].map((m) => m[1]),
  ...[...src.matchAll(/export\s*\{([^}]+)\}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).at(-1))),
];
const header = (file) => unstar(/^\/\*\*([\s\S]*?)\*\//.exec(readFileSync(file, 'utf8'))?.[1] ?? '');
/** What a module does: its JSDoc header's opening ("Name — first sentence"), without feature ids. */
const firstSentence = (text) => {
  const lead = prose(text).split('\n')[0].replace(/\s*\(F-\d\d(?:…F-\d\d)?\)/g, '');
  const [name, rest] = lead.includes(' — ') ? lead.split(/\s—\s(.*)/s) : ['', lead];
  const [one, two] = rest.split(/(?<=\.)\s+/);
  const said = one.length < 48 && two ? `${one} ${two}` : one;
  return name ? `${name} — ${said}` : said;
};

/* ---------- Modules ---------- */

const typeOf = (spec) => (Array.isArray(spec) ? spec.join(' | ') : spec.name.toLowerCase());
const modules = [
  ...[reg.blocks.paragraph, ...preset.blocks].map((mod) => ({ kind: 'blocks', name: mod.type, mod })),
  ...preset.marks.map((mod) => ({ kind: 'marks', name: mod.type, mod })),
  ...preset.ui.map((mod) => ({ kind: 'ui', name: mod.name, mod })),
  ...ls('src/ai').filter((f) => f.endsWith('.js')).map((f) => ({ kind: 'ai', name: f.replace('.js', '') })),
].map((m) => ({ ...m, file: m.kind === 'blocks' || m.kind === 'ui' ? at('src', m.kind, m.name, 'index.js') : at('src', m.kind, `${m.name}.js`) }));

/** What a module declares, read off the object itself. */
function contract({ kind, mod }) {
  if (!mod) return [];
  const rows =
    kind === 'blocks'
      ? [
          ['Block type', mod.type],
          ['Content', { none: 'no text of its own', code: 'plain text, no marks' }[mod.schema?.content] ?? 'text with marks'],
          ['Props', Object.entries(mod.schema?.props ?? {}).map(([k, spec]) => `${k}: ${typeOf(spec)}`)],
          ['Slash menu', [mod.slash ?? []].flat().map((e) => `${e.icon ?? ''} ${e.label}`.trim())],
          ['Keywords', [mod.slash ?? []].flat().flatMap((e) => e.keywords ?? [])],
          ['Keys', Object.keys({ ...mod.input?.keys, ...mod.input?.shortcuts }).map(keys)],
          ['Typing rules', (mod.input?.markdown ?? []).map(([re]) => re.source)],
          ['Pastes from', [...(mod.parse?.tags ?? []).map((t) => `<${t.toLowerCase()}>`), ...(mod.parse?.markdown || mod.parse?.lines ? ['Markdown'] : [])]],
          ['Copies as', Object.keys(mod.serialize ?? {}).map((f) => (f === 'html' ? 'HTML' : 'Markdown'))],
          ['Contains', [...(mod.blocks ?? []), ...(mod.marks ?? [])].map((m) => m.type)],
        ]
      : kind === 'marks'
        ? [
            ['Mark type', mod.type],
            ['HTML', (mod.tags ?? []).map((t) => `<${t.toLowerCase()}>`)],
            ['Shortcut', mod.shortcut ? [keys(mod.shortcut)] : []],
            ['Markdown', [mod.md].flat().filter((m) => typeof m === 'string')],
            ['Typing rule', mod.markdown ? [mod.markdown.source] : []],
            ['Grows while typing', mod.inclusive === false ? 'no' : 'yes'],
          ]
        : [['Name', mod.name], ['Shortcuts', Object.keys(mod.shortcuts ?? {}).map(keys)]];
  return rows.filter(([, v]) => v.length).map(([k, v]) => [k, typeof v === 'string' && k !== 'Content' && k !== 'Grows while typing' ? code(v) : Array.isArray(v) ? [...new Set(v)].map(code).join(' ') : v]);
}

/** The example page on the landing that shows a module at work. */
function example({ kind, name }) {
  if (kind === 'ai') return examples.find((p) => p.rewrites);
  if (kind === 'ui') return examples.find((p) => p.id === (name === 'emoji' ? 'media' : 'welcome'));
  const has = (b) => (kind === 'marks' ? b.content?.some((r) => r.marks.some((m) => m.type === name)) : b.type === name);
  return examples.find((p) => !p.bare && p.doc && Object.values(p.doc.blocks).some(has)) ?? examples[0];
}

async function modulePage(m, sizes) {
  const { kind, name, file } = m;
  const text = header(file);
  const dir = kind === 'blocks' ? at('src/blocks', name) : null;
  const files = dir ? ls('src/blocks', name).filter((f) => f.endsWith('.js')).map((f) => join(dir, f)) : [file];
  const api = files.flatMap((f) => exported(readFileSync(f, 'utf8')));
  // String lists a module exports from its own files (math's LaTeX commands) are listed in full.
  const lists = {};
  for (const f of files.filter((x) => x !== file)) for (const [k, v] of Object.entries(await import(f))) if (Array.isArray(v) && v.every((x) => typeof x === 'string')) lists[k] = v;
  const ids = [...text.matchAll(/F-(\d\d)(?:…F-(\d\d))?/g)].flatMap(([, a, b = a]) => Array.from({ length: b - a + 1 }, (_, i) => `F-${String(+a + i).padStart(2, '0')}`));
  const size = sizes?.modules[`${kind}/${name}`];
  const core = kind === 'blocks' && name === 'paragraph';
  const spec = kind === 'ai' ? `{ ${api.map((a) => a.name).join(', ')} }` : name;
  const live = example(m);
  const out = [
    prose(text),
    core ? 'Built into `verbal-editor`: every editor has it, and it is part of the core bundle.' : `\`\`\`js\nimport ${spec} from 'verbal-editor/${kind}/${name}';\n\`\`\``,
    size ? table(['JS gzip', 'CSS gzip'], [[kb(size.js), size.css ? kb(size.css) : '—']]) : '',
    `See it live on [${live.title}](#/examples/${live.id}) — every example page on the landing is editable.`,
  ];
  const rows = contract(m);
  if (rows.length) out.push('## Contract', table(['', ''], rows));
  const cited = ids.map((id) => features[id]).filter(Boolean);
  if (cited.length) out.push('## Acceptance', table(['Feature', 'Acceptance', 'Budget'], cited.map(([id, feature, , , accept, b]) => [`${id} · ${feature}`, accept, b])));
  if (api.length) out.push('## API');
  for (const a of api) {
    const d = jsdoc(a.doc);
    out.push(`### ${code(a.sig)}`, prose(d.text), params(d));
    if (lists[a.name]) out.push(lists[a.name].map(code).join(' '));
  }
  return {
    slug: `modules/${kind}/${name}`,
    title: `${kind}/${name}`,
    description: firstSentence(text),
    icon: { blocks: 'box', marks: 'text', ui: 'settings', ai: 'sparkle' }[kind],
    md: out.filter(Boolean).join('\n\n'),
  };
}

/* ---------- The Editor class ---------- */

function editorApi() {
  const src = read('src/index.js');
  const body = src.slice(src.indexOf('export class Editor'));
  const out = [];
  const seen = new Set();
  for (const [, raw, line] of body.matchAll(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n?\s*(.+)/g)) {
    const doc = unstar(raw);
    if (/@internal/.test(doc)) continue;
    const d = jsdoc(doc);
    const sig = (name) => `${name}(${d.params.map((p) => (p.optional ? `${p.name}?` : p.name)).join(', ')})`;
    let m;
    let title;
    if ((m = /^this\.(\w+)\s*=/.exec(line)) || (m = /^get\s+(\w+)\(\)/.exec(line))) title = `editor.${m[1]}`;
    else if ((m = /^constructor\(/.exec(line))) title = `new ${sig('Editor')}`;
    else if ((m = /^(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/.exec(line)) || (m = /^(\w+)\(/.exec(line))) title = `editor.${sig(m[1])}`;
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push(`### ${code(title)}`, prose(d.text), params(d));
  }
  const rows = [...unstar(src.slice(src.lastIndexOf('/**', src.indexOf('}} EditorOptions')), src.indexOf('}} EditorOptions'))).matchAll(/^\s+(\w+)(\?)?:\s*(.+?),?\s*$/gm)].map(([, n, opt, type]) => [code(`${n}${opt ?? ''}`), code(type)]);
  const intro = unstar(src.slice(src.lastIndexOf('/**', src.indexOf('export class Editor')) + 3, src.indexOf('*/', src.lastIndexOf('/**', src.indexOf('export class Editor')))));
  const events = unstar(src.slice(src.lastIndexOf('/**', src.indexOf('} EditorEvent')) + 3, src.indexOf('* @typedef', src.lastIndexOf('/**', src.indexOf('} EditorEvent')))));
  const optionsDoc = unstar(src.slice(src.indexOf('/**\n * Editor options') + 3, src.indexOf('* @typedef', src.indexOf('/**\n * Editor options'))));
  return [
    prose(jsdoc(intro).text),
    '```js\n' + jsdoc(intro).example + '\n```',
    '## Options',
    prose(optionsDoc),
    table(['Option', 'Type'], rows),
    '## Events',
    prose(events),
    '## Members',
    ...out,
  ].filter(Boolean).join('\n\n');
}

/* ---------- Imports ---------- */

function imports() {
  const rows = [];
  const add = (sub, file, size) => {
    const src = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const names = [...new Set(exportNames(src))];
    rows.push([code(`verbal-editor${sub}`), names.map((n) => code(n)).join(' ') || '—', size ? kb(size.js) : 'build time', size?.css ? kb(size.css) : '—']);
  };
  const s = existsSync(at('dist/index.js'));
  const sz = (...k) => (s ? sizeOf(...k) : null);
  add('', at('src/index.js'), sz('index'));
  add('/react', at('src/react/index.js'), sz('react'));
  add('/preset', at('src/preset.js'), sz('preset'));
  for (const m of modules.filter((x) => !(x.kind === 'blocks' && x.name === 'paragraph'))) add(`/${m.kind}/${m.name}`, m.file, sz(`${m.kind}/${m.name}`));
  add('/config', at('src/config/defineConfig.js'), null);
  add('/server', at('src/server/index.js'), null);
  rows.push([code('verbal-editor/tokens.css'), 'every custom property', '—', s ? kb(sizeOf('tokens.css').css) : '—']);
  return table(['Import', 'Exports', 'JS gzip', 'CSS gzip'], rows);
}

/* ---------- Real output: the CLI and Joi, run while the site builds ---------- */

const fence = (text, label = 'Output') => `\`\`\`text ${label}\n${text.trim()}\n\`\`\``;
/** `verbal doctor` on the config the Config file page shows. */
function doctor() {
  const dir = mkdtempSync(join(tmpdir(), 'verbal-doctor-'));
  try {
    const file = join(dir, 'verbal.config.js');
    const sample = read('demo/content/docs/01-guides/03-configuration/01-config-file.md').match(/```js verbal\.config\.js\n([\s\S]*?)```/)[1];
    writeFileSync(file, sample.replace('verbal-editor/config', pathToFileURL(at('dist/node/config.js')).href));
    return fence(execFileSync(process.execPath, [at('cli/index.js'), 'doctor', file], { encoding: 'utf8' }).replaceAll(dir, '.'));
  } finally {
    rmSync(dir, { recursive: true });
  }
}
async function configErrors() {
  const { defineConfig } = await import('../src/config/defineConfig.js');
  const message = (cfg) => {
    try {
      defineConfig(cfg);
      return 'valid';
    } catch (e) {
      return e.message;
    }
  };
  return fence([message({ blocks: ['heading', 'tables'] }), message({ blocks: ['chart'] })].join('\n'));
}
async function validateErrors() {
  const { validateDoc } = await import('../src/server/index.js');
  const doc = {
    version: 1,
    root: 'doc',
    blocks: {
      doc: { type: 'doc', children: ['a', 'b'] },
      a: { type: 'heading', props: { level: 5 }, content: [{ text: 'Plan', marks: [] }] },
      b: { type: 'paragraph', content: [{ text: 'click', marks: [{ type: 'link', href: 'javascript:alert(1)' }] }] },
    },
  };
  const orphan = { version: 1, root: 'doc', blocks: { doc: { type: 'doc', children: ['a', 'x'] }, a: { type: 'paragraph', content: [] } } };
  return fence([doc, orphan].flatMap((d) => validateDoc(d).error.details.map((e) => e.message)).join('\n'));
}

/* ---------- Generated sections: {{name args}} ---------- */

const editorNames = { verbal: 'Verbal', tiptap: 'Tiptap', lexical: 'Lexical', blocknote: 'BlockNote', plate: 'Plate', editorjs: 'Editor.js', quill: 'Quill' };
const one = (n) => (Math.round(n * 10) / 10).toFixed(1);

function generators(sizes, bench) {
  const lead = (setup) => bench.editors.filter((e) => e.setup === setup);
  const row = (editor, setup) => bench.editors.find((e) => e.editor === editor && e.setup === setup);
  /** The lightest other editor for a setup. */
  const nearest = (setup) => lead(setup).filter((e) => e.editor !== 'verbal').sort((a, b) => a.total - b.total)[0];
  const list = (arg) => (arg ? arg.split(/\s+/) : Object.keys(editorNames));
  return {
    shortcuts: () =>
      table(['Keys', 'From'], [
        ...Object.keys(new Editor().keys).filter((k) => !/Arrow/.test(k)).map((k) => [code(keys(k)), 'core']),
        ...Object.entries(reg.shortcuts).map(([k, s]) => [code(keys(k)), owner(s.owner)]),
      ]),
    keys: () =>
      table(['Keys', 'Inside'], Object.values(reg.blocks).flatMap((m) => Object.keys(m.input?.keys ?? {}).filter((k) => k !== 'Paste').map((k) => [code(keys(k)), owner(m.type)]))),
    // Readable triggers, each shown only if the module's own rule really matches it (the regex otherwise).
    rules: () =>
      table(['Typed at the start', 'Becomes'], reg.rules.map((r) => {
        const hits = ['# ', '## ', '### ', '- ', '* ', '+ ', '1. ', '1) ', '[] ', '[ ] ', '[x] ', '> ', '" ', '---', '```js ', '``` ', '$$ '].filter((t) => r.re.test(t));
        return [hits.length ? hits.map((t) => code(t.replace(/ $/, '␣'))).join(' ') : code(r.re.source), owner(r.type)];
      })),
    inline: () =>
      table(['Typed', 'Becomes'], reg.inline.map((r) => [reg.marks[r.type].md, r.type]).filter(([md]) => typeof md === 'string' || Array.isArray(md))
        .map(([md, type]) => [code([md].flat().map((d) => `${d}text${d}`).join(' or ')), owner(type)])),
    tokens: () =>
      table(['Token', 'Light', 'Dark'], [...read('src/tokens.css').split('[data-theme')[0].matchAll(/(--v-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => {
        const pair = /^light-dark\((.+),\s*([^,]+)\)$/.exec(value.trim());
        return [code(name), code(pair ? pair[1].trim() : value.trim()), pair ? code(pair[2].trim()) : 'same'];
      })),
    sizes: () =>
      sizes
        ? table(['Entry', 'JS gzip', 'CSS gzip', 'Budget'], [
            ['Core: editor + React binding + paragraph', kb(sizes.core), '', budget('Core bundle')],
            ['Full preset: every module', kb(sizes.preset), kb(sizes.css), budget('Full default preset')],
            ...Object.entries(sizes.modules).map(([key, s]) => [`[${key}](#/docs/modules/${key})`, kb(s.js), kb(s.css), '']),
          ])
        : 'Build the package (`npm run build`) to measure it.',
    /** One measured size, e.g. {{kb core}}, {{kb preset}}, {{kb css}}, {{kb blocks/table}}. */
    kb: (key) => kb(key in (sizes ?? {}) ? sizes[key] : sizes?.modules[key]?.js),
    budget: (name) => budget(name),
    imports,
    'editor-api': editorApi,
    modules: () =>
      table(['Module', 'What it adds', 'JS gzip', 'CSS gzip'], modules.map((m) => {
        const s = sizes?.modules[`${m.kind}/${m.name}`];
        return [`[${m.kind}/${m.name}](${page(m.kind, m.name)})`, firstSentence(header(m.file)), s ? kb(s.js) : 'core', s?.css ? kb(s.css) : '—'];
      })),
    features: () => Object.values(features).map(([id, feature]) => `- ${id} · ${feature}`).join('\n'),
    version: () => pkg.version,
    doctor,
    'config-errors': configErrors,
    'validate-errors': validateErrors,
    // Benchmarks: every figure below comes from bench/results.json.
    'bench-date': () => bench.date,
    'bench-command': () => bench.command,
    'bench-environment': () => `Chromium ${bench.environment.chromium}, Node ${bench.environment.node}, ${bench.environment.os}, ${bench.environment.cpu}`,
    'bench-setups': () => lead('full').length,
    /** Renders per keystroke, measured by the bench (React renders counted with onRender). */
    renders: () => row('verbal', 'full').rendersPerKey,
    /** How many times lighter Verbal's setup is than the lightest other editor's (JS + CSS gzip). */
    lighter: (setup = 'full') => one(nearest(setup).total / row('verbal', setup).total),
    'lighter-than': (setup = 'full') => editorNames[nearest(setup).editor],
    /** JS + CSS gzip per editor, minimal and full setups — the same numbers the Benchmarks page charts. */
    compare: (arg) =>
      table(['Editor', 'Full setup (KB)', 'Minimal setup (KB)'], list(arg).map((e) => [editorNames[e], one(row(e, 'full').total / 1000), one(row(e, 'minimal').total / 1000)])),
    /** One metric per editor, minimal and full side by side — a table the chart after it draws. */
    'bench-table': (arg) => {
      const [metric, unit] = arg.split(/\s+/);
      const value = (e, setup) => (metric === 'total' ? one(row(e, setup).total / 1000) : String(row(e, setup)[metric]));
      return table(['Editor', `Minimal (${unit})`, `Full (${unit})`], list().map((e) => [editorNames[e], value(e, 'minimal'), value(e, 'full')]));
    },
    /** Verbal's full setup against each editor's: how much smaller, and how much faster or slower. */
    'bench-reduction': () => {
      const v = row('verbal', 'full');
      const diff = (mine, theirs, less, more) => (mine <= theirs ? `${Math.round((1 - mine / theirs) * 100)}% ${less}` : `${Math.round((mine / theirs - 1) * 100)}% ${more}`);
      return table(['Against', 'Download', 'Mount, 1,000 blocks', 'Keystroke handling p95'], list().filter((e) => e !== 'verbal').map((e) => {
        const o = row(e, 'full');
        return [editorNames[e], diff(v.total, o.total, 'smaller', 'larger'), diff(v.mountMs, o.mountMs, 'faster', 'slower'), diff(v.inputP95Ms, o.inputP95Ms, 'faster', 'slower')];
      }));
    },
    /** Every measured row, as recorded. */
    'bench-all': () =>
      table(['Editor', 'Setup', 'JS (KB)', 'CSS (KB)', 'Mount (ms)', 'Handling p95 (ms)', 'Paint p95 (ms)'], [
        ...list().flatMap((e) => ['minimal', 'full'].map((setup) => {
          const r = row(e, setup);
          return [editorNames[e], setup, one(r.js / 1000), one(r.css / 1000), r.mountMs, r.inputP95Ms, r.keyP95Ms];
        })),
        ['Notion (public page)', 'JS downloaded', bench.notion.measured ? one(bench.notion.jsBytes / 1000) : 'not measured', '—', '—', '—', '—'],
      ]),
    'bench-versions': () =>
      table(['Editor', 'Packages'], list().map((e) => [editorNames[e], [...new Map(['minimal', 'full'].flatMap((setup) => row(e, setup).packages).map((p) => [p.name, p])).values()].map((p) => code(`${p.name}@${p.version}`)).join(' ')])),
    'bench-paint': () => {
      const all = bench.editors.map((e) => e.keyP95Ms);
      return `${one(Math.min(...all))}–${one(Math.max(...all))} ms`;
    },
    'bench-method': (key) => bench.method[key],
    /** Which full setups mount 1,000 blocks faster than Verbal's, named from the data. */
    'bench-slower': () => {
      const v = row('verbal', 'full');
      const faster = lead('full').filter((e) => e.editor !== 'verbal' && e.mountMs < v.mountMs).map((e) => editorNames[e.editor]);
      const names = faster.length > 1 ? `${faster.slice(0, -1).join(', ')} and ${faster.at(-1)}` : faster[0];
      return faster.length
        ? `${names} mount${faster.length > 1 ? '' : 's'} 1,000 blocks faster than Verbal: each Verbal block is its own element with its own editable region, created up front.`
        : 'Verbal mounts 1,000 blocks faster than every other full setup here.';
    },
    notion: () =>
      bench.notion.measured
        ? `Opening [a public Notion page](${bench.notion.url}) downloaded ${one(bench.notion.jsBytes / 1e6)} MB of Notion's own JavaScript (compressed, as transferred) on ${bench.date}, plus ${one(bench.notion.thirdPartyJsBytes / 1e6)} MB of third-party scripts. That is a download size, not a speed comparison.`
        : `Notion: not measured. On ${bench.date} [its public page](${bench.notion.url}) answered the benchmark's browser with a bot check instead of the page, and the benchmark does not work around bot checks. No figure is shown rather than an estimate.`,
  };
}

/* ---------- Pages ---------- */

const meta = (src) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  const fields = Object.fromEntries((m?.[1] ?? '').split('\n').map((l) => /^(\w+):\s*(.*)$/.exec(l)).filter(Boolean).map(([, k, v]) => [k, v.trim()]));
  return [fields, m ? src.slice(m[0].length).replace(/^\n+/, '') : src];
};
/** Fills {{name args}} outside code fences; an unknown name fails the build. */
const filler = (gen) => async (md, where) => {
  const parts = md.split(/(^```[\s\S]*?^```$)/m);
  for (let i = 0; i < parts.length; i += 2)
    for (const [all, name, arg] of [...parts[i].matchAll(/\{\{\s*([\w-]+)(?:\s+([^}]*?))?\s*\}\}/g)]) {
      if (!gen[name]) throw new Error(`${where}: unknown {{${name}}}`);
      const value = String(await gen[name](arg));
      parts[i] = parts[i].replace(all, () => value); // a function, so "$$" and "$`" in the value stay literal
    }
  return parts.join('');
};
const words = { api: 'API', ai: 'AI', cli: 'CLI' };
const strip = (n) => n.replace(/^\d+-/, '').replace(/\.md$/, '');
const label = (slug, everyWord) => slug.split('-').map((w, i) => words[w] ?? (everyWord || !i ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/** The whole site's content: docs (in nav order), blog posts, and the workspace's Markdown pages. */
export async function content() {
  const sizes = measure();
  const bench = JSON.parse(read('bench/results.json'));
  const fill = filler(generators(sizes, bench));
  const docs = [];
  for (const tab of ls('demo/content/docs'))
    for (const group of ls('demo/content/docs', tab))
      for (const file of ls('demo/content/docs', tab, group).filter((f) => f.endsWith('.md'))) {
        const [fields, body] = meta(read('demo/content/docs', tab, group, file));
        const where = `demo/content/docs/${tab}/${group}/${file}`;
        if (!fields.title || !fields.description) throw new Error(`${where}: needs a title and a description`);
        docs.push({ slug: strip(file), tab: label(strip(tab), true), group: label(strip(group)), ...fields, md: (await fill(body, where)).trim() });
        if (strip(group) === 'modules' && strip(file) === 'modules')
          for (const m of modules) docs.push({ tab: label(strip(tab), true), group: label(strip(group)), generated: true, ...(await modulePage(m, sizes)) });
      }
  const blog = [];
  for (const file of existsSync(at('demo/content/blog')) ? ls('demo/content/blog').filter((f) => f.endsWith('.md')) : []) {
    const [fields, body] = meta(read('demo/content/blog', file));
    blog.push({ slug: strip(file), ...fields, md: (await fill(body, `demo/content/blog/${file}`)).trim() });
  }
  blog.sort((a, b) => b.date.localeCompare(a.date));
  const pages = {};
  for (const file of ls('demo/content').filter((f) => f.endsWith('.md'))) {
    const [fields, body] = meta(read('demo/content', file));
    pages[strip(file)] = { slug: strip(file), ...fields, md: (await fill(body, `demo/content/${file}`)).trim() };
  }
  return { docs, blog, pages, repo: pkg.repository?.url?.replace(/^git\+|\.git$/g, '') ?? null, name: pkg.name, version: pkg.version };
}

/** A page as one Markdown file: what "Copy page" copies and what <slug>.md serves. */
export const markdown = (p) => `# ${p.title}\n\n> ${p.description}\n\n${p.md}\n`;

/** llms.txt (an index of every docs page) and llms-full.txt (every page in full), per llmstxt.org. */
export function llms({ docs, name }) {
  const head = `# Verbal (${name})\n\n> A block editor for the web with zero runtime dependencies: every block is its own contenteditable, typing costs no React renders, and every feature is a module you opt into.\n`;
  const groups = [...new Set(docs.map((d) => `${d.tab} · ${d.group}`))];
  const index = groups.map((g) => [`## ${g}`, '', ...docs.filter((d) => `${d.tab} · ${d.group}` === g).map((d) => `- [${d.title}](docs/${d.slug}.md): ${d.description}`)].join('\n'));
  return { 'llms.txt': [head, ...index].join('\n\n') + '\n', 'llms-full.txt': [head, ...docs.map(markdown)].join('\n\n') };
}
