import { test, expect } from '../../playwright.config.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bench = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../bench/results.json'), 'utf8'));
const pins = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../bench/package.json'), 'utf8')).dependencies;
const names = { verbal: 'Verbal', tiptap: 'Tiptap', lexical: 'Lexical', blocknote: 'BlockNote', plate: 'Plate', editorjs: 'Editor.js', quill: 'Quill' };
const one = (n) => (Math.round(n * 10) / 10).toFixed(1);
const row = (editor, setup) => bench.editors.find((e) => e.editor === editor && e.setup === setup);
/** A table's cells as rows of text. */
const cells = (table) =>
  table.evaluate((t) => {
    const cols = +getComputedStyle(t).getPropertyValue('--cols').match(/repeat\((\d+)/)?.[1] || t.querySelector('[data-children]').children.length;
    const texts = [...t.querySelector(':scope > [data-children]').children].map((c) => c.textContent.trim());
    return Array.from({ length: texts.length / cols }, (_, r) => texts.slice(r * cols, r * cols + cols));
  });

async function open(page) {
  await page.goto('/#/benchmarks');
  await expect(page.locator('h1')).toHaveText('Benchmarks');
  await page.locator('[data-verbal] [data-type=chart] svg').first().waitFor();
}
const tables = (page) => page.locator('[data-verbal] > [data-block][data-type=table]');

test('benchmarks: every table is bench/results.json, and each chart draws the table above it', async ({ page }) => {
  await open(page);
  const expected = [
    ['total', (v) => one(v / 1000)],
    ['mountMs', String],
    ['inputP95Ms', String],
  ];
  for (const [i, [metric, show]] of expected.entries()) {
    const rows = await cells(tables(page).nth(i));
    expect(rows.slice(1)).toEqual(Object.keys(names).map((e) => [names[e], show(row(e, 'minimal')[metric]), show(row(e, 'full')[metric])]));
    const chart = page.locator('[data-verbal] [data-type=chart]').nth(i);
    await expect(chart.locator('rect')).toHaveCount(Object.keys(names).length * 2);
  }
});

test('benchmarks: the Notion row is labelled, dated and never a speed', async ({ page }) => {
  await open(page);
  const notion = page.locator('[data-verbal] > [data-block][data-type=paragraph]', { hasText: /not measured|downloaded/ });
  await expect(notion).toContainText(bench.date);
  await expect(notion).toContainText(bench.notion.measured ? 'download size' : 'not measured');
  const last = (await cells(tables(page).nth(4))).at(-1);
  expect(last[0]).toBe('Notion (public page)');
  expect(last.slice(4)).toEqual(['—', '—', '—']);
});

test('benchmarks: method, versions, date and the command to reproduce are on the page', async ({ page }) => {
  await open(page);
  const doc = page.locator('[data-verbal]');
  await expect(doc).toContainText(bench.environment.chromium);
  await expect(doc).toContainText(`${bench.method.blocks} paragraphs`);
  for (const [name, version] of Object.entries(pins)) if (!/^(react|react-dom)$/.test(name) && bench.editors.some((e) => e.packages.some((p) => p.name === name))) await expect(doc).toContainText(`${name}@${version}`);
  await expect(doc.locator('pre')).toContainText('cd bench && npm ci && npm run bench');
});

test('benchmarks: the charts are live — editing a number redraws its chart with 0 React renders', async ({ page }) => {
  await open(page);
  const bars = () => page.locator('[data-verbal] [data-type=chart]').first().locator('rect').evaluateAll((rs) => rs.map((r) => Math.round(+r.getAttribute('height'))));
  const before = await bars();
  const cell = tables(page).first().locator(':scope > [data-children] > [data-block]').nth(4).locator('[data-content]');
  await cell.click();
  const id = await cell.evaluate((el) => el.closest('[data-block]').dataset.block);
  await page.evaluate((block) => editor.select({ anchor: { block, offset: 0 }, focus: { block, offset: 0 } }), id);
  await page.evaluate(() => window.__renderIds.splice(0));
  await page.keyboard.type('9');
  await expect.poll(bars).not.toEqual(before);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
});
