const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');

test('tilmelding sender én kalenderinvitation og viser faktisk sendestatus', async ({ page, request, browser, baseURL }) => {
  test.skip(process.env.CALENDAR_INTEGRATION_TEST !== 'true', 'Kræver isoleret mailservice med SMTP/Mailpit.');
  const mailpit = process.env.TEST_MAILPIT_URL || 'http://127.0.0.1:28025';
  const email = `calendar-${randomUUID()}@example.test`;
  await page.goto('/event/gloegg-og-hygge');
  await page.getByLabel('Dit navn', { exact: true }).fill('Kalender Test');
  await page.getByLabel('Din mail', { exact: true }).fill(email);
  await page.locator('#name-form button').click();
  await expect(page.locator('#participant-display')).toContainText('Kalender Test');
  await expect.poll(async () => {
    await page.getByRole('button', { name: 'Tjek invitation', exact: true }).click();
    return page.locator('#invitation-status').textContent();
  }, { timeout: 20000 }).toContain('Kalenderinvitationen er sendt');

  await page.reload();
  await expect(page.locator('#invitation-status')).toContainText('Kalenderinvitationen er sendt');
  const again = await page.evaluate(async () => {
    const { csrfToken } = await (await fetch('/event/api/csrf')).json();
    const responses = await Promise.all(Array.from({ length: 3 }, () => fetch('/event/api/invitation', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ eventId: 'gloegg-og-hygge' })
    }).then(response => response.json())));
    return responses.map(response => response.invitation.status);
  });
  expect(again).toEqual(['sent', 'sent', 'sent']);

  const messages = await (await request.get(`${mailpit}/api/v1/messages`)).json();
  const own = messages.messages.filter(message => message.To.some(to => to.Address === email));
  expect(own).toHaveLength(1);
  const raw = await (await request.get(`${mailpit}/api/v1/message/${own[0].ID}/raw`)).text();
  expect(raw).toContain('text/calendar');
  expect(raw).toMatch(/method[=:]["']?REQUEST/i);
  const details = await (await request.get(`${mailpit}/api/v1/message/${own[0].ID}`)).json();
  expect(details.Attachments).toHaveLength(1);
  const attachment = details.Attachments[0];
  const calendar = await (await request.get(`${mailpit}/api/v1/message/${own[0].ID}/part/${attachment.PartID}`)).text();
  expect(calendar).toContain('METHOD:REQUEST');
  expect(calendar).toContain('DTSTART:20261204T173000Z');
  expect(calendar).toContain('DTEND:20261204T223000Z');
  expect(calendar.replace(/\r\n /g, '')).toContain(`mailto:${email}`);

  const anonymous = await browser.newContext({ baseURL });
  const unauthorized = await anonymous.request.get('/event/api/participant?event=gloegg-og-hygge');
  expect((await unauthorized.json()).participant).toBeNull();
  const csrf = await (await anonymous.request.get('/event/api/csrf')).json();
  const denied = await anonymous.request.post('/event/api/invitation', {
    headers: { origin: new URL(baseURL).origin, 'x-csrf-token': csrf.csrfToken },
    data: { eventId: 'gloegg-og-hygge' }
  });
  expect(denied.status()).toBe(401);
  await anonymous.close();
});
