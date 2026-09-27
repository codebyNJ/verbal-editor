import { test, expect } from '../../playwright.config.js';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pages as examples } from '../../demo/pages.js';

const repo = resolve(import.meta.dirname, '../..');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = [...walk(join(repo, 'demo/content')).filter((f) => f.endsWith('.md')), join(repo, 'AGENTS.md')];
const docs = walk(join(repo, 'demo/content/docs')).filter((f) => f.endsWith('.md')).map((f) => ({ slug: /\d+-([\w-]+)\.md$/.exec(f)[1], md: readFileSync(f, 'utf8') }));
const title = (md) => /^title:\s*(.+)$/m.exec(md)[1];

/** Every ```js / ```jsx sample. Fences in one code group share a folder, each at its filename, so their imports resolve. */
const samples = files.flatMap((file) => {
  const out = [];
  let group = 0;
  let n = 0;
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^:::\s*code-group/.test(lines[i])) group = ++n;
    else if (/^:::\s*$/.test(lines[i])) group = 0;
    const m = /^```(jsx?)(?=\s|$)(?:\s+\[[^\]]*\])?\s*(\S*)\s*$/.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (!/^```\s*$/.test(lines[j])) j++;
    const at = `${relative(repo, file).replace(/\W+/g, '-')}-${group || ++n}`;
    out.push({ file: relative(repo, file), lang: m[1], src: lines.slice(i + 1, j).join('\n'), path: join(at, m[2] || `sample-${i}.${m[1]}`) });
    i = j;
  }
  return out;
});
const exportsMap = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).exports;
/** The file a package subpath resolves to, following the exports map (with its wildcards). */
const resolveExport = (sub) => {
  for (const [key, target] of Object.entries(exportsMap)) {
    const file = typeof target === 'string' ? target : target.default;
    const m = new RegExp(`^${key.replace('.', '\\.').replace('*', '(.+)')}$`).exec(sub);
    if (m) return join(repo, file.replace('*', m[1] ?? ''));
  }
};

test.describe('site content', () => {
  test('every docs page renders at its own address, titled by its front matter, with every reference filled in', async ({ page }) => {
    for (const { slug, md } of docs) {
      await page.goto(`/#/docs/${slug}`);
      await expect(page.locator('h1')).toHaveText(title(md));
      await expect(page.locator('[data-verbal]')).not.toContainText('{{');
    }
    await page.goto('/#/docs/shortcuts');
    await expect(page.locator('[data-verbal] [data-type=table]')).toHaveCount(4);
    await expect(page.locator('[data-verbal]')).toContainText('#␣');
  });

  test('every link in the content points at a page that exists', async ({ page, request }) => {
    // Every docs page is in llms.txt (docs-shell.spec checks that against the navigation).
    const slugs = [...(await (await request.get('/llms.txt')).text()).matchAll(/\(docs\/(.+?)\.md\)/g)].map((m) => `#/docs/${m[1]}`);
    const known = new Set([...slugs, ...examples.map((p) => `#/examples/${p.id}`), '#/', '#/benchmarks', '#/playground']);
    for (const file of files)
      for (const [, target] of readFileSync(file, 'utf8').matchAll(/\]\((#\/[^)]+)\)/g)) {
        const [path, anchor] = target.split(/(?<=.)#/);
        expect(known.has(path), `${relative(repo, file)}: ${target}`).toBe(true);
        if (anchor) {
          await page.goto(`/${path}`);
          await expect(page.locator(`[id="${anchor}"]`), `${relative(repo, file)}: ${target}`).toHaveCount(1);
        }
      }
  });

  test('code samples import only real package entries and call only real editor methods', async ({ page }) => {
    expect(samples.length).toBeGreaterThan(30);
    for (const { file, src } of samples)
      for (const [, sub] of src.matchAll(/from 'verbal-editor((?:\/[\w/.-]+)?)'/g)) {
        const target = resolveExport(`.${sub}`);
        expect(target && existsSync(target), `${file}: verbal-editor${sub}`).toBe(true);
      }
    const used = [...new Set(samples.flatMap(({ src }) => [...src.matchAll(/\beditor\.(\w+)/g)].map((m) => m[1])))];
    await page.goto('/#/examples/welcome');
    await page.locator('[data-block]').first().waitFor();
    expect(await page.evaluate((names) => names.filter((n) => !(n in editor)), used)).toEqual([]);
  });

  test('code samples type-check against the published types', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'runs tsc once');
    test.setTimeout(180_000);
    const tmp = mkdtempSync(join(tmpdir(), 'verbal-samples-'));
    try {
      mkdirSync(join(tmp, 'node_modules'), { recursive: true });
      symlinkSync(repo, join(tmp, 'node_modules/verbal-editor'));
      symlinkSync(join(repo, 'node_modules/joi'), join(tmp, 'node_modules/joi'));
      // React, React DOM and Next ship no types here; the samples need only these from them.
      const shim = (name, dts) => {
        mkdirSync(join(tmp, 'node_modules', name), { recursive: true });
        writeFileSync(join(tmp, 'node_modules', name, 'package.json'), `{ "name": "${name}", "types": "index.d.ts" }`);
        writeFileSync(join(tmp, 'node_modules', name, 'index.d.ts'), dts);
      };
      shim('react', 'export type NamedExoticComponent<P = {}> = (props: P) => unknown;\nexport function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;\n');
      shim('react-dom', '');
      writeFileSync(join(tmp, 'node_modules/react-dom/client.d.ts'), 'export function createRoot(el: Element | null): { render(node: unknown): void };\n');
      shim('next', '');
      writeFileSync(join(tmp, 'node_modules/next/dynamic.d.ts'), 'export default function dynamic(load: () => Promise<unknown>, options?: { ssr?: boolean }): (props: object) => unknown;\n');
      for (const { path, src } of samples) {
        mkdirSync(dirname(join(tmp, path)), { recursive: true });
        writeFileSync(join(tmp, path), src);
      }
      const tsc = join(repo, 'node_modules/.bin/tsc');
      // Plain-JS samples, checked the way a JS project checks them: API names and shapes, not strictness.
      const args = ['--noEmit', '--allowJs', '--checkJs', '--strict', 'false', '--noUncheckedSideEffectImports', 'false', '--jsx', 'preserve', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'esnext', '--lib', 'esnext,dom', '--preserveSymlinks', '--skipLibCheck', ...samples.map((s) => s.path)];
      const out = await new Promise((done) => execFile(tsc, args, { cwd: tmp }, (err, stdout, stderr) => done(`${stdout}${stderr}`.trim())));
      expect(out).toBe('');
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});
