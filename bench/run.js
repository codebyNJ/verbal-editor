// Measures every setup in setups/ and writes results.json — the only file the site reads.
//   npm run build            (at the repo root: Verbal is measured from dist/)
//   cd bench && npm ci && npm run bench
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const here = import.meta.dirname;
const out = join(here, 'dist');
const BLOCKS = 1000;
const MOUNT_RUNS = 5;
const TYPING_RUNS = 3;
const KEYS = 100;
const NOTION = 'https://notion.notion.site/';

const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs) => xs.toSorted((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

await build({ configFile: join(here, 'vite.config.js') });

// Sizes: a setup's JS and CSS are everything its entry imports statically (lazy chunks load later),
// minus the shared React chunk; each is gzipped as one file, like scripts/check.js.
const manifest = json(join(out, '.vite/manifest.json'));
function size(entry) {
  const seen = new Set();
  const go = (key) => {
    if (seen.has(key) || manifest[key].name === 'react') return;
    seen.add(key);
    manifest[key].imports?.forEach(go);
  };
  go(entry);
  const files = (list) => Buffer.concat(list.map((f) => readFileSync(join(out, f))));
  const js = [...seen].map((k) => manifest[k].file);
  const css = [...new Set([...seen].flatMap((k) => manifest[k].css ?? []))];
  return { js: gzipSync(files(js)).length, css: css.length ? gzipSync(files(css)).length : 0 };
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  try {
    const body = readFileSync(join(out, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const version = (pkg) => json(join(here, 'node_modules', pkg.split(' ')[0], 'package.json')).version;
const editors = [];
const open = async (name) => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?setup=${name}`);
  await page.waitForFunction(() => window.bench);
  return [page, await page.evaluate(() => bench.load())];
};

const names = await (async () => {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => window.bench);
  const list = await page.evaluate(() => bench.names);
  await page.close();
  return list;
})();

for (const name of names) {
  const [editor, setup] = name.split('-');
  const mounts = [];
  const latencies = [];
  const handling = [];
  let renders = 0;
  let packages;
  for (let run = 0; run < Math.max(MOUNT_RUNS, TYPING_RUNS); run++) {
    const [page, pkgs] = await open(name);
    packages = pkgs;
    mounts.push(await page.evaluate((n) => bench.mount(n), BLOCKS));
    if (run < TYPING_RUNS) {
      if (!(await page.evaluate(() => bench.focus()))) throw new Error(`${name}: no caret`);
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => bench.renders());
      await page.keyboard.type('x'.repeat(KEYS), { delay: 25 });
      await page.waitForTimeout(200);
      latencies.push(...(await page.evaluate(() => bench.latencies)));
      handling.push(...(await page.evaluate(() => bench.handling)));
      const lost = await page.evaluate(() => bench.lost());
      if (lost) console.warn(`${name}: ${lost} events stopped before the window`);
      renders += ((await page.evaluate(() => bench.renders())) ?? 0) - (before ?? 0);
      const typed = await page.evaluate(() => document.getElementById('root').textContent.includes('lazy dog.xxxxxxxxxx'));
      if (!typed) throw new Error(`${name}: the typed text did not land at the caret`);
    }
    await page.close();
  }
  const s = size(`setups/${name}.js`);
  const own = editor === 'verbal';
  editors.push({
    editor,
    setup,
    packages: packages.map((p) => ({ name: p, version: own ? json(join(here, '../package.json')).version : version(p) })),
    js: s.js,
    css: s.css,
    total: s.js + s.css,
    mountMs: round(median(mounts)),
    keyP95Ms: round(p95(latencies)),
    inputP95Ms: round(p95(handling), 2),
    ...(own && { rendersPerKey: renders / (KEYS * TYPING_RUNS) }),
  });
  console.log(`${name.padEnd(18)} ${String(s.js + s.css).padStart(8)} B  mount ${round(median(mounts))} ms  paint p95 ${round(p95(latencies))} ms  input p95 ${round(p95(handling), 2)} ms`);
}

// Notion: the JavaScript a browser downloads (as transferred, compressed) to open one public page, until
// its blocks have rendered and no new script has started for 3 s. Notion's own scripts are counted apart
// from third-party ones (analytics, ads). Median of 3 cold loads. No timing is taken or compared. A bot
// check instead of the page is recorded as such — never worked around.
const own = (url) => /(^|\.)notion\.(site|so|com)$/.test(new URL(url).host);
const loads = [];
let blocked = null;
for (let run = 0; run < 3 && !blocked; run++) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const scripts = [];
  let last = Date.now();
  page.on('request', (r) => r.resourceType() === 'script' && (last = Date.now()));
  page.on('requestfinished', async (r) => r.resourceType() === 'script' && scripts.push([own(r.url()), (await r.sizes()).responseBodySize]));
  await page.goto(NOTION, { waitUntil: 'load', timeout: 120_000 });
  const shown = await Promise.race([
    page.locator('[data-block-id]').first().waitFor({ timeout: 60_000 }).then(() => true),
    page.waitForFunction(() => /just a moment/i.test(document.title), null, { timeout: 60_000 }).then(() => false),
  ]).catch(() => false);
  if (!shown) blocked = `${await page.title()}: the page answered with a bot check instead of its content`;
  else {
    const t = Date.now();
    while (Date.now() - last < 3000 && Date.now() - t < 30_000) await page.waitForTimeout(250);
    const sum = (first) => scripts.filter(([o]) => o === first).reduce((n, [, bytes]) => n + bytes, 0);
    loads.push({ jsBytes: sum(true), thirdPartyJsBytes: sum(false), scripts: scripts.length });
  }
  await context.close();
}
const notion = blocked ? { url: NOTION, measured: false, reason: blocked } : { url: NOTION, measured: true, ...loads.toSorted((a, b) => a.jsBytes - b.jsBytes)[1] };
console.log('notion', notion);

const results = {
  date: new Date().toISOString().slice(0, 10),
  command: 'npm run build && cd bench && npm ci && npm run bench',
  environment: { chromium: browser.version(), node: process.version, os: `${platform()} ${release()}`, cpu: cpus()[0].model },
  method: { blocks: BLOCKS, mountRuns: MOUNT_RUNS, typingRuns: TYPING_RUNS, keystrokes: KEYS, keyDelayMs: 25 },
  editors,
  notion,
};
writeFileSync(join(here, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
server.close();
