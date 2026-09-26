import { test, expect } from '../../playwright.config.js';

const ORIGINAL = 'Our editor is really quite small and it is very fast, and it doesnt need any dependencies at all to work properly.';
const PROPOSAL = 'Our editor is small and fast, and it needs no dependencies at all.';

/** Elements inside every editable region (a page's links are marks, so there can be some to start with). */
const elementsInText = () => [...document.querySelectorAll('[data-content]')].reduce((n, c) => n + c.querySelectorAll('*').length, 0);
async function open(page) {
  await page.goto('/#/play/ai');
  await page.locator('[data-content]').first().waitFor();
  const snapshot = await page.evaluate(() => JSON.stringify(editor.getDoc()));
  const id = await page.evaluate(() => editor.getDoc().blocks.doc.children[1]);
  const nodes = await page.evaluate(elementsInText);
  await page.getByRole('button', { name: /Suggest edits/ }).click();
  await expect(page.getByText('Suggested edit').first()).toBeVisible();
  await page.evaluate(() => window.__renderIds.splice(0));
  return { snapshot, id, nodes };
}
const text = (page, id) => page.evaluate((id) => editor.get(id).content.map((r) => r.text).join(''), id);
const doc = (page) => page.evaluate(() => JSON.stringify(editor.getDoc()));
const panel = (page) => page.locator('.v-pending-panel').first();
const sizes = (page) => page.evaluate(() => [CSS.highlights.get('verbal-del')?.size ?? 0, CSS.highlights.get('verbal-ins')?.size ?? 0]);

test('F-50/F-51: the proposal is uncommitted — deletions are painted over the real text, nothing is added to editable regions', async ({ page }) => {
  const { snapshot, id, nodes } = await open(page);
  expect(await doc(page)).toBe(snapshot);
  const words = await page.evaluate((id) => {
    const content = editor.view.content(id);
    return [...CSS.highlights.get('verbal-del')].filter((r) => content.contains(r.startContainer)).map((r) => r.toString());
  }, id);
  expect(words).toContain('really quite ');
  expect(words).toContain(' to work properly');
  expect(await page.evaluate(elementsInText)).toBe(nodes);
  await expect(panel(page)).toContainText('needs no');
  const [, ins] = await sizes(page);
  expect(ins).toBeGreaterThan(0);
  await page.evaluate((id) => editor.select({ anchor: { block: id, offset: 14 }, focus: { block: id, offset: 26 } }), id);
  expect(await page.evaluate(() => getSelection().toString())).toBe('really quite');
});

test('F-50: reject — button or Esc — leaves the document byte-identical and clears every highlight', async ({ page }) => {
  const { snapshot } = await open(page);
  await panel(page).getByRole('button', { name: /Reject/ }).first().click();
  expect(await doc(page)).toBe(snapshot);
  await expect(page.getByText('Suggested edit')).toHaveCount(0);
  expect(await sizes(page)).toEqual([0, 0]);
  await page.getByRole('button', { name: /Suggest edits/ }).click();
  await page.locator('[data-content]').first().click();
  await page.keyboard.press('Escape');
  expect(await doc(page)).toBe(snapshot);
  await expect(page.getByText('Suggested edit')).toHaveCount(0);
});

test('F-52: accept applies through the normal path — one undo step, 0 renders, redo re-applies', async ({ page }) => {
  const { snapshot, id } = await open(page);
  await panel(page).getByRole('button', { name: /Accept/ }).last().click();
  await page.locator('[data-content]').first().click();
  await page.keyboard.press('Escape');
  expect(await text(page, id)).toBe(PROPOSAL);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
  await page.locator('[data-content]').first().click();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await doc(page)).toBe(snapshot);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect(await text(page, id)).toBe(PROPOSAL);
});

test('F-52: ⌘⏎ and Esc work straight after asking, without clicking into the document, but never while typing elsewhere', async ({ page }) => {
  const { snapshot, id } = await open(page);
  expect(await page.evaluate(() => document.querySelector('[data-verbal]').contains(document.activeElement))).toBe(false);
  await page.getByPlaceholder('Search', { exact: true }).fill('x');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Suggested edit').first()).toBeVisible();
  await page.getByPlaceholder('Search', { exact: true }).fill('');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Escape');
  await expect(page.getByText('Suggested edit')).toHaveCount(0);
  expect(await doc(page)).toBe(snapshot);
  await page.getByRole('button', { name: /Suggest edits/ }).click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('Suggested edit')).toHaveCount(0);
  expect(await text(page, id)).toBe(PROPOSAL);
  expect(await page.evaluate(() => window.__renderIds.splice(0))).toEqual([]);
});

test('F-53: hunks can be accepted or rejected one by one and the document stays valid', async ({ page }) => {
  const { id } = await open(page);
  const hunks = panel(page).locator('[data-hunk]');
  const count = await hunks.count();
  expect(count).toBeGreaterThan(2);
  await hunks.first().getByTitle('Accept this change').click();
  expect(await text(page, id)).toBe(ORIGINAL.replace('really quite ', ''));
  await expect(hunks).toHaveCount(count - 1);
  await hunks.last().getByTitle('Reject this change').click();
  await expect(hunks).toHaveCount(count - 2);
  while ((await hunks.count()) > 0) await hunks.first().getByTitle('Accept this change').click();
  expect(await text(page, id)).toBe('Our editor is small and fast, and it needs no dependencies at all to work properly.');
  const valid = await page.evaluate(() => {
    const d = editor.getDoc();
    editor.setDoc(d);
    return JSON.stringify(editor.getDoc()) === JSON.stringify(d);
  });
  expect(valid).toBe(true);
});

test('editing a block during review re-diffs it against the proposal', async ({ page }) => {
  const { id } = await open(page);
  await page.evaluate((id) => editor.select({ anchor: { block: id, offset: 14 }, focus: { block: id, offset: 27 } }), id);
  await page.keyboard.press('Backspace');
  const words = await page.evaluate((id) => [...CSS.highlights.get('verbal-del')].filter((r) => editor.view.content(id).contains(r.startContainer)).map((r) => r.toString()), id);
  expect(words).not.toContain('really quite ');
  await expect(panel(page)).toContainText('small');
});
