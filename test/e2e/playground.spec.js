import { test, expect } from '../../playwright.config.js';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { measure } from '../../scripts/sizes.js';

const repo = resolve(import.meta.dirname, '../..');
const exportsMap = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).exports;
const resolveExport = (sub) => {
  for (const [key, target] of Object.entries(exportsMap)) {
    const file = typeof target === 'string' ? target : target.default;
    const m = new RegExp(`^${key.replace('.', '\\.').replace('*', '(.+)')}$`).exec(sub);
    if (m) return join(repo, file.replace('*', m[1] ?? ''));
  }
};
const kb = (n) => `${(n / 1000).toFixed(2)} KB`;
const inspector = (page) => page.getByRole('complementary', { name: 'Inspector' });
const code = (page) => page.getByLabel('Import code');
const json = (page) => page.getByLabel('Document JSON');

async function open(page, at = '/#/playground') {
  await page.goto(at);
  await page.locator('[data-verbal] [data-content]').first().waitFor();
}

test('playground: toggling a module changes the editor, the measured total and the import code, and keeps the document', async ({ page }) => {
  const sizes = measure();
  await open(page);
  await page.locator('[data-verbal] [data-content]').first().click();
  await page.keyboard.type('Keep this text');
  const all = Object.keys(sizes.modules).filter((k) => /^(blocks|marks|ui)\//.test(k) && !k.includes('/code/') && k !== 'blocks/paragraph');
  const total = (list) => sizes.core + list.reduce((n, k) => n + sizes.modules[k].js, 0);
  await expect(inspector(page).locator('[data-size] strong').first()).toHaveText(kb(total(all)));
  await inspector(page).getByRole('checkbox', { name: /^table/ }).uncheck();
  await expect(inspector(page).locator('[data-size] strong').first()).toHaveText(kb(total(all.filter((k) => k !== 'blocks/table'))));
  await expect(code(page)).not.toContainText("'@verbal/editor/blocks/table'");
  expect(await page.evaluate(() => 'table' in editor.registry.blocks)).toBe(false);
  await expect(page.locator('[data-verbal]')).toContainText('Keep this text');
  await inspector(page).getByRole('checkbox', { name: /^table/ }).check();
  await expect(code(page)).toContainText("import table from '@verbal/editor/blocks/table';");
  expect(await page.evaluate(() => 'table' in editor.registry.blocks)).toBe(true);
});

test('playground: the generated code imports only real entries, for React and for the plain DOM', async ({ page }) => {
  await open(page);
  for (const binding of ['React', 'DOM']) {
    await inspector(page).getByRole('radio', { name: binding }).click();
    const text = await code(page).textContent();
    const subs = [...text.matchAll(/from '@verbal\/editor((?:\/[\w/.-]+)?)'|import '@verbal\/editor(\/[\w.]+)'/g)].map((m) => m[1] ?? m[2]);
    expect(subs.length).toBeGreaterThan(20);
    for (const sub of subs) expect(existsSync(resolveExport(`.${sub}`) ?? ''), `${binding}: ${sub}`).toBe(true);
    expect(text).toContain(binding === 'React' ? '<Blocks editor={editor} />' : "mount(editor, document.getElementById('editor'))");
  }
});

test('playground: the document JSON follows typing, and typing costs 0 React renders', async ({ page }) => {
  await open(page);
  await page.locator('[data-verbal] [data-content]').first().click();
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.keyboard.type('live json');
  await expect(json(page)).toContainText('"text": "live json"');
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  expect(JSON.parse(await json(page).textContent())).toEqual(await page.evaluate(() => editor.getDoc()));
});

test('playground: device frames resize the editor, and reset starts over', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const frame = page.locator('[data-frame]');
  for (const [name, width] of [['390', 390], ['768', 768]]) {
    await page.getByRole('radio', { name }).click();
    await expect.poll(() => frame.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(width);
  }
  await page.locator('[data-verbal] [data-content]').first().click();
  await page.keyboard.type('# Gone after reset');
  await inspector(page).getByRole('checkbox', { name: /^math/ }).uncheck();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('[data-verbal]')).not.toContainText('Gone after reset');
  await expect(inspector(page).getByRole('checkbox', { name: /^math/ })).toBeChecked();
});

test('playground: a share link carries the document and the module choice through the URL', async ({ page, context }) => {
  await open(page);
  await page.locator('[data-verbal] [data-content]').first().click();
  await page.keyboard.type('## Shared heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('and a paragraph');
  await inspector(page).getByRole('checkbox', { name: /^embed/ }).uncheck();
  await page.evaluate(() => (navigator.clipboard.writeText = async (t) => void (window.__copied = t)));
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(page.getByRole('status')).toHaveText('Share link copied.');
  const link = await page.evaluate(() => window.__copied);
  expect(link).toMatch(/#\/playground\/v1\.[\w-]+$/);
  const other = await context.newPage();
  await open(other, link);
  await expect(other.getByRole('status')).toHaveText('Loaded from a shared link.');
  await expect(other.locator('[data-verbal] h2')).toHaveText('Shared heading');
  await expect(other.locator('[data-verbal]')).toContainText('and a paragraph');
  await expect(inspector(other).getByRole('checkbox', { name: /^embed/ })).not.toBeChecked();
  await expect(inspector(other).getByRole('checkbox', { name: /^table/ })).toBeChecked();
  await other.close();
});

test('playground: a broken share link says so and starts blank', async ({ page }) => {
  await open(page, '/#/playground/not-a-real-link');
  await expect(page.getByRole('status')).toHaveText('This link could not be read, so the page starts blank.');
});
