import { test, expect } from '../../playwright.config.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const bench = resolve(import.meta.dirname, '../../bench');
const results = JSON.parse(readFileSync(join(bench, 'results.json'), 'utf8'));
const pins = JSON.parse(readFileSync(join(bench, 'package.json'), 'utf8')).dependencies;
const setups = readdirSync(join(bench, 'setups')).filter((f) => !f.startsWith('_')).map((f) => f.replace('.js', ''));

test.describe('bench/results.json', () => {
  test('has one measured row per setup in bench/setups, each with its pinned versions', () => {
    expect(results.editors.map((e) => `${e.editor}-${e.setup}`).sort()).toEqual(setups.sort());
    for (const e of results.editors) {
      for (const k of ['js', 'total', 'mountMs', 'keyP95Ms', 'inputP95Ms']) expect(e[k], `${e.editor}-${e.setup} ${k}`).toBeGreaterThan(0);
      expect(e.total).toBe(e.js + e.css);
      for (const p of e.packages) if (e.editor !== 'verbal') expect(p.version, p.name).toBe(pins[p.name.split(' ')[0]]);
    }
  });

  test('says when, where and how it was measured', () => {
    expect(results.date).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(Object.keys(results.environment)).toEqual(['chromium', 'node', 'os', 'cpu']);
    expect(results.command).toContain('npm run bench');
    expect(results.method.blocks).toBe(1000);
  });

  test('Verbal types without a single React render', () => {
    for (const e of results.editors.filter((x) => x.editor === 'verbal')) expect(e.rendersPerKey, e.setup).toBe(0);
  });

  test('the Notion row is a download size or an honest "not measured" — never a timing', () => {
    const n = results.notion;
    expect(n.url).toMatch(/^https:\/\//);
    if (n.measured) expect(n.jsBytes).toBeGreaterThan(0);
    else expect(n.reason).toBeTruthy();
    expect(Object.keys(n).some((k) => /ms|time/i.test(k))).toBe(false);
  });
});
