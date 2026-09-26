import { test, expect } from '../../playwright.config.js';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pages } from '../../demo/pages.js';

const repo = resolve(import.meta.dirname, '../..');
const { defineConfig, available } = await import(join(repo, 'dist/node/config.js'));
const { validateDoc } = await import(join(repo, 'dist/node/server.js'));

test.skip(({ browserName }) => browserName !== 'chromium', 'Node-side: runs once');

/** A throwaway app with @verbal/editor and joi installed, and a way to run the CLI in it. */
function app() {
  const dir = mkdtempSync(join(tmpdir(), 'verbal-app-'));
  mkdirSync(join(dir, 'node_modules/@verbal'), { recursive: true });
  symlinkSync(repo, join(dir, 'node_modules/@verbal/editor'));
  symlinkSync(join(repo, 'node_modules/joi'), join(dir, 'node_modules/joi'));
  const run = (args, input = '') =>
    new Promise((done) => {
      const child = execFile('node', [join(repo, 'cli/index.js'), ...args], { cwd: dir }, (err, stdout, stderr) => done({ code: err?.code ?? 0, out: stdout + stderr }));
      child.stdin.end(input);
    });
  return { dir, run, config: () => readFileSync(join(dir, 'verbal.config.js'), 'utf8'), write: (s) => writeFileSync(join(dir, 'verbal.config.js'), s), done: () => rmSync(dir, { recursive: true }) };
}
const doc = (blocks, children = Object.keys(blocks)) => ({ version: 1, root: 'doc', blocks: { doc: { type: 'doc', children }, ...blocks } });
const p = (text) => ({ type: 'paragraph', content: [{ text, marks: [] }] });

test('F-60: defineConfig applies defaults and rejects a bad config with its exact path', () => {
  expect(defineConfig({ blocks: ['heading'] })).toEqual({ blocks: ['heading'], marks: [], ui: [], ai: false, budget: 30 });
  const bad = (c) => {
    try {
      defineConfig(c);
    } catch (e) {
      return e.message;
    }
  };
  expect(bad({ blocks: ['heading', 'tabel'] })).toBe(`Invalid Verbal config: "blocks[1]" must be one of [${available.blocks.join(', ')}]`);
  expect(bad({ marks: ['bold', 'bold'] })).toBe('Invalid Verbal config: "marks[1]" contains a duplicate value');
  expect(bad({ budget: '30' })).toBe('Invalid Verbal config: "budget" must be a number');
  expect(bad({ blocks: ['chart'] })).toBe('Invalid Verbal config: "blocks" has chart, which draws from a table: add "table"');
  expect(bad({ theme: 'dark' })).toBe('Invalid Verbal config: "theme" is not allowed');
});

test('F-61: "verbal init" asks which modules to enable and writes a config that "verbal doctor" accepts, with each module\'s cost', async () => {
  const a = app();
  try {
    const init = await a.run(['init'], 'heading, table chart\n\nslash\ny\n');
    expect(init.code).toBe(0);
    expect(a.config()).toContain("blocks: ['heading', 'table', 'chart'],");
    expect(a.config()).toContain(`marks: [${available.marks.map((m) => `'${m}'`).join(', ')}],`);
    expect(a.config()).toContain("ui: ['slash'],");
    expect(a.config()).toContain('ai: true,');
    expect(init.out).toContain("import code from '@verbal/editor/marks/code';");
    expect(init.out).toContain("import { review } from '@verbal/editor/ai/pending';");
    expect(init.out).toContain('new Editor({ blocks: [heading, table, chart], marks: [bold, italic, strike, code, link], ui: [slash] })');
    expect((await a.run(['init', '--yes', '--force'])).out).toContain("import codeBlock from '@verbal/editor/blocks/code';");
    a.write(a.config().replace("ui: ['slash', 'toolbar', 'dnd', 'emoji']", "ui: ['slash']").replace('ai: false', 'ai: true'));
    const doctor = await a.run(['doctor']);
    expect(doctor.code).toBe(0);
    for (const row of ['core', 'react binding', 'blocks/heading', 'blocks/table', 'blocks/chart', 'marks/link', 'ui/slash', 'ai/pending']) expect(doctor.out).toMatch(new RegExp(`\\n  ${row} +\\d+\\.\\d\\d KB`));
    expect(doctor.out).toMatch(/total +\d+\.\d\d KB +\d+\.\d\d KB +budget 30 KB JS/);
    expect((await a.run(['init'])).out).toContain('exists; pass --force');
  } finally {
    a.done();
  }
});

