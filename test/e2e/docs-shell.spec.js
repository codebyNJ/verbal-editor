import { test, expect } from '../../playwright.config.js';

const nav = (page) => page.getByRole('complementary', { name: 'Docs' });
/** Every docs page, from the navigation of each tab. */
async function allPages(page) {
  await page.goto('/#/docs/introduction');
  // The docs are their own chunk: wait for the navigation before reading it.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link').first().waitFor();
  const hrefs = [];
  for (const tab of await page.getByRole('navigation', { name: 'Sections' }).getByRole('link').allTextContents()) {
    const link = page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: tab, exact: true });
    await link.click();
    // The sidebar follows the route: read it once the tab is current, not while the old section still shows.
    await expect(link).toHaveAttribute('aria-current', 'page');
    hrefs.push(...(await nav(page).locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))));
  }
  return hrefs.map((h) => h.slice('#/docs/'.length));
}
/** Records what the page copies, in every engine. */
const recordCopies = (page) => page.evaluate(() => {
  window.__copied = [];
  navigator.clipboard.writeText = async (t) => void window.__copied.push(t);
});

test('docs pages render read-only; landing pages stay editable', async ({ page }) => {
  await page.goto('/#/docs/transactions');
  const doc = page.locator('[data-verbal]');
  await expect(doc).toHaveAttribute('data-readonly', '');
  await expect(doc.locator('[contenteditable="true"]')).toHaveCount(0);
  const before = await page.evaluate(() => JSON.stringify(editor.getDoc()));
  await doc.locator('[data-type=paragraph] [data-content]').first().click();
  await page.keyboard.type('typed');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => JSON.stringify(editor.getDoc()))).toBe(before);
  await page.goto('/#/examples/welcome');
  await expect(page.locator('[data-verbal]')).not.toHaveAttribute('data-readonly');
  await expect(page.locator('[data-verbal] [contenteditable="true"]').first()).toBeVisible();
});

