import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { chartPlan } from '../../src/lib/basis';
import type { OccurrenceRow } from '../../src/types';

const occurrenceRows = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/occurrence-rows.json'), 'utf8')) as OccurrenceRow[];
const rows = occurrenceRows.map((r) => ({ ...r, id: r.row }));

test('a stub plant renders "Profile in progress", never a blank page', async ({ page }) => {
  await page.goto('/plants/lactuca-sativa');
  await expect(page.getByTestId('profile-in-progress')).toContainText('Profile in progress');
  await expect(page.getByTestId('cultivar').first()).toBeVisible();
});

test('the unresolved skullcap entry renders two candidate panels, the matrix, and how it resolves', async ({ page }) => {
  await page.goto('/plants/scutellaria-sp');
  await expect(page.getByTestId('candidate-panel')).toHaveCount(2);
  await expect(page.getByTestId('compound-matrix')).toContainText('baicalin');
  await expect(page.getByTestId('how-it-resolves')).toContainText('identity_status');
});

test('a profiled plant shows evidence rows with grade + test article, and an always-open safety block', async ({ page }) => {
  await page.goto('/plants/salvia-officinalis');
  const ev = page.getByTestId('evidence-row');
  await expect(ev.first()).toBeVisible();
  const n = await ev.count();
  for (let i = 0; i < n; i++) {
    await expect(ev.nth(i).locator('[data-testid^="grade-"]').first()).toBeVisible();
    await expect(ev.nth(i).getByTestId('test-article')).toBeVisible();
  }
  await expect(page.getByTestId('safety-block')).toContainText(/regulatory \/ toxicological limit/i);
  await expect(page.getByRole('heading', { name: /^Evidence$/ })).toBeVisible();
});

test('every occurrence amount on a compound page carries a basis', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/compounds/baicalin');
  const r = page.getByTestId('occurrence-row');
  await expect(r.first()).toBeVisible();
  for (let i = 0; i < await r.count(); i++) await expect(r.nth(i).locator('[data-basis]')).toHaveCount(1);
  await expect(page.getByText('basis not stated in source').first()).toBeVisible();
});

test('/compare?ids=thymol,menthol shows a chart or the refusal, as the pack data implies', async ({ page }) => {
  const plan = chartPlan(rows.filter((r) => ['thymol', 'menthol'].includes(r.compound_id)));
  await page.goto('/compare?ids=thymol,menthol');
  if (plan.ok) {
    await expect(page.getByTestId('chart-row').first()).toBeVisible();
    await expect(page.getByTestId('basis-refusal')).toHaveCount(0);
  } else {
    await expect(page.getByTestId('basis-refusal')).toBeVisible();
    await expect(page.getByTestId('chart-row')).toHaveCount(0);
  }
});

test('a mixed-basis selection is refused until one basis is chosen', async ({ page }) => {
  await page.goto('/compare?ids=rosmarinic-acid,citral');
  await expect(page.getByTestId('basis-refusal')).toBeVisible();
  await expect(page.getByTestId('chart-row')).toHaveCount(0);
  await page.getByTestId('basis-select').selectOption('dry_weight');
  await expect(page.getByTestId('chart-row').first()).toBeVisible();
  await expect(page).toHaveURL(/basis=dry_weight/);
});

test('/compare?plants= renders the skullcap matrix, shared and distinct compounds', async ({ page }) => {
  await page.goto('/compare?plants=scutellaria-lateriflora,scutellaria-baicalensis');
  await expect(page.getByTestId('compound-matrix')).toContainText('baicalin');
  await expect(page.getByTestId('shared-distinct')).toContainText(/Shared by all/);
});

test('/compounds keeps its filters in the URL', async ({ page }) => {
  await page.goto('/compounds');
  await page.getByTestId('compound-search').fill('thym');
  await expect(page).toHaveURL(/q=thym/);
  await page.reload();
  await expect(page.getByTestId('compound-search')).toHaveValue('thym');
  await expect(page.getByTestId('compound-count')).toContainText(/of 48/);
});

test('/tea shows every preparation with its safety block, and no dosing language', async ({ page }) => {
  await page.goto('/tea');
  await expect(page.getByTestId('tea-note')).toContainText('extraction chemistry');
  const preps = page.getByTestId('preparation');
  await expect(preps).toHaveCount(6);
  await expect(page.getByTestId('prep-safety')).toHaveCount(6);
  const text = (await page.locator('main').innerText()).toLowerCase();
  // word-bounded: "safe-intake statement" in a safety summary is not an instruction to take anything
  for (const bad of [/how much to use/, /\bserving\b/, /\btake\b/, /\bper day for\b/, /\btimes a day\b/, /\bdosage\b/]) expect(text).not.toMatch(bad);
});

test('/greenhouse lists every planting, the inventory date, and an empty past section', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/greenhouse');
  await expect(page.getByTestId('planting-row')).toHaveCount(91);
  await expect(page.locator('main')).toContainText('2025-10-25');
  await expect(page.getByTestId('past-empty')).toBeVisible();
});

for (const [route, file] of [['/heatmap', 'greenhouse-explorer-heatmap.svg'], ['/families', 'greenhouse-explorer-shared-compounds.svg']]) {
  test(`${route} downloads an SVG`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('figure svg').first()).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-svg').click()]);
    expect(dl.suggestedFilename()).toBe(file);
    const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c as Buffer[]).toString('utf8'));
    expect(text).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  });
}
