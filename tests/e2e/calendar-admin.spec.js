const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');

test('eventoversigten beskytter kalenderstatus og viser de tilmeldtes invitationer', async ({ page }) => {
  test.skip(!process.env.TEST_EVENT_ADMIN_KEY, 'Kræver isoleret app med test-adminnøgle.');
  await page.goto('/event/gloegg-og-hygge');
  await page.getByLabel('Dit navn', { exact: true }).fill('Kalender Admin Test');
  await page.getByLabel('Din mail', { exact: true }).fill(`admin-calendar-${randomUUID()}@example.test`);
  await page.locator('#name-form button').click();
  await expect(page.locator('#participant-display')).toContainText('Kalender Admin Test');
  await page.goto('/event');
  const panel = page.locator('details').filter({ has: page.locator('form[action="/event/admin/invitations"] input[value="gloegg-og-hygge"]') });
  await panel.getByText('Kalenderinvitationer', { exact: true }).click();
  await panel.getByLabel('Adminnøgle').fill('forkert');
  await panel.getByRole('button', { name: 'Tjek kalenderinvitationer' }).click();
  await expect(page.locator('.invitation-report')).toContainText('Adminnøglen er forkert');
  await expect(page.locator('.invitation-report')).not.toContainText('Kalender Admin Test');
  const reopened = page.locator('details[open]');
  await reopened.getByLabel('Adminnøgle').fill(process.env.TEST_EVENT_ADMIN_KEY);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/event/admin/invitations') && response.request().method() === 'POST');
  await reopened.getByRole('button', { name: 'Tjek kalenderinvitationer' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  await expect(page.locator('.invitation-status-list')).toContainText('Kalender Admin Test');
  await expect(page.locator('.invitation-report')).toContainText('Ikke sendt');
  await expect(page.locator('input[name="adminKey"]').first()).toHaveValue('');
});
