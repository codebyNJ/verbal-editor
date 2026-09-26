import { defineConfig, devices, test as base, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// E2E_PORT tests the built site while `npm run dev` holds 5173.
const port = process.env.E2E_PORT ?? 5173;
const baseURL = `http://localhost:${port}`;
const engines = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: join(tmpdir(), 'verbal-e2e'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL },
  projects: [
    ...Object.entries(engines).map(([name, device]) => ({ name, use: devices[device], testIgnore: /mobile\.spec/ })),
    // Touch phones: the mobile specs, the landing and the layout audit.
    { name: 'mobile-chrome', use: devices['Pixel 7'], testMatch: /(mobile|landing|audit)\.spec\.js/ },
    { name: 'mobile-safari', use: devices['iPhone 13'], testMatch: /(mobile|landing|audit)\.spec\.js/ },
  ],
  // Tests run against the built site (npm run build && npm run site), which uses the built package.
  webServer: {
    command: `npx vite preview --mode site --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});

/** Every spec fails on a console error or a request that leaves the origin. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    const foreign = [];
    // Linux WebKit reports the viewport's interactive-widget key (for Android keyboards) as an error; Safari ignores it quietly.
    page.on('console', (m) => m.type() === 'error' && !/^Viewport argument key "interactive-widget"/.test(m.text()) && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => /^https?:/.test(r.url()) && !r.url().startsWith(baseURL) && foreign.push(r.url()));
    await use(page);
    expect(errors, 'console errors').toEqual([]);
    expect(foreign, 'off-origin requests').toEqual([]);
  },
});
export { expect };