test('Copy page copies the page source, the same Markdown its .md file serves', async ({ page, request }) => {
  for (const slug of ['quickstart', 'shortcuts', 'modules/blocks/table']) {
    await page.goto(`/#/docs/${slug}`);
    await recordCopies(page);
    await page.getByRole('button', { name: 'Copy page' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const served = await (await request.get(`/docs/${slug}.md`)).text();
    expect(await page.evaluate(() => window.__copied[0])).toBe(served);
    expect(served).toMatch(/^# .+\n\n> .+\n\n/);
    expect(served).not.toContain('{{');
  }
});

test('the page actions copy a prompt and point at the Markdown, Claude and ChatGPT', async ({ page, request }) => {
  await page.goto('/#/docs/installation');
  await recordCopies(page);
  await page.getByRole('button', { name: 'More page actions' }).click();
  const menu = page.getByRole('menu');
  await menu.getByRole('menuitem', { name: /Copy as prompt/ }).click();
  expect(await page.evaluate(() => window.__copied[0])).toContain((await (await request.get('/docs/installation.md')).text()).trim());
  await page.getByRole('button', { name: 'More page actions' }).click();
  const md = new URL('docs/installation.md', page.url()).href;
  await expect(menu.getByRole('menuitem', { name: /View as Markdown/ })).toHaveAttribute('href', 'docs/installation.md');
  for (const [name, host] of [['Open in Claude', 'https://claude.ai/new?q='], ['Open in ChatGPT', 'https://chatgpt.com/?']]) {
    const href = await menu.getByRole('menuitem', { name: new RegExp(name) }).getAttribute('href');
    expect(href.startsWith(host), name).toBe(true);
    expect(decodeURIComponent(href), name).toContain(md);
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('llms.txt lists every docs page, llms-full.txt carries each one, and AGENTS.md is served', async ({ page, request }) => {
  const slugs = await allPages(page);
  expect(slugs.length).toBeGreaterThan(40);
  const index = await (await request.get('/llms.txt')).text();
  const full = await (await request.get('/llms-full.txt')).text();
  for (const slug of slugs) {
    expect(index, slug).toContain(`(docs/${slug}.md)`);
    const md = await (await request.get(`/docs/${slug}.md`)).text();
    expect(full, slug).toContain(md.split('\n')[0]);
  }
  expect((await request.get('/AGENTS.md')).ok()).toBe(true);
});

test('⌘K finds a heading on any page and goes straight to it', async ({ page }) => {
  await page.goto('/#/docs/introduction');
  await expect(page.locator('h1')).toHaveText('Introduction');
  const dialog = page.getByRole('dialog', { name: 'Search the docs' });
  // The shortcut is heard once the page's listener attaches, just after first paint; a key sent in that instant is lost.
  await expect(async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.keyboard.type('history undo');
  await expect(dialog.getByRole('option').first()).toContainText('History');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#\/docs\/transactions#history$/);
  await expect(page.locator('#history')).toBeInViewport();
});

test('a deep link to a heading loads directly, and the outline follows the reading position', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, 'the outline sits beside the page from 1280px');
  await page.goto('/#/docs/transactions#events');
  await expect(page.locator('h1')).toHaveText('Transactions & undo');
  await expect(page).toHaveTitle('Transactions & undo · Verbal docs');
  await expect(page.locator('#events')).toBeInViewport();
  const outline = page.getByRole('complementary', { name: 'On this page' });
  await expect(outline.locator('a[aria-current]')).toHaveText('Events');
  await outline.getByRole('link', { name: 'Selection' }).click();
  await expect(outline.locator('a[aria-current]')).toHaveText('Selection');
  await expect(page).toHaveURL(/#\/docs\/transactions#selection$/);
});

test('tabs, groups and previous / next walk the docs in order', async ({ page }) => {
  await page.goto('/#/docs/introduction');
  await expect(page.locator('p', { hasText: /^Get started$/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Previous and next' }).getByRole('link', { name: /Installation/ }).click();
  await expect(page.locator('h1')).toHaveText('Installation');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'API Reference' }).click();
  await expect(page.locator('h1')).toHaveText('Imports');
  await expect(nav(page).getByRole('heading')).toHaveText(['Package', 'Modules', 'Theming', 'Platform']);
});

test('choosing a tab switches every code group that has it, and the choice is kept', async ({ page }) => {
  await page.goto('/#/docs/cli');
  const groups = page.locator('[data-type=codegroup]');
  await groups.first().getByRole('tab', { name: 'pnpm' }).click();
  await expect(groups.first().locator('[data-type=code]:visible')).toContainText('pnpm add -D joi');
  await page.goto('/#/docs/installation');
  await expect(page.locator('[data-type=codegroup]').first().getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  await recordCopies(page);
  await page.locator('[data-type=codegroup]').first().getByRole('button', { name: 'Copy code' }).click();
  expect(await page.evaluate(() => window.__copied[0])).toBe('pnpm add verbal-editor');
});

test('old addresses land on their new pages', async ({ page }) => {
  for (const [from, to] of [['modules/blocks/table', 'docs/modules/blocks/table'], ['docs/getting-started', 'docs/introduction'], ['docs/react', 'docs/rendering'], ['play/lists', 'examples/lists']]) {
    await page.goto(`/#/${from}`);
    await expect(page).toHaveURL(new RegExp(`#/${to}$`));
  }
});

test('on a phone the navigation is a drawer and the outline a dropdown, and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/docs/quickstart');
  await expect(nav(page)).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(nav(page)).toBeVisible();
  await nav(page).getByRole('link', { name: 'Document model' }).click();
  await expect(page.locator('h1')).toHaveText('Document model');
  await expect(nav(page)).toBeHidden();
  await page.locator('summary', { hasText: 'On this page' }).click();
  await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Runs and marks' })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const slug of ['quickstart', 'editor-api', 'modules/blocks/table', 'shortcuts']) {
      await page.goto(`/#/docs/${slug}`);
      await page.locator('[data-verbal] [data-block]').first().waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${slug} at ${width}`).toBe(0);
    }
  }
});
