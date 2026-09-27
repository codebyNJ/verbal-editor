import { test, expect } from '../../playwright.config.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { measure } from '../../scripts/sizes.js';

// What crawlers, answer engines and share previews read: the raw HTML, before any script runs.
const repo = resolve(import.meta.dirname, '../..');
const home = JSON.parse(readFileSync(resolve(repo, 'package.json'), 'utf8')).homepage;
const pkg = JSON.parse(readFileSync(resolve(repo, 'package.json'), 'utf8'));
const tag = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1]?.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
const local = (url) => new URL(url).pathname + new URL(url).search;

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium', 'the served HTML is the same for every engine'));

test('seo: every share preview gets a title, the measured description and an absolute 1200 × 630 image', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const title = html.match(/<title>(.*)<\/title>/)[1];
  const description = tag(html, 'name', 'description');
  expect(title).toBe('Verbal — a quiet place to write');
  const bench = JSON.parse(readFileSync(resolve(repo, 'bench/results.json'), 'utf8')).editors.filter((e) => e.setup === 'full');
  const [verbal, tiptap] = ['verbal', 'tiptap'].map((n) => bench.find((e) => e.editor === n));
  expect(description).toContain(`${(measure().core / 1000).toFixed(2)} KB at its core`);
  expect(description).toContain(`${(Math.round((tiptap.total / verbal.total) * 10) / 10).toFixed(1)}× smaller than Tiptap`);
  expect(description.length).toBeLessThanOrEqual(160);
  for (const [attr, name, value] of [
    ['property', 'og:title', title], ['name', 'twitter:title', title],
    ['property', 'og:description', description], ['name', 'twitter:description', description],
    ['property', 'og:url', `${home}/`], ['property', 'og:type', 'website'], ['name', 'twitter:card', 'summary_large_image'],
  ]) expect(tag(html, attr, name), name).toBe(value);
  expect(html).toContain(`<link rel="canonical" href="${home}/" />`);
  // The image: absolute, the same for every platform, versioned by its content, and really 1200 × 630.
  const image = tag(html, 'property', 'og:image');
  expect(tag(html, 'name', 'twitter:image')).toBe(image);
  expect(image.startsWith(`${home}/og.png?v=`)).toBe(true);
  const res = await request.get(local(image));
  expect(res.headers()['content-type']).toContain('image/png');
  const png = await res.body();
  expect(image.endsWith(createHash('sha256').update(png).digest('hex').slice(0, 8))).toBe(true);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect([tag(html, 'property', 'og:image:width'), tag(html, 'property', 'og:image:height')]).toEqual(['1200', '630']);
  expect(png.length).toBeLessThan(300_000);
  expect(tag(html, 'property', 'og:image:alt')).toBeTruthy();
});

test('seo: structured data describes the package and carries the same FAQ the page shows', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  const [app, faq] = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  expect(app).toMatchObject({ '@type': 'SoftwareApplication', name: 'Verbal', alternateName: pkg.name, softwareVersion: pkg.version, url: `${home}/` });
  expect(app.license).toContain(pkg.license);
  expect(faq['@type']).toBe('FAQPage');
  await page.goto('/#/');
  await page.locator('details[name=faq]').first().waitFor();
  const shown = await page.locator('details[name=faq]').evaluateAll((ds) => ds.map((d) => [d.querySelector('summary').textContent, d.querySelector('p').textContent]));
  expect(faq.mainEntity.map((q) => q.name)).toEqual(shown.map(([q]) => q));
  faq.mainEntity.forEach((q, i) => expect(shown[i][1].startsWith(q.acceptedAnswer.text), q.name).toBe(true));
  // Crawlers that run no script still read the headline, the description and every answer.
  const text = html.match(/<noscript>(.*?)<\/noscript>/s)[1];
  expect(text).toContain('<h1>Verbal — a quiet place to write</h1>');
  for (const q of faq.mainEntity) expect(text).toContain(`<h2>${q.name}</h2>`);
});

test('seo: robots.txt lets every crawler in, and the sitemap lists every page it can read', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('User-agent: *\nAllow: /');
  expect(robots).toContain(`Sitemap: ${home}/sitemap.xml`);
  const urls = [...(await (await request.get('/sitemap.xml')).text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const docs = [...(await (await request.get('/llms.txt')).text()).matchAll(/\((docs\/.+?\.md)\)/g)].map((m) => `${home}/${m[1]}`);
  expect(urls).toEqual(expect.arrayContaining([`${home}/`, `${home}/llms.txt`, `${home}/llms-full.txt`, `${home}/AGENTS.md`, ...docs]));
  for (const url of urls) expect((await request.get(local(url))).ok(), url).toBe(true);
});
