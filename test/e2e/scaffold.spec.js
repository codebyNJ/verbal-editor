import { test, expect } from '../../playwright.config.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('shell renders sidebar, top bar and page chrome', async ({ page }) => {
  await page.goto('/#/play/theming');
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Theming');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Theming');
  await expect(page.getByRole('button', { name: /render/ })).toContainText('0 renders');
});

test('F-63: the package theme is custom properties alone, and dark follows the system by itself', async ({ page }) => {
  const css = readFileSync(join(import.meta.dirname, '../../dist/tokens.css'), 'utf8');
  await page.setContent(`<style>${css} body { background: var(--v-bg); }</style><p>tokens.css alone</p>`);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await bg(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await bg(page)).not.toBe(light);
});

test('the site starts dark, light is one click away, and the choice is kept', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/play/theming');
  const toggle = page.getByRole('button', { name: /Theme:/ });
  await expect(toggle).toHaveAttribute('aria-label', 'Theme: dark');
  const dark = await bg(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Theme: light');
  expect(await bg(page)).not.toBe(dark);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-label', 'Theme: light');
});

test('⌘K palette filters, runs a command and closes', async ({ page }) => {
  await page.goto('/#/play/theming');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('sidebar');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('390px: sidebar starts closed and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/#/play/theming');
  await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
