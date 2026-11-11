import { expect, test } from '@playwright/test';

// iPhone 13 emulation: touch, mobile viewport. All data comes from the dev mock (invented).
async function openGallery(page) {
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.tap('button[type=submit]');
  await page.waitForSelector('h1');
  await page.locator('.mg').first().waitFor({ timeout: 15_000 });
  await page.locator('.cert-list').waitFor({ timeout: 15_000 });
  await page.locator('video').first().waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function openFullScreen(page) {
  await openGallery(page);
  // Tap the stage image to open full-screen
  await page.locator('.mg-zoom').first().tap();
  await page.locator('.zp-overlay').waitFor({ timeout: 10_000 });
  await expect(page.locator('.zp-overlay')).toBeVisible();
}

const scaleOf = (page) => page.evaluate(() => {
  const el = document.querySelector('.zp-overlay .zp-content') || document.querySelector('.mg .zp-content');
  if (!el) return 1;
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return Math.round(m.a * 100) / 100;
});

async function twoFingers(page, from, to, steps = 6) {
  const vp = page.locator('.zp-overlay .zp-viewport').first();
  await vp.scrollIntoViewIfNeeded();
  const box = await vp.boundingBox();
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

test('tapping the stage image opens the full-screen viewer with its controls', async ({ page }) => {
  await openFullScreen(page);
  await expect(page.locator('.zp-overlay').getByRole('button', { name: 'Reset zoom' })).toBeVisible();
  await expect(page.locator('.zp-overlay').getByRole('button', { name: /close/i })).toBeVisible();
  await expect(page.locator('.zp-overlay').getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  expect(await scaleOf(page)).toBe(1);
});

test('plus and minus buttons zoom and Reset returns to 1x', async ({ page }) => {
  await openFullScreen(page);
  await page.locator('.zp-overlay').getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1);
  await page.locator('.zp-overlay').getByRole('button', { name: 'Reset zoom' }).tap();
  await expect.poll(() => scaleOf(page)).toBe(1);
});

test('double tap zooms in and a second double tap resets', async ({ page }) => {
  await openFullScreen(page);
  const vp = page.locator('.zp-overlay .zp-viewport').first();
  await vp.scrollIntoViewIfNeeded();
  const box = await vp.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const doubleTap = async () => { await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y); };
  await doubleTap();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.5);
  await page.waitForTimeout(500);
  await doubleTap();
  await expect.poll(() => scaleOf(page)).toBe(1);
});

test('a two-finger pinch zooms in', async ({ page }) => {
  await openFullScreen(page);
  await twoFingers(page, 20, 90);
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.5);
});

test('the full-screen viewer is a locked overlay with a Close button', async ({ page }) => {
  await openFullScreen(page);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  const box = await page.locator('.zp-overlay').boundingBox();
  expect(Math.round(box.width)).toBe(page.viewportSize().width);
  await page.locator('.zp-overlay').getByRole('button', { name: /close/i }).tap();
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
  await page.locator('.mg').first().waitFor({ timeout: 15_000 });
  // Try to open full-screen — ZoomPan will fail to load
  await page.locator('.mg-zoom').first().tap();
  await expect(page.getByText('The zoom viewer could not load')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
});

// ---- Full-screen gallery: swipe, arrows, buttons, position, focus ----
const pos = (page) => page.locator('.zp-overlay .zp-pos');

async function swipe(page, dx) {
  const box = await page.locator('.zp-overlay .zp-viewport').boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2 - dx / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 6, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('full screen shows a position indicator and Previous/Next buttons', async ({ page }) => {
  await openFullScreen(page);
  await expect(pos(page)).toHaveText(/^1 \/ \d+$/);
  await expect(page.getByRole('button', { name: 'Previous photo' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Next photo' }).tap();
  await expect(pos(page)).toHaveText(/^2 \/ \d+$/);
  await page.getByRole('button', { name: 'Previous photo' }).tap();
  await expect(pos(page)).toHaveText(/^1 \/ \d+$/);
});

test('swiping left and right moves between photos', async ({ page }) => {
  await openFullScreen(page);
  await swipe(page, -160);
  await expect(pos(page)).toHaveText(/^2 \/ \d+$/);
  await swipe(page, 160);
  await expect(pos(page)).toHaveText(/^1 \/ \d+$/);
});

test('when zoomed in a horizontal drag pans instead of changing photo', async ({ page }) => {
  await openFullScreen(page);
  await page.locator('.zp-overlay').getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(1);
  await swipe(page, -160);
  await expect(pos(page)).toHaveText(/^1 \/ \d+$/);
});

test('arrow keys move between photos and focus stays inside the dialog', async ({ page }) => {
  await openFullScreen(page);
  await page.keyboard.press('ArrowRight');
  await expect(pos(page)).toHaveText(/^2 \/ \d+$/);
  await page.keyboard.press('ArrowLeft');
  await expect(pos(page)).toHaveText(/^1 \/ \d+$/);
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.zp-overlay'))).toBe(true);
  }
});

test('the photo being reached shows a progress placeholder while it loads', async ({ page }) => {
  await page.route('**/samples/image-2.jpg', async (route) => { await new Promise((r) => setTimeout(r, 8000)); await route.continue(); });
  await openFullScreen(page);
  await page.getByRole('button', { name: 'Next photo' }).tap();
  await expect(page.locator('.zp-overlay').getByText('Loading photo')).toBeVisible();
  await expect(page.locator('.zp-overlay').getByText('Loading photo')).toHaveCount(0, { timeout: 20_000 });
});
