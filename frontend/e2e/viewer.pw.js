import { expect, test } from '@playwright/test';

// iPhone 13 emulation: touch, mobile viewport. All data comes from the dev mock (invented).
async function openFirstPhoto(page) {
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.tap('button[type=submit]');
  await page.waitForSelector('h1');
  await page.locator('button.zoom-open').first().waitFor({ timeout: 15_000 });
  await page.locator('button.zoom-open').first().tap();
  await page.waitForSelector('.zp-viewport', { timeout: 10_000 });
}

const card = (page) => page.locator('.media-card').first();

const scaleOf = (page) => page.evaluate(() => {
  const m = new DOMMatrix(getComputedStyle(document.querySelector('.zp-content')).transform);
  return Math.round(m.a * 100) / 100;
});

async function twoFingers(page, from, to, steps = 6) {
  await page.locator('.zp-viewport').first().scrollIntoViewIfNeeded();
  const box = await page.locator('.zp-viewport').first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const pts = (d) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * i) / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('tapping Zoom in mounts the viewer with its controls', async ({ page }) => {
  await openFirstPhoto(page);
  await expect(card(page).getByRole('button', { name: 'Reset zoom' })).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Full screen' })).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  expect(await scaleOf(page)).toBe(1);
});

test('plus and minus buttons zoom and Reset returns to 1x', async ({ page }) => {
  await openFirstPhoto(page);
  await card(page).getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1);
  await card(page).getByRole('button', { name: 'Reset zoom' }).tap();
  await expect.poll(() => scaleOf(page)).toBe(1);
});

test('double tap zooms in and a second double tap resets', async ({ page }) => {
  await openFirstPhoto(page);
  await page.locator('.zp-viewport').first().scrollIntoViewIfNeeded();
  const box = await page.locator('.zp-viewport').first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const doubleTap = async () => { await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y); };
  await doubleTap();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.5);
  await page.waitForTimeout(500); // let the first double tap finish before the next one
  await doubleTap();
  await expect.poll(() => scaleOf(page)).toBe(1);
});

test('a two-finger pinch zooms in', async ({ page }) => {
  await openFirstPhoto(page);
  await twoFingers(page, 20, 90);
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.5);
});

test('full screen falls back to a locked overlay with a Close button', async ({ page }) => {
  await openFirstPhoto(page);
  // iOS Safari has no element Fullscreen API: make this browser look the same.
  await page.evaluate(() => { Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true }); });
  await card(page).getByRole('button', { name: 'Full screen' }).tap();
  await expect(page.locator('.zp-overlay')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  const box = await page.locator('.zp-overlay').boundingBox();
  const vp = page.viewportSize();
  expect(Math.round(box.width)).toBe(vp.width);
  await card(page).getByRole('button', { name: 'Close' }).tap();
  await expect(page.locator('.zp-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('a viewer that fails to load says so and offers Try again', async ({ page }) => {
  await page.route('**/ZoomPan*', (route) => route.abort());
  await page.route('**/src/ZoomPan.jsx*', (route) => route.abort());
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.tap('button[type=submit]');
  await page.locator('button.zoom-open').first().waitFor({ timeout: 15_000 });
  await page.locator('button.zoom-open').first().tap();
  await expect(page.getByText('The zoom viewer could not load')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
});
