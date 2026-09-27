// The share image (og:image): the landing's first screen at 1200 × 630, from the built site. Rerun after the landing
// changes: npm run site && node scripts/og.js
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { preview } from 'vite';

const at = (...p) => resolve(import.meta.dirname, '..', ...p);
const server = await preview({ configFile: at('vite.config.js'), mode: 'site', preview: { port: 5197, strictPort: false } });
const browser = await chromium.launch();
try {
  // 1920 × 1008 drawn at 0.625: exactly 1200 × 630, and wide enough that the headline has stopped growing, so the
  // whole first screen (mark, headline, pitch, buttons) fits the frame.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1008 }, deviceScaleFactor: 0.625, reducedMotion: 'reduce' });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('h1').waitFor();
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].filter((i) => !i.loading || i.loading === 'eager').map((i) => i.decode())]));
  const bottom = await page.evaluate(() => document.querySelector('h1 ~ div a').getBoundingClientRect().bottom);
  if (bottom > 1008) throw new Error(`the buttons end at ${bottom}px, below the frame`);
  await page.screenshot({ path: at('demo/public/og.png'), scale: 'device' });
} finally {
  await browser.close();
  await server.close();
}
