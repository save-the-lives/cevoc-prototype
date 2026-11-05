import { expect, test } from '@playwright/test';

// UI-01: Edit and Back bring the notice number and date back; the plate stays cleared and nothing is stored.
test('Edit and Back keep the notice number and date but not the plate', async ({ page }) => {
  await page.goto('/?mock=1');
  await page.fill('#pn', '9000000001');
  await page.fill('#od-d', '14'); await page.fill('#od-m', '3'); await page.fill('#od-y', '2026');
  await page.fill('#rego', 'ZZZ999');
  await page.tap('button[type=submit]');
  await page.waitForSelector('h1');
  for (const way of ['edit', 'back']) {
    if (way === 'edit') await page.getByRole('button', { name: 'Edit' }).first().click(); else await page.goBack();
    await expect(page.locator('#pn')).toHaveValue('9000000001');
    await expect(page.locator('#od-d')).toHaveValue('14');
    await expect(page.locator('#od-m')).toHaveValue('3');
    await expect(page.locator('#od-y')).toHaveValue('2026');
    await expect(page.locator('#rego')).toHaveValue('');
    if (way === 'edit') { await page.fill('#rego', 'ZZZ999'); await page.tap('button[type=submit]'); await page.waitForSelector('h1'); }
  }
  const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, document.cookie, location.href]));
  expect(stored).not.toMatch(/9000000001|ZZZ999/);
});
