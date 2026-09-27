import { test, expect } from '../../playwright.config.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { measure } from '../../scripts/sizes.js';

// The landing (#/): every figure traced to its source, every link followed, and the page checked at every width.
const repo = resolve(import.meta.dirname, '../..');
const bench = JSON.parse(readFileSync(resolve(repo, 'bench/results.json'), 'utf8'));
const full = bench.editors.filter((e) => e.setup === 'full');
const verbal = full.find((e) => e.editor === 'verbal');
const others = full.filter((e) => e.editor !== 'verbal').toSorted((a, b) => a.total - b.total);
const [next, largest] = [others[0], others.at(-1)];
const kb = (n) => (n / 1000).toFixed(2);
const one = (n) => (Math.round(n * 10) / 10).toFixed(1);
const names = (e) => ({ quill: 'Quill', blocknote: 'BlockNote', tiptap: 'Tiptap', lexical: 'Lexical', plate: 'Plate', editorjs: 'Editor.js' })[e.editor];
const script = ['A quiet place to write', 'Type / for any block, or Markdown as you go.', 'Ship the landing page', 'const editor = new Editor({ ...preset });'];

async function open(page) {
  await page.goto('/#/');
  await page.locator('h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
/** Scroll through the whole page, so lazy images load and every section is observed once. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 30)));
    }
  });
}

test('landing: nothing crosses the edge of the screen at any width', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'mobile-chrome', 'mobile-safari'].includes(testInfo.project.name), 'every width once on desktop, then on each phone');
  const phone = /^mobile/.test(testInfo.project.name);
  for (const width of phone ? [page.viewportSize().width] : [320, 390, 768, 1024, 1440, 2560]) {
    if (!phone) await page.setViewportSize({ width, height: 900 });
    await open(page);
    // The page clips sideways overflow (overflow-x: clip), so scrollWidth alone would hide it: measure every element.
    const out = await page.evaluate(() => {
      const inScroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) if (/auto|scroll/.test(getComputedStyle(e).overflowX)) return true; return false; };
      return [...document.querySelectorAll('header *, main *, footer *')]
        .filter((el) => el.getClientRects().length && !inScroller(el) && !el.closest('[inert]'))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5); })
        .map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}"`)
        .concat(document.documentElement.scrollWidth > innerWidth ? ['the page scrolls sideways'] : []);
    });
    expect(out, `${width}px`).toEqual([]);
  }
});

test('landing: no emoji, one h1, and the display face and hero art are preloaded', async ({ page }) => {
  await open(page);
  const text = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label],[alt],[title]')].flatMap((e) => [e.ariaLabel, e.alt, e.title])].join('\n'));
  expect(text.match(/\p{Extended_Pictographic}/gu)).toBeNull();
  await expect(page.locator('h1')).toHaveCount(1);
  expect(await page.locator('link[rel=preload]').evaluateAll((ls) => ls.map((l) => `${l.as} ${l.getAttribute('href')}`))).toEqual(
    expect.arrayContaining(['font ./fonts/league-gothic-latin.woff2', 'image ./landing/writer.png']),
  );
});

test('landing: loads none of the docs or workspace code', async ({ page }) => {
  const loaded = [];
  page.on('request', (r) => loaded.push(new URL(r.url()).pathname));
  await open(page);
  await scrollThrough(page);
  expect(loaded.filter((p) => /\/assets\/(Docs|Workspace|markdown)-/.test(p))).toEqual([]);
  expect(loaded.some((p) => /\/assets\/Landing-.+\.js$/.test(p))).toBe(true);
});

test('landing: every figure equals bench/results.json or the size build', async ({ page }) => {
  const sizes = measure();
  await open(page);
  await expect(page.locator('[data-figure=core]')).toHaveText(kb(sizes.core));
  await expect(page.locator('main p').first()).toContainText(`${kb(sizes.core)} KB`);
  await expect(page.locator('[data-figure=renders]')).toHaveText(String(verbal.rendersPerKey));
  // Every "smaller" is a number: the largest multiple leads, the closest follows.
  const times = (e) => one(e.total / verbal.total);
  await expect(page.locator('[data-figure=smaller]')).toHaveText(times(largest));
  const tiptap = full.find((e) => e.editor === 'tiptap');
  await expect(page.getByText(new RegExp(`^Smaller than ${names(largest)}:`))).toHaveText(
    `Smaller than ${names(largest)}: ${one(largest.total / 1000)} KB against ${one(verbal.total / 1000)} KB. Tiptap is ${times(tiptap)}× larger; the closest, ${names(next)}, ${times(next)}×. JavaScript and CSS, gzipped.`,
  );
  // The benchmark headline: one line per editor measured, largest multiple first.
  expect(await page.locator('#bench-title span').allTextContents()).toEqual(others.toReversed().map((e) => `${times(e)}× smaller than ${names(e)}.`));
  await expect(page.getByText(`measured in ${bench.method.blocks.toLocaleString('en')} blocks`)).toBeVisible();
  // The bars: every full setup, largest first, at its measured size.
  const bars = await page.locator('li[data-editor]').evaluateAll((ls) => ls.map((l) => [l.dataset.editor, l.querySelector('[data-value]').textContent]));
  expect(bars).toEqual(full.toSorted((a, b) => b.total - a.total).map((e) => [e.editor, one(e.total / 1000)]));
  const fine = page.getByText(/^Measured .+ in Chromium/);
  await expect(fine).toContainText(new Date(`${bench.date}T00:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }));
  await expect(fine).toContainText(bench.environment.chromium);
  for (const e of full) await expect(fine).toContainText(e.packages[0].version);
  await expect(page.locator('details', { hasText: 'How big is it?' })).toContainText(`${kb(sizes.core)} KB of JavaScript, gzipped; every module together is ${kb(sizes.preset)} KB`);
  // Size and renders are claimed; speed and Notion are not.
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/notion|faster|fastest editor|blazing/i);
});

test('landing: every link and image resolves', async ({ page, request }) => {
  test.setTimeout(120_000);
  await open(page);
  await scrollThrough(page);
  const hrefs = [...new Set(await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))];
  const images = await page.locator('img').evaluateAll((is) => is.map((i) => [i.currentSrc, i.complete && i.naturalWidth > 0]));
  for (const [src, ok] of images) expect(ok, src).toBe(true);
  expect(hrefs.length).toBeGreaterThan(20);
  const origin = new URL(page.url()).origin;
  for (const href of hrefs.filter((h) => !h.startsWith('#'))) {
    const res = await request.get(new URL(href, `${origin}/`).href);
    expect(res.ok(), href).toBe(true);
    expect((await res.text()).length, href).toBeGreaterThan(100);
  }
  for (const href of hrefs.filter((h) => h.startsWith('#/') && h !== '#/')) {
    await page.goto('about:blank');
    await page.goto(`/${href}`);
    await expect(page.locator('h1').first(), href).toBeVisible();
    await expect(page.locator('h1').first(), href).not.toHaveText(/Page not found/);
  }
});

test('landing: the FAQ opens and closes by keyboard, one answer at a time', async ({ page }, testInfo) => {
  test.skip(/mobile/.test(testInfo.project.name), 'keyboard');
  await open(page);
  const rows = page.locator('details[name=faq]');
  await expect(rows).toHaveCount(7);
  await rows.nth(0).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(rows.nth(0)).toHaveAttribute('open', '');
  await expect(rows.nth(0).getByRole('link')).toBeVisible();
  await rows.nth(1).locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(rows.nth(1)).toHaveAttribute('open', '');
  await expect(rows.nth(0)).not.toHaveAttribute('open');
  await page.keyboard.press('Enter');
  await expect(rows.nth(1)).not.toHaveAttribute('open');
  for (let i = 0; i < 7; i++) await expect(rows.nth(i).locator('a')).toHaveAttribute('href', /^#\/docs\//);
});

test('landing: the install tabs work by keyboard and copy the chosen command', async ({ page }, testInfo) => {
  test.skip(/mobile/.test(testInfo.project.name), 'keyboard');
  await open(page);
  await page.evaluate(() => (navigator.clipboard.writeText = async (t) => void (window.__copied = t)));
  await page.getByRole('tab', { name: 'npm', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'pnpm' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'bun' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Copy command' }).click();
  expect(await page.evaluate(() => window.__copied)).toBe('bun add verbal-editor');
  // The choice carries into the docs' code groups.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('verbal:tabs'))[0])).toBe('bun');
});

test('landing: the caret types the demo, hands over, and React never re-renders', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'the scripted caret needs a fine pointer; engines are covered by the reduced-motion test');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const demo = page.locator('[data-verbal]');
  await demo.scrollIntoViewIfNeeded();
  await expect(page.getByText('Typing', { exact: true })).toBeVisible();
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 30_000 });
  for (const line of script) await expect(demo).toContainText(line);
  await expect(page.locator('[data-renders]')).toHaveText('0');
  // Your turn: typing into the demo still costs nothing.
  await page.keyboard.type(' and yours');
  await expect(demo).toContainText('and yours');
  await expect(page.locator('[data-renders]')).toHaveText('0');
});

test('landing: scrolling on while the caret types never pulls the page back to the editor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'the scripted caret needs a fine pointer');
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.mouse.move(700, 450);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 120);
  await expect(page.getByText('Typing', { exact: true })).toBeVisible();
  // Mid-script, around the / menu: the reader keeps reading.
  await page.waitForTimeout(2200);
  let last = await page.evaluate(() => scrollY);
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(80);
    const y = await page.evaluate(() => scrollY);
    expect(y, `wheel ${i + 1}`).toBeGreaterThanOrEqual(last);
    last = y;
  }
  // The demo finished itself, exactly, without the caret or the menu.
  await expect(page.getByText('Your turn', { exact: true })).toBeAttached();
  expect(await page.evaluate(() => ['title', 'line', 'task', 'snippet'].map((id) => editor.get(id).content.map((r) => r.text).join('')))).toEqual(script);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => scrollY)).toBe(last);
});

test('landing: on a touch phone the demo is already written and the keyboard stays shut', async ({ page }, testInfo) => {
  test.skip(!/^mobile/.test(testInfo.project.name), 'touch phones');
  await open(page);
  await page.locator('[data-verbal]').scrollIntoViewIfNeeded();
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible();
  for (const line of script) await expect(page.locator('[data-verbal]')).toContainText(line);
  // Focusing an editable would open the on-screen keyboard and scroll the page: the demo never does.
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-verbal]'))).toBe(false);
  // Tapping in is how the reader starts typing.
  await page.locator('[data-verbal] [data-block]').last().locator('[data-content]').tap();
  await page.keyboard.type('from my phone');
  await expect(page.locator('[data-verbal]')).toContainText('from my phone');
  await expect(page.locator('[data-renders]')).toHaveText('0');
});

test('landing: checking and unchecking the demo to-do costs no React renders', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator('[data-verbal]').scrollIntoViewIfNeeded();
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible();
  const box = page.locator('[data-verbal] [role=checkbox]');
  for (const checked of [true, false, true]) {
    await box.click();
    await expect(box).toHaveAttribute('aria-checked', String(checked));
    expect(await page.evaluate(() => editor.get('task').props.checked)).toBe(checked);
  }
  expect(await page.evaluate(() => window.__renders)).toBe(0);
  await expect(page.locator('[data-renders]')).toHaveText('0');
});

test('landing: reduced motion turns off the typing, the reveals and the nav transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator('[data-verbal]').scrollIntoViewIfNeeded();
  // The finished text appears at once, with no caret at work.
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 2000 });
  for (const line of script) await expect(page.locator('[data-verbal]')).toContainText(line);
  await scrollThrough(page);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.locator('[data-shown]').evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
});

test('landing: with motion allowed, sections rise in on scroll and the nav condenses', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'scroll-driven animations are checked where they are supported');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await expect(page.locator('[data-shown]')).toHaveCount(0);
  // Hidden, the compact bar is inert, so Tab never lands on links that are off screen.
  await expect(page.locator('[inert]')).toHaveCount(1);
  await page.locator('#numbers-title').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-shown]')).toHaveCount(1);
  await expect(page.locator('[inert]')).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.timeline && !(a.timeline instanceof DocumentTimeline)).length)).toBeGreaterThan(5);
});

test('landing: on a phone the menu is a full-screen dialog that Escape closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole('button', { name: 'Menu' }).first().click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((d) => [d.offsetWidth, d.offsetHeight])).toEqual([390, 844]);
  await expect(menu.getByRole('link')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('landing: nothing shifts while the page loads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'layout-shift entries are a Chromium API');
  await page.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => (window.__shift += e.hadRecentInput ? 0 : e.value))).observe({ type: 'layout-shift', buffered: true });
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__shift), `${width}px`).toBeLessThan(0.01);
  }
});
