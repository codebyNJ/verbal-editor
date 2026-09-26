import { test, expect } from '../../playwright.config.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { commands } from '../../src/blocks/math/latex.js';

const repo = resolve(import.meta.dirname, '../..');
const src = (...p) => join(repo, 'src', ...p);
/** Every module on disk: a directory under blocks/ and ui/, a file under marks/ and ai/. */
const modules = [
  ...readdirSync(src('blocks')).map((name) => ['blocks', name, src('blocks', name, 'index.js')]),
  ...readdirSync(src('ui')).map((name) => ['ui', name, src('ui', name, 'index.js')]),
  ...readdirSync(src('marks')).filter((f) => f.endsWith('.js')).map((f) => ['marks', f.replace('.js', ''), src('marks', f)]),
  ...readdirSync(src('ai')).filter((f) => f.endsWith('.js')).map((f) => ['ai', f.replace('.js', ''), src('ai', f)]),
];
/** The first paragraph of a module's JSDoc header as the page shows it: lines joined, `code` and **bold** as plain text. */
const header = (file) =>
  /^\/\*\*([\s\S]*?)\*\//.exec(readFileSync(file, 'utf8'))[1].replace(/^\s*\*\s?/gm, '').trim().split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ').replace(/``\s?(.+?)\s?``|`([^`]+)`|\*\*(.+?)\*\*/g, (_, a, b, c) => a ?? b ?? c).trim();
const ftr = readFileSync(join(repo, 'docs/02-ftr.md'), 'utf8');
const kb = (n) => `${(n / 1000).toFixed(2)} KB`;
const body = (page) => page.locator('[data-verbal]');
/** The cell `n` columns right of the table cell whose text is `label`. */
const row = (page, label, n = 1) => body(page).locator('[data-type=table] > [data-children] > [data-block]').filter({ hasText: new RegExp(`^${label}$`) }).locator(`xpath=following-sibling::*[${n}]`);

async function open(page, kind, name) {
  await page.goto(`/#/docs/modules/${kind}/${name}`);
  await expect(page.locator('h1')).toHaveText(`${kind}/${name}`);
  await body(page).locator('[data-block]').first().waitFor();
}

test('F-64: every module on disk has a generated page in the docs navigation', async ({ page }) => {
  await page.goto('/#/docs/modules');
  await page.getByRole('complementary', { name: 'Docs' }).locator('a[data-generated]').first().waitFor();
  const links = await page.getByRole('complementary', { name: 'Docs' }).locator('a[data-generated]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(links.sort()).toEqual(modules.map(([kind, name]) => `#/docs/modules/${kind}/${name}`).sort());
});

test("F-64: each page is the module's own JSDoc, its measured size, and the FTR rows it cites", async ({ page }) => {
  for (const [kind, name, file] of modules) {
    await open(page, kind, name);
    const text = header(file);
    await expect(body(page).locator('[data-type=paragraph]').first()).toHaveText(text);
    const built = join(repo, 'dist', kind, `${name}.js`);
    if (!existsSync(built)) await expect(body(page)).toContainText('part of the core bundle');
    else await expect(body(page).locator('[data-type=table]').first()).toContainText(kb(gzipSync(readFileSync(built)).length));
    for (const [, a, b = a] of text.matchAll(/F-(\d\d)(?:…F-(\d\d))?/g))
      for (let n = +a; n <= +b; n++) {
        const id = `F-${String(n).padStart(2, '0')}`;
        const feature = ftr.split('\n').find((l) => l.startsWith(`| ${id} |`)).split('|')[2].trim();
        await expect(body(page).getByText(`${id} · ${feature}`, { exact: true })).toBeVisible();
      }
  }
});

test('F-64: the contract is read off the module object, so it matches the registry exactly', async ({ page }) => {
  for (const name of ['heading', 'table', 'code', 'image']) {
    await open(page, 'blocks', name);
    const [props, slash] = await page.evaluate((name) => {
      const m = editor.registry.blocks[name];
      const type = (s) => (Array.isArray(s) ? s.join(' | ') : s.name.toLowerCase());
      return [Object.entries(m.schema.props ?? {}).map(([k, s]) => `${k}: ${type(s)}`), [m.slash].flat().map((e) => `${e.icon} ${e.label}`)];
    }, name);
    await expect(row(page, 'Props').locator('code')).toHaveText(props);
    await expect(row(page, 'Slash menu').locator('code')).toHaveText(slash);
  }
  await open(page, 'marks', 'bold');
  await expect(row(page, 'Shortcut')).toHaveText('⌘B');
  await expect(row(page, 'Markdown')).toHaveText('**');
});

test('F-64: exported functions are listed with their JSDoc; math lists every supported LaTeX command', async ({ page }) => {
  await open(page, 'blocks', 'table');
  await expect(body(page).locator('h3')).toHaveText(['addRow(editor, table, row)', 'addColumn(editor, table, col)', 'removeRow(editor, table, row)', 'removeColumn(editor, table, col)']);
  await open(page, 'ai', 'pending');
  await expect(body(page).locator('h3')).toHaveText(['review(editor, changes)']);
  await expect(body(page)).toContainText('Proposes new text for blocks');
  await expect(row(page, 'changes', 2)).toContainText('block id → proposed text');
  await open(page, 'blocks', 'math');
  const list = body(page).locator('[data-type=paragraph]').filter({ has: page.locator('code', { hasText: /^frac$/ }) }).locator('code');
  await expect(list).toHaveCount(commands.length);
  await expect(list.filter({ hasText: /^frac$/ })).toHaveCount(1);
});

test('F-64: each page links to a live example, where the module is a real editor: typing costs 0 renders and goes into the model', async ({ page }) => {
  await open(page, 'blocks', 'heading');
  await body(page).getByRole('link', { name: 'Writing' }).click();
  await expect(page).toHaveURL(/#\/examples\/welcome$/);
  const heading = page.locator('[data-verbal] [data-type=heading] [data-content]').first();
  await heading.click();
  await page.keyboard.press('End');
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.keyboard.type(' live');
  const id = await heading.evaluate((el) => el.closest('[data-block]').dataset.block);
  expect(await page.evaluate((id) => editor.get(id).content.map((r) => r.text).join(''), id)).toMatch(/ live$/);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
});
