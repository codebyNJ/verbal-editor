import { test, expect } from '../../playwright.config.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pages as examples } from '../../demo/pages.js';

const repo = resolve(import.meta.dirname, '../..');
// Generated output, installed packages and lockfiles (their metadata is written by third parties) are skipped.
const skip = /^(\.git|\.vercel|node_modules|dist|site-dist|\.playwright-mcp|package-lock\.json)$|\.(jpg|png|avif|ico|woff2)$/;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (skip.test(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
// The emoji picker's own index, and the spec that types from it, are the one place emoji belong.
const allowed = ['src/ui/emoji/data.json', 'test/e2e/media.spec.js'];

test('no emoji anywhere in the repository', () => {
  const hits = walk(repo)
    .filter((f) => !allowed.includes(relative(repo, f)))
    .flatMap((f) => readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (/\p{Extended_Pictographic}/u.test(line) ? [`${relative(repo, f)}:${i + 1}`] : [])));
  expect(hits).toEqual([]);
});

test('the logo is a 16px pixel grid, so it stays crisp at favicon size', () => {
  const svg = readFileSync(join(repo, 'demo/assets/logo.svg'), 'utf8');
  expect(svg).toContain('viewBox="0 0 16 16"');
  expect(svg).toContain('shape-rendering="crispEdges"');
  const numbers = [...svg.matchAll(/\sd="([^"]+)"/g)].flatMap(([, d]) => d.match(/-?[\d.]+/g));
  expect(numbers.length).toBeGreaterThan(0);
  expect(numbers.filter((n) => !Number.isInteger(+n))).toEqual([]);
});

test('favicon, social image and cover come from this origin', async ({ page, request }) => {
  await page.goto('/#/play/welcome');
  const icon = await page.locator('link[rel=icon]').getAttribute('href');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  for (const [href, type] of [[icon, 'image/svg+xml'], [og, 'image/jpeg']]) {
    const res = await request.get(new URL(href, page.url()).href);
    expect(res.ok(), href).toBe(true);
    expect(res.headers()['content-type'], href).toContain(type);
  }
});

test('no page renders an emoji, in text or in a label', async ({ page, request }) => {
  test.setTimeout(120_000);
  // Every address: the landing's pages and examples, every blog post, every docs page.
  const docs = [...(await (await request.get('/llms.txt')).text()).matchAll(/\(docs\/(.+?)\.md\)/g)].map((m) => `#/docs/${m[1]}`);
  await page.goto('/#/blog');
  await page.locator('[data-verbal] [data-type=cards] a').first().waitFor();
  const posts = await page.locator('[data-verbal] [data-type=cards] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const hrefs = ['#/', '#/benchmarks', '#/examples', '#/blog', '#/playground', ...examples.map((p) => `#/examples/${p.id}`), ...posts, ...docs];
  expect(hrefs.length).toBeGreaterThan(60);
  for (const href of hrefs) {
    await page.goto(`/${href}`);
    await page.locator('h1').first().waitFor();
    const found = await page.evaluate(() => {
      const text = [document.body.innerText, ...[...document.querySelectorAll('[title],[aria-label],[placeholder]')].flatMap((e) => [e.title, e.ariaLabel, e.placeholder])].join('\n');
      return text.match(/\p{Extended_Pictographic}/gu);
    });
    expect(found, href).toBeNull();
  }
});
