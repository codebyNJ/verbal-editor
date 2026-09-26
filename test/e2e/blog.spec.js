import { test, expect } from '../../playwright.config.js';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { measure } from '../../scripts/sizes.js';

const dir = resolve(import.meta.dirname, '../../demo/content/blog');
const posts = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
  const src = readFileSync(resolve(dir, f), 'utf8');
  return { slug: f.replace(/^\d+-|\.md$/g, ''), title: /^title:\s*(.+)$/m.exec(src)[1], date: /^date:\s*(.+)$/m.exec(src)[1], src };
});
const bench = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../bench/results.json'), 'utf8'));

test('blog: three or four essays, listed in the sidebar and on the Blog page, each dated', async ({ page }) => {
  expect(posts.length).toBeGreaterThanOrEqual(3);
  expect(posts.length).toBeLessThanOrEqual(4);
  await page.goto('/#/blog');
  await expect(page.locator('h1')).toHaveText('Blog');
  await expect(page.locator('[data-verbal] [data-type=cards] a')).toHaveText(posts.map((p) => p.title));
  const tree = page.getByRole('navigation', { name: 'Pages' });
  await tree.getByRole('button', { name: 'Expand Blog' }).click();
  await expect(tree.locator('a[href^="#/blog/"]')).toHaveText(posts.map((p) => p.title));
  for (const post of posts) {
    await page.goto(`/#/blog/${post.slug}`);
    await expect(page.locator('h1')).toHaveText(post.title);
    await expect(page.locator('time')).toHaveAttribute('datetime', post.date);
    await expect(page.locator('[data-verbal] [data-block]').first()).toBeVisible();
  }
});

test('blog: outside links go to primary sources over https; every figure comes from the build or the benchmark', async ({ page }) => {
  const sizes = measure();
  const full = bench.editors.filter((e) => e.setup === 'full');
  const verbal = full.find((e) => e.editor === 'verbal');
  const nearest = full.filter((e) => e.editor !== 'verbal').sort((a, b) => a.total - b.total)[0];
  const allowed = new Set([(sizes.core / 1000).toFixed(2), (sizes.preset / 1000).toFixed(2), String(verbal.rendersPerKey), (nearest.total / verbal.total).toFixed(1)]);
  for (const post of posts) {
    for (const [, href] of post.src.matchAll(/\]\((https?:[^)]+)\)/g)) expect(href, post.slug).toMatch(/^https:\/\//);
    await page.goto(`/#/blog/${post.slug}`);
    const text = await page.locator('[data-verbal]').innerText();
    const figures = (text.match(/\d[\d.,]*\d|\d/g) ?? []).filter((n) => !allowed.has(n));
    expect(figures, post.slug).toEqual([]);
  }
});
