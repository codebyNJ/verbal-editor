import { test, expect } from '../../playwright.config.js';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pages } from '../../demo/pages.js';

const src = resolve(import.meta.dirname, '../../src');
const listed = pages.filter((p) => !p.hidden);
const used = (kind) => new Set(listed.flatMap((p) => Object.values(p.doc?.blocks ?? {}).flatMap((b) => (kind === 'blocks' ? [b.type] : (b.content ?? []).flatMap((r) => r.marks.map((m) => m.type))))));

test('examples: 6 to 8 pages in the sidebar, and together they use every module', async ({ page }) => {
  expect(listed.length).toBeGreaterThanOrEqual(6);
  expect(listed.length).toBeLessThanOrEqual(8);
  const blocks = used('blocks');
  for (const name of readdirSync(resolve(src, 'blocks'))) expect(blocks.has(name), `blocks/${name}`).toBe(true);
  expect(blocks.has('column')).toBe(true);
  const marks = used('marks');
  for (const f of readdirSync(resolve(src, 'marks'))) expect(marks.has(f.replace('.js', '')), `marks/${f}`).toBe(true);
  await page.goto('/#/examples');
  const tree = page.getByRole('navigation', { name: 'Pages' });
  await tree.getByRole('button', { name: 'Expand Examples' }).click();
  await expect(tree.locator('a[href^="#/examples/"]')).toHaveText(listed.map((p) => p.title));
  await page.goto('/#/examples/welcome');
  await page.locator('[data-verbal] [data-block]').first().waitFor();
  expect((await page.evaluate(() => editor.ui.map((u) => u.name))).sort()).toEqual(readdirSync(resolve(src, 'ui')).sort());
  await page.goto('/#/examples/ai');
  await expect(page.getByRole('button', { name: /Suggest edits/ })).toBeVisible();
});

test('examples: each page ends with links to its docs, and every one resolves', async ({ page }) => {
  for (const { id } of listed) {
    await page.goto(`/#/examples/${id}`);
    const doc = page.locator('[data-verbal]');
    await expect(doc.locator('h2').last()).toHaveText('Read more');
    const hrefs = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('[data-verbal] > [data-block]')];
      const at = tops.findLastIndex((b) => b.textContent === 'Read more');
      return tops.slice(at + 1).map((b) => b.querySelector('a')?.getAttribute('href'));
    });
    expect(hrefs.length, id).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, id).toMatch(/^#\//);
      await page.goto(`/${href}`);
      await expect(page.locator('h1').first(), `${id} → ${href}`).not.toHaveText('Page not found');
      await page.goBack();
    }
  }
});

test('examples: old addresses still land on a page', async ({ page }) => {
  for (const [from, to] of [['play/formatting', 'examples/welcome'], ['play/structure', 'examples/welcome'], ['play/core', 'examples/core'], ['bench', 'bench'], ['play/theming', 'examples/theming']]) {
    await page.goto(`/#/${from}`);
    await expect(page).toHaveURL(new RegExp(`#/${to}$`));
    await expect(page.locator('h1').first()).not.toHaveText('Page not found');
  }
});

test('examples: Core only is the bare editor on the DOM binding — no React, same render counting', async ({ page }) => {
  await page.goto('/#/examples/core');
  await page.locator('[data-verbal] [data-content]').first().waitFor();
  expect(await page.evaluate(() => Object.keys(editor.registry.blocks))).toEqual(['paragraph']);
  // React renders its hosts with no host attributes of its own; the DOM binding writes the same markup.
  expect(await page.evaluate(() => [...document.querySelectorAll('[data-verbal] > [data-block]')].map((h) => [h.dataset.type, h.className]))).toEqual([
    ['paragraph', 'v-paragraph-paragraph'],
    ['paragraph', 'v-paragraph-paragraph'],
  ]);
  const [a] = await page.evaluate(() => editor.getDoc().blocks.doc.children);
  await page.evaluate((a) => editor.select({ anchor: { block: a, offset: 4 }, focus: { block: a, offset: 4 } }), a);
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.keyboard.type('typed');
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  await page.keyboard.press('Enter');
  expect((await page.evaluate(() => window.__renderIds.splice(0))).length).toBe(2);
  await expect(page.locator('[data-verbal] > [data-block]')).toHaveCount(3);
});