test('F-60/F-61: "verbal doctor" fails on an invalid config with the path, and on a config over its budget', async () => {
  const a = app();
  try {
    expect((await a.run(['init', '--yes'])).code).toBe(0);
    a.write(a.config().replace("'toolbar'", "'toolbr'"));
    const invalid = await a.run(['doctor']);
    expect(invalid.code).toBe(1);
    expect(invalid.out).toContain('"ui[1]" must be one of [slash, toolbar, dnd, emoji]');
    a.write(a.config().replace("'toolbr'", "'toolbar'").replace('budget: 30', 'budget: 12'));
    const heavy = await a.run(['doctor']);
    expect(heavy.code).toBe(1);
    expect(heavy.out).toMatch(/over its 12 KB budget/);
    const typo = await a.run(['init', '--force'], 'heading tabel\n');
    expect(typo.code).toBe(1);
    expect(typo.out).toContain('"blocks[1]" must be one of');
  } finally {
    a.done();
  }
});

test('F-62: every sample page\'s document, as the editor produces it, passes server validation', async ({ page }) => {
  const docs = [];
  for (const { id, doc: d } of pages.filter((x) => x.doc)) {
    await page.goto(`/#/play/${id}`);
    await page.locator('[data-block]').first().waitFor();
    docs.push([id, await page.evaluate(() => editor.getDoc())]);
  }
  for (const [id, d] of docs) expect(validateDoc(d).error?.message, id).toBeUndefined();
  expect(await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /joi/i.test(r.name)).length)).toBe(0);
});

test('F-62: malformed documents are rejected at the boundary with the exact path, never repaired', () => {
  const ok = doc({ a: p('hi'), h: { type: 'heading', props: { level: 2 }, content: [] }, d: { type: 'divider' } });
  expect(validateDoc(ok).error).toBeUndefined();
  const reject = (mutate, config) => {
    const d = structuredClone(ok);
    mutate(d);
    return validateDoc(d, config).error?.details.map((x) => x.message);
  };
  expect(reject((d) => (d.blocks.h.props.level = 9))).toEqual(['"blocks.h.props.level" must be one of [1, 2, 3]']);
  expect(reject((d) => (d.blocks.h.props.level = '2'))).toEqual(['"blocks.h.props.level" must be one of [1, 2, 3]']);
  expect(reject((d) => (d.blocks.h.props.color = 'red'))).toEqual(['"blocks.h.props.color" is not allowed']);
  expect(reject((d) => (d.blocks.d.content = [])))
    .toEqual(['"blocks.d.content" is not allowed']);
  expect(reject((d) => (d.blocks.a.type = 'widget'))[0]).toMatch(/^"blocks.a.type" must be one of \[doc, paragraph, heading/);
  expect(reject((d) => (d.blocks.a.content[0].marks = [{ type: 'link', href: 'javascript:alert(1)' }]))).toEqual(['"blocks.a.content[0].marks[0]" contains an invalid value']);
  expect(reject((d) => (d.blocks.a.content[0].marks = [{ type: 'glow' }]))[0]).toMatch(/^"blocks.a.content\[0\].marks\[0\].type" must be one of/);
  expect(reject((d) => delete d.blocks.a.content)).toEqual(['"blocks.a.content" is required']);
  expect(reject((d) => d.blocks.doc.children.push('ghost'))).toEqual(['"blocks.doc.children[3]" refers to missing block "ghost"']);
  expect(reject((d) => (d.blocks.h.children = ['a']))).toEqual(['"blocks.h.children[0]" puts "a" in a second place']);
  expect(reject((d) => (d.blocks.lost = p('orphan')))).toEqual(['"blocks.lost" is not in the tree under "doc"']);
  expect(reject((d) => ((d.blocks.x = { ...p('x'), children: ['y'] }), (d.blocks.y = { ...p('y'), children: ['x'] })))).toEqual(['"blocks.x" is not in the tree under "doc"']);
  expect(reject((d) => (d.root = 'a'))).toEqual(['"blocks.a" is the root and must exist with type "doc"']);
  expect(reject((d) => (d.version = 2))).toEqual(['"version" must be [1]']);
  expect(reject(() => {}, defineConfig({ blocks: ['list'] }))[0]).toBe('"blocks.h.type" must be one of [doc, paragraph, list]');
});
