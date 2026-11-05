import { devices, expect, test } from '@playwright/test';

// UI-02: focus moves into the viewer, stays there, returns on close; the page behind is inert. Invented mock data only.
async function results(page) {
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.keyboard.press('Enter');
  await page.locator('.media-card').first().waitFor({ timeout: 15_000 });
  await page.locator('.cert-list').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
}
const active = (page) => page.evaluate(() => ({ inDialog: !!document.activeElement.closest('.zp-overlay'), label: document.activeElement.getAttribute('aria-label'), cls: document.activeElement.className }));

test.describe('phone (touch)', () => {
  test('expand button is 44px, named, and opens the dialog; focus moves in, traps, Escape returns it', async ({ page }) => {
    await results(page);
    await expect(page.locator('button.zoom-open')).toHaveCount(0);
    await expect(page.getByText('Double tap a photo to see it full screen.')).toBeVisible();
    const btn = page.getByRole('button', { name: /^Open photo 1 of \d+ full screen$/ });
    const b = await btn.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
    await btn.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: /^Photo viewer, photo 1 of \d+$/ });
    await expect(dlg).toBeVisible();
    await expect(dlg).toBeFocused();
    expect(await page.evaluate(() => document.querySelector('#root').inert || [...document.querySelectorAll('#root > *')].every((e) => e.inert || e.contains(document.querySelector('.zp-overlay'))))).toBe(true);
    for (let i = 0; i < 14; i += 1) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect((await active(page)).inDialog).toBe(true); }
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.zp-overlay [role=status]').filter({ hasText: 'Photo 2 of' })).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: /^Photo viewer, photo 2 of/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.zp-overlay')).toHaveCount(0);
    await expect(btn).toBeFocused();
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
  });

  test('a double tap on the photo opens the viewer; one tap does not', async ({ page }) => {
    await results(page);
    const frame = page.locator('.media-wrap .media-frame').first();
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    const x = box.x + 20; const y = box.y + 20;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(600);
    await expect(page.locator('.zp-overlay')).toHaveCount(0);
    await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y);
    await expect(page.locator('.zp-overlay')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).tap();
    await expect(page.getByRole('button', { name: /^Open photo 1 of \d+ full screen$/ })).toBeFocused();
  });
});

test.describe('desktop (keyboard)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1, userAgent: devices['Desktop Chrome'].userAgent });

  test('Zoom in stays, focus moves into the viewer; Full screen is a trapped dialog that returns focus', async ({ page }) => {
    await results(page);
    await expect(page.locator('button.expand-open')).toHaveCount(0);
    await expect(page.getByText('Double tap a photo')).toHaveCount(0);
    const zoom = page.locator('button.zoom-open').first();
    await zoom.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.media-card .zp-viewport').first()).toBeFocused(); // not <body>
    const fs = page.locator('.media-card').first().getByRole('button', { name: 'Full screen' });
    await page.evaluate(() => { Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true }); });
    await fs.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: /^Photo viewer, photo 1 of \d+$/ });
    await expect(dlg).toBeFocused();
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => !!document.querySelector('.zp-overlay').closest('[inert]'))).toBe(false);
    for (let i = 0; i < 14; i += 1) { await page.keyboard.press('Tab'); expect((await active(page)).inDialog).toBe(true); }
    await page.keyboard.press('Shift+Tab');
    expect((await active(page)).inDialog).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.zp-overlay')).toHaveCount(0);
    await expect(fs).toBeFocused();
  });
});
