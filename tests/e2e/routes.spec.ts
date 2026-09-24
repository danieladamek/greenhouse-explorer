import { expect, test } from '@playwright/test';

/** Every route answers 200 with its h1 and the prototype banner (KICKOFF §5, §4e). */
const ROUTES: [string, RegExp][] = [
  ['/', /plants of the UAH Greenhouse/i],
  ['/read', /the primer: what every plant shares/i],
  ['/glossary', /^glossary$/i],
  ['/concepts', /concepts/i],
  ['/concepts/chemotypes', /^chemotypes$/i],
  ['/plants', /^plants$/i],
  ['/plants/salvia-officinalis', /salvia officinalis/i],
  ['/plants/scutellaria-sp', /scutellaria sp\./i],
  ['/plants/lactuca-sativa', /lactuca sativa/i],
  ['/greenhouse', /what's growing/i],
  ['/compounds', /^compounds$/i],
  ['/compounds/baicalin', /^baicalin$/i],
  ['/compounds/cis-spiroether', /cis-spiroether/i],
  ['/compare', /^compare$/i],
  ['/compare?ids=thymol,carvacrol,linalool', /^compare$/i],
  ['/compare?plants=scutellaria-lateriflora,scutellaria-baicalensis', /^compare$/i],
  ['/families', /^families$/i],
  ['/families/lamiaceae', /lamiaceae/i],
  ['/heatmap', /^heatmap$/i],
  ['/tea', /^tea time$/i],
  ['/tours', /guided tours/i],
  ['/tours/two-skullcaps', /two skullcaps/i],
  ['/figures', /^figures$/i],
  ['/figures/fig-pathways', /three routes from fixed carbon/i],
  ['/figures/fig-extraction', /hot-water infusion/i],
  ['/references', /^references$/i],
  ['/methods', /methods & provenance/i],
  ['/notes', /^notes$/i],
  ['/about', /about this site/i],
  ['/nope', /page not found/i],
];

for (const [route, h1] of ROUTES) {
  test(`route ${route} renders its h1 and the banner, without page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    const banner = page.getByTestId('prototype-banner');
    await expect(banner).toContainText(/Prototype for critique · not peer reviewed · not an official UAH resource · content current as of 2026-09-23/);
    const href = await page.getByTestId('critique-link').getAttribute('href');
    expect(href).toContain('https://github.com/danieladamek/greenhouse-explorer/issues/new?title=');
    expect(decodeURIComponent(href!.split('title=')[1].split('&')[0])).toContain(route === '/nope' ? '/nope' : route.split('#')[0]);
    expect(errors).toEqual([]);
  });
}

test('the banner compacts on scroll but never disappears and cannot be dismissed', async ({ page }) => {
  await page.goto('/methods');
  await page.mouse.wheel(0, 3000);
  const banner = page.getByTestId('prototype-banner');
  await expect(banner).toBeInViewport();
  await expect(banner.getByRole('button', { name: /dismiss/i })).toHaveCount(0);
});

test('every route is linked from the header nav', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('button', { name: /more/i }).click();
  for (const to of ['/read', '/plants', '/greenhouse', '/compounds', '/compare', '/tea', '/tours', '/families', '/heatmap', '/glossary', '/concepts', '/figures', '/references', '/notes', '/methods', '/about']) {
    await expect(page.locator(`header a[href="${to}"]`).first()).toBeAttached();
  }
});

test('dark mode toggles, persists, and restyles the page', async ({ page }) => {
  await page.goto('/plants/salvia-officinalis');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(26, 23, 18)'); // K5.1 warm night #1a1712
});

for (const route of ['/read', '/plants/salvia-officinalis', '/compounds/baicalin', '/tea', '/greenhouse']) {
  test(`375 px: ${route} has no horizontal page scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
}

// K5.1 §2: the bundled faces are used — on a first visit from the first in-app navigation, on a return visit from
// the first frame — and are never fetched from anywhere but this site
test('the bundled fonts apply on first navigation, and before first render on a return visit', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (/\.woff2?$/.test(r.url()) && !r.url().startsWith('http://localhost:4173/')) external.push(r.url()); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Start with the primer →' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/primer/i);
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Source Sans 3"') && [...document.fonts].some((f) => f.family.includes('Fraunces') && f.status === 'loaded')), { timeout: 15_000 }).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('gx-fonts-cached'))).toBe('1');
  await page.reload({ waitUntil: 'commit' });
  // on return the faces are added before React's first render: by the time the header exists, they are in use
  await page.getByTestId('prototype-banner').waitFor();
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Source Sans 3' && f.status === 'loaded').length)).toBeGreaterThanOrEqual(3);
  expect(external).toEqual([]);
});
