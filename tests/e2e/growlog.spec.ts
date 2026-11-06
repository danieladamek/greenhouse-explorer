import { test, expect } from '@playwright/test';

// Data-agnostic on purpose: greenhouse staff upload new versions of growlog/grow-log.xlsx, and these tests must keep
// passing whatever the rows say.
test('grow log renders from the workbook, with reports and checks', async ({ page }) => {
  await page.goto('/grow-log');
  await expect(page.getByRole('heading', { level: 1, name: /grow log/i })).toBeVisible();
  await expect(page.getByTestId('prototype-banner')).toBeVisible();
  await expect(page.getByTestId('growlog-how')).toBeVisible();
  await expect(page.getByTestId('growlog-plantings').locator('tbody tr').first()).toBeVisible();
  await expect(page.getByTestId('growlog-checks')).toBeVisible();
  const report = page.getByTestId('growlog-downloads').getByRole('link', { name: /spreadsheet report/i });
  const href = await report.getAttribute('href');
  expect(href).toMatch(/growlog\/grow-log-report\.xlsx$/);
  const res = await page.request.get(href!);
  expect(res.ok()).toBeTruthy();
});

test('grow log is reachable from the greenhouse page and links back to plant pages', async ({ page }) => {
  await page.goto('/greenhouse');
  await page.getByTestId('growlog-link').click();
  await expect(page).toHaveURL(/\/grow-log$/);
  const plantLink = page.getByTestId('growlog-plantings').locator('a[href*="/plants/"]').first();
  if (await plantLink.count()) {
    await plantLink.click();
    await expect(page).toHaveURL(/\/plants\//);
    await expect(page.getByTestId('in-grow-log')).toBeVisible();
  }
});

test('an entry saved in the browser shows on the page and survives a reload', async ({ page }) => {
  await page.goto('/grow-log');
  const form = page.getByTestId('growlog-entry');
  await form.getByRole('tab', { name: 'Observation' }).click();
  const planting = form.getByLabel(/^Planting/);
  const first = await planting.locator('option').nth(1).getAttribute('value');
  await planting.selectOption(first!);
  await form.getByLabel(/^Condition/).fill('E2E test entry');
  await form.getByTestId('growlog-save').click();
  await expect(page.getByTestId('growlog-msg')).toContainText('saved in this browser');
  await expect(page.getByTestId('growlog-drafts')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('growlog-observation').filter({ hasText: 'E2E test entry' })).toBeVisible();
  await expect(page.getByText('saved in this browser').first()).toBeVisible();
});
