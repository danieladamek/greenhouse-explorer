import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const tours = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/tours.json'), 'utf8')) as { id: string; title: string; steps: unknown[] }[];

for (const t of tours) {
  test(`tour "${t.title}" runs from its first step to the quiz`, async ({ page }) => {
    await page.goto(`/tours/${t.id}`);
    await page.getByTestId('tour-begin').click();
    for (let i = 0; i < t.steps.length; i++) {
      const card = page.getByTestId('tour-card');
      await expect(card).toContainText(`STEP ${i + 1} OF ${t.steps.length}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await card.getByTestId('tour-next').click();
    }
    await expect(page.getByTestId('tour-quiz')).toBeVisible();
    await expect(page.getByRole('heading', { name: /question/i })).toBeVisible();
  });
}
