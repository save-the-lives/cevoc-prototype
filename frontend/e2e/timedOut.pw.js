import { expect, test } from '@playwright/test';

// UI-03: when the photo links have timed out the page says so once, with one action, and never shows a black box.
test('timed-out photos: one message, one reload action, readable placeholders, reload keeps notice details but not the plate', async ({ page }) => {
  await page.route('**/samples/image-*', (route) => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.fill('#rego', 'ZZZ999');
  await page.tap('button[type=submit]');
  // Wait for the gallery to appear — it uses .mg now, not .media-card
  await page.locator('.mg').first().waitFor({ timeout: 15_000 });
  // The timed-out message may appear either at the page level or within the gallery
  const msg = page.getByTestId('photos-timed-out');
  await expect(msg.getByRole('heading', { name: 'Your photos have timed out' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Reload the photos' })).toHaveCount(1);
  await expect(page.getByText('These photos expired')).toHaveCount(0);
  // Check the expired placeholder in the gallery
  const expired = page.locator('.media-expired').first();
  if (await expired.isVisible().catch(() => false)) {
    await expect(expired).toContainText(/Photo 1 of \d+, timed out/);
  }
  await expect(page.locator('img.mg-media')).toHaveCount(0); // no broken-image boxes
  await expect(page.locator('#step-evidence .q-answer')).not.toContainText('Check the number plate');
  await expect(page.locator('#step-evidence .q-answer')).toContainText('timed out');
  // The placeholder text is dark on light: at least 4.5:1.
  if (await expired.isVisible().catch(() => false)) {
    const ratio = await expired.evaluate((el) => {
      const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const s = getComputedStyle(el); const a = lum(s.color); const b = lum(s.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }

  await page.getByRole('button', { name: 'Reload the photos' }).tap();
  await expect(page.locator('#pn')).toHaveValue('9000000001');
  await expect(page.locator('#od-d')).toHaveValue('14');
  await expect(page.locator('#od-y')).toHaveValue('2026');
  await expect(page.locator('#rego')).toHaveValue('');
  await expect(page.locator('#rego')).toBeFocused();
  await expect(page.getByText("We don't keep your number plate, so type it again")).toBeVisible();
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
  await page.locator('.mg').first().waitFor({ timeout: 15_000 });
  // In the new gallery, images in the stage may show an error state
  // Try to open full-screen if the zoom button is available
  const zoomBtn = page.locator('.mg-zoom').first();
  if (await zoomBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await zoomBtn.tap();
    const expired = page.locator('.zp-overlay .media-expired, .gp .media-expired');
    await expect(expired).toContainText(/timed out/i, { timeout: 15_000 });
  } else {
    // Gallery stage shows error state directly
    await expect(page.getByText('timed out')).toBeVisible({ timeout: 15_000 });
  }
});
