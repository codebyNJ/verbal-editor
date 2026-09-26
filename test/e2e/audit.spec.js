import { test, expect } from '../../playwright.config.js';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pages as examples } from '../../demo/pages.js';

// The final pass: every page of both products, at every width, in both themes, and on touch phones.
const repo = resolve(import.meta.dirname, '../..');
const landing = ['', 'benchmarks', 'examples', 'blog', 'playground', ...examples.map((p) => `examples/${p.id}`)];
const widths = [320, 390, 768, 1024, 1440, 2560];
const isPhone = (testInfo) => /^mobile/.test(testInfo.project.name);

async function every(page, request) {
  const docs = [...(await (await request.get('/llms.txt')).text()).matchAll(/\(docs\/(.+?)\.md\)/g)].map((m) => `docs/${m[1]}`);
  await page.goto('/#/blog');
  await page.locator('[data-verbal] [data-type=cards] a').first().waitFor();
  const posts = await page.locator('[data-verbal] [data-type=cards] a').evaluateAll((as) => as.map((a) => a.getAttribute('href').slice(2)));
  return [...landing, ...posts, ...docs];
}
async function visit(page, route) {
  // Every address has its own title: waiting for it to change means the new page has rendered.
  const was = await page.title().catch(() => '');
  await page.goto(`/#/${route}`);
  await page.waitForFunction((t) => document.title !== t, was, { timeout: 3000 }).catch(() => {});
  await page.locator('h1').first().waitFor();
  await page.locator('[data-verbal] [data-block]').first().waitFor({ timeout: 2000 }).catch(() => {});
}
/** Text that runs off the screen outside a scroller, or is cut off by overflow without an ellipsis. */
const problems = (page) =>
  page.evaluate(() => {
    const out = [];
    const name = (el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''} "${el.textContent.trim().slice(0, 24)}"`;
    const hidden = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const st = getComputedStyle(e);
        if (st.visibility === 'hidden' || +st.opacity === 0 || st.clipPath !== 'none' || e.hidden) return true;
      }
      return false;
    };
    const inScroller = (el) => {
      for (let e = el.parentElement; e; e = e.parentElement) if (/auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth) return true;
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) || !el.getClientRects().length || hidden(el)) continue;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      // An ellipsis only shows for a block's own text: in a flex or grid box the text is cut without one.
      const ellipsis = st.textOverflow === 'ellipsis' && !/flex|grid/.test(st.display);
      if (/hidden|clip/.test(st.overflowX) && !ellipsis && el.scrollWidth > el.clientWidth + 1) out.push(`clipped ${name(el)}`);
      if ((r.right > innerWidth + 1 || r.left < -1) && !inScroller(el)) out.push(`off screen ${name(el)}`);
    }
    if (document.documentElement.scrollWidth > innerWidth) out.push(`page scrolls sideways by ${document.documentElement.scrollWidth - innerWidth}px`);
    return out;
  });
/** Text colours under 4.5:1 (3:1 for large text) against what is actually behind them. */
const lowContrast = (page) =>
  page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const behind = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if ((c[3] ?? 1) >= 0.5) return c;
      }
      return rgb(getComputedStyle(document.body).backgroundColor);
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) || !el.getClientRects().length) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || +st.opacity === 0 || el.closest('svg, [aria-hidden="true"]')) continue;
      const [a, b] = [lum(rgb(st.color)), lum(behind(el))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      const large = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && +st.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
    }
    return out;
  });

test('audit: no page overflows or clips its text, at every width', async ({ page, request }, testInfo) => {
  test.skip(!['chromium', 'mobile-chrome', 'mobile-safari'].includes(testInfo.project.name), 'widths once on desktop, then on each phone');
  test.setTimeout(600_000);
  const routes = await every(page, request);
  for (const width of isPhone(testInfo) ? [page.viewportSize().width] : widths) {
    if (!isPhone(testInfo)) await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await visit(page, route);
      expect(await problems(page), `#/${route} at ${width}px`).toEqual([]);
    }
  }
});

test('audit: every text colour meets AA in both themes, on both products', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'colours are the same in every engine');
  test.setTimeout(300_000);
  const routes = ['', 'benchmarks', 'examples/welcome', 'examples/code', 'examples/tables', 'blog/suggestions-not-replacements', 'playground', 'docs/introduction', 'docs/quickstart', 'docs/modules/blocks/table', 'docs/editor-api', 'docs/changelog'];
  for (const theme of ['dark', 'light']) {
    await page.addInitScript((t) => localStorage.setItem('verbal:theme', t), theme);
    for (const route of routes) {
      await visit(page, route);
      expect(await lowContrast(page), `#/${route} in ${theme}`).toEqual([]);
    }
  }
});

test('audit: keyboard focus is always visible', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), 'keyboard focus is a desktop concern');
  for (const route of ['', 'docs/quickstart', 'playground']) {
    await visit(page, route);
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        // In editable text the caret is the focus indicator.
        if (!el || el === document.body || el.isContentEditable) return 'text';
        // A field's ring may be drawn around its label (:focus-within).
        const ringed = [el, el.closest('label')].filter(Boolean).some((x) => getComputedStyle(x).outlineStyle !== 'none' && parseFloat(getComputedStyle(x).outlineWidth) > 0);
        return ringed ? 'ring' : `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 20)}`;
      });
      expect(['ring', 'text'], `#/${route}: tab ${i + 1}`).toContain(ring);
    }
  }
});

test('audit: nothing animates under reduced motion, on either product', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['', 'examples/tables', 'docs/how-it-works', 'playground']) {
    await visit(page, route);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), `#/${route}`).toBe(0);
  }
});

test('audit: on a touch screen every control in both shells is at least 44 × 44 px', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'touch phones only');
  const small = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('header button, header a, aside button, aside a, [role=tab], [role=radio], [aria-label="Copy code"], [aria-label="More page actions"]')]
        .filter((el) => el.getClientRects().length && !el.closest('[data-verbal] [data-content]'))
        // Off-canvas (a closed sidebar or drawer) is not on the screen to be tapped.
        .filter((el) => { for (let e = el; e; e = e.parentElement) { const st = getComputedStyle(e); if (st.visibility === 'hidden' || +st.opacity === 0) return false; } return true; })
        .map((el) => [el, el.getBoundingClientRect()])
        .filter(([, r]) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
        .map(([el, r]) => `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
  for (const route of ['', 'examples/welcome', 'playground', 'docs/quickstart']) {
    await visit(page, route);
    expect(await small(), `#/${route}`).toEqual([]);
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  expect(await small(), 'docs drawer').toEqual([]);
});

test('audit: the npm package ships AGENTS.md next to the code', ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'runs npm once');
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: repo, encoding: 'utf8' }));
  const files = pack.files.map((f) => f.path);
  expect(files).toContain('AGENTS.md');
  expect(files).toContain('dist/dom.js');
  expect(files.some((f) => /^(demo|bench|site-dist|test)\//.test(f))).toBe(false);
});
