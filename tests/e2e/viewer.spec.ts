import { expect, test, type Page } from '@playwright/test';

async function waitForViewer(page: Page) {
  await expect(page.locator('.bx-viewer[data-ready="1"]').first()).toBeVisible({ timeout: 30_000 });
}
/** Screen position of atom `serial` inside the viewer canvas (3Dmol projects model → screen). Ported from Bioactive Explorer. */
async function atomScreenPos(page: Page, serial: number) {
  return page.evaluate((s) => {
    const v = (window as unknown as { __bxViewers: Record<string, { getModel: () => { selectedAtoms: (q: object) => { x: number; y: number; z: number }[] }; modelToScreen: (c: { x: number; y: number; z: number }) => { x: number; y: number } }> }).__bxViewers.detail;
    const a = v.getModel().selectedAtoms({ serial: s })[0];
    return v.modelToScreen({ x: a.x, y: a.y, z: a.z });
  }, serial);
}

test('baicalin: 3D model and 2D depiction; an atom click highlights both; a distance is measured and cleared', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/compounds/baicalin');
  await waitForViewer(page);
  await expect(page.locator('.bx-viewer canvas')).toHaveCount(1);
  await expect(page.getByTestId('structure-2d').locator('img[alt^="2D structure"]')).toBeVisible();
  await page.getByTestId('viewer-frame').scrollIntoViewIfNeeded();
  const p = await atomScreenPos(page, 0);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('atom-info')).toContainText(/Atom [A-Z][a-z]?\d+/);
  // the same atom is ringed in the 2D overlay
  await expect.poll(async () => page.getByTestId('structure-2d').locator('svg circle[stroke-width="2.5"]').count()).toBe(1);
  const q = await atomScreenPos(page, 1);
  await page.mouse.click(q.x, q.y);
  await expect(page.getByTestId('measurement')).toContainText(/Å/);
  await page.getByRole('button', { name: /clear measurements/i }).click();
  await expect(page.getByTestId('measurement')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('viewer state lives in the URL and the viewer is keyboard-rotatable', async ({ page }) => {
  await page.goto('/compounds/thymol?style=stick&groups=phenol');
  await waitForViewer(page);
  await expect(page.getByRole('radio', { name: 'Stick', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /Phenol OH/ })).toHaveAttribute('aria-pressed', 'true');
  const canvasHost = page.locator('.bx-viewer [role="img"]').first();
  await canvasHost.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('radio', { name: 'Space-filling' }).click();
  await expect(page).toHaveURL(/style=spacefill/);
});

test('a record with no SMILES takes the "No single structure" path', async ({ page }) => {
  await page.goto('/compounds/cis-spiroether');
  await expect(page.getByTestId('no-structure')).toContainText('No single structure');
});

test('compare view loads synchronised viewers', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/compare?ids=thymol,carvacrol,linalool');
  await expect(page.locator('.bx-viewer[data-ready="1"]')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /synchronise rotation/i })).toHaveAttribute('aria-pressed', 'true');
});
