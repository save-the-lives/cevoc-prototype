import { expect, test } from '@playwright/test';

// UI-03: when the photo links have timed out the page says so once, with one action, and never shows a black box.
test('timed-out photos: one message, one reload action, readable placeholders, reload keeps notice details but not the plate', async ({ page }) => {
  await page.route('**/samples/image-*', (route) => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.fill('#rego', 'ZZZ999');
  await page.tap('button[type=submit]');
  const msg = page.getByTestId('photos-timed-out');
  await expect(msg.getByRole('heading', { name: 'Your photos have timed out' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Reload the photos' })).toHaveCount(1);
  await expect(page.getByText('These photos expired')).toHaveCount(0);
  await expect(page.locator('.media-expired').first()).toContainText(/^Photo 1 of \d+, timed out$/);
  await expect(page.locator('img.media-img')).toHaveCount(0); // no broken-image boxes
  await expect(page.locator('button.zoom-open')).toHaveCount(0);
  await expect(page.locator('#step-evidence .q-answer')).not.toContainText('Check the number plate');
  await expect(page.locator('#step-evidence .q-answer')).toContainText('timed out');
  // The placeholder text is dark on light: at least 4.5:1.
  const ratio = await page.locator('.media-expired').first().evaluate((el) => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const s = getComputedStyle(el); const a = lum(s.color); const b = lum(s.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);

  await page.getByRole('button', { name: 'Reload the photos' }).tap();
  await expect(page.locator('#pn')).toHaveValue('9000000001');
  await expect(page.locator('#od-d')).toHaveValue('14');
  await expect(page.locator('#od-y')).toHaveValue('2026');
  await expect(page.locator('#rego')).toHaveValue('');
  await expect(page.locator('#rego')).toBeFocused();
  await expect(page.getByText('We don’t keep your number plate, so type it again')).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, document.cookie, location.href]));
  expect(stored).not.toMatch(/ZZZ999/);
});

// The thumbnails still load but the full-size links have timed out: the full-screen viewer shows the one message and one reload action.
test('full-screen viewer: timed-out photo uses the single message', async ({ page }) => {
  await page.route(/\/samples\/image-\d+\.jpg$/, (route) => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.tap('button[type=submit]');
  await page.locator('button.zoom-open').first().waitFor({ timeout: 15_000 });
  await page.locator('button.zoom-open').first().tap();
  await page.locator('.media-card .zp-viewport').first().waitFor({ timeout: 10_000 });
  await page.evaluate(() => { Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true }); });
  await page.locator('.media-card').first().getByRole('button', { name: 'Full screen' }).tap();
  const viewer = page.locator('.gp .media-expired');
  await expect(viewer).toContainText(/Photo 1 of \d+, timed out/, { timeout: 15_000 });
  await expect(viewer).toContainText('Your photos have timed out');
  await expect(viewer.getByRole('button', { name: 'Reload the photos' })).toHaveCount(1);
  await expect(page.getByText('This photo could not be shown')).toHaveCount(0);
});
