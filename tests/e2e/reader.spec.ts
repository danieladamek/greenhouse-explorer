import { expect, test } from '@playwright/test';

test('the reader carries the commissioned-review banner and the as_of date', async ({ page }) => {
  await page.goto('/read');
  await expect(page.getByTestId('review-banner')).toContainText(/not peer reviewed/i);
  await expect(page.getByText('Current as of 2026-09-23').first()).toBeVisible();
});

test('synthesis passages are visibly marked and linked from /methods', async ({ page }) => {
  await page.goto('/read');
  await expect(page.getByTestId('synthesis-block')).toHaveCount(4);
  await page.goto('/methods');
  await expect(page.getByTestId('synthesis-link')).toHaveCount(4);
});

test('a term popover opens by keyboard and closes with Esc, returning focus', async ({ page }) => {
  await page.goto('/read');
  const term = page.locator('[data-testid^="term-"]').first();
  const id = await term.getAttribute('data-testid');
  await term.focus();
  await page.keyboard.press('Enter');
  const pop = page.getByTestId(`${id}-popover`);
  await expect(pop).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(term).toBeFocused();
});

test('a citation opens a fold-out with the reference', async ({ page }) => {
  await page.goto('/read');
  await page.getByTestId('cite-102').first().click();
  const fold = page.getByTestId('citation-foldout').first();
  await expect(fold).toBeVisible();
  await expect(fold).toContainText(/REFERENCE 102/i);
  await fold.getByRole('button', { name: /close reference 102/i }).click();
  await expect(fold).toBeHidden();
});

test('notepad: write → reload → persists → export is section-ordered Markdown', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/read');
  await page.getByTestId('open-notepad').click();
  const panel = page.getByTestId('notepad').first();
  await panel.getByTestId('new-note').click();
  const ta = panel.getByTestId('note-body').first();
  await ta.pressSequentially('Cellulose first, then the pathways.');
  await expect(ta).toBeFocused();
  await expect(ta).toHaveValue('Cellulose first, then the pathways.');
  await page.reload();
  await page.getByTestId('open-notepad').click();
  await expect(page.getByTestId('note-body').first()).toHaveValue('Cellulose first, then the pathways.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-notes').first().click()]);
  expect(dl.suggestedFilename()).toMatch(/^greenhouse-explorer-notes-\d{4}-\d{2}-\d{2}\.md$/);
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c as Buffer[]).toString('utf8'));
  expect(text).toContain('Cellulose first, then the pathways.');
});

test('a note typed in the drawer arrives whole and keeps focus; online, the panel says browser only', async ({ page }) => {
  // served anywhere but local preview there is no file endpoint: simulate that and expect the plain warning
  await page.route('**/__local/notes', (r) => r.abort());
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/plants/salvia-officinalis');
  await page.getByTestId('add-note-here').click();
  const drawer = page.getByTestId('notepad-drawer');
  await expect(drawer).toBeVisible();
  const ta = drawer.getByTestId('note-body').first();
  await ta.pressSequentially('Thujone limit per EMA, check the tea value.');
  await expect(ta).toHaveValue('Thujone limit per EMA, check the tea value.');
  await expect(ta).toBeFocused();
  await expect(drawer.getByTestId('notepad-storage')).toContainText('Saved in this browser only — export to keep a copy.');
});
