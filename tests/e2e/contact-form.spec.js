const { test, expect } = require('@playwright/test');

const openAndFillForm = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Send besked' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Navn').fill('E2E Testbruger');
  await page.getByLabel('E-mail').fill('sedrumm@gmail.com');
  await page.getByLabel('Besked', { exact: true }).fill('Dette er en automatisk test af kontaktformularen.');
};

test('en besøgende kan åbne popup og sende formularen', async ({ page }) => {
  let submittedData;
  await page.route('**/api/contact', async route => {
    submittedData = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });

  await openAndFillForm(page);
  await page.getByRole('button', { name: 'Send besked' }).last().click();

  await expect(page.getByRole('status')).toContainText('Tak. Din besked er sendt');
  expect(submittedData).toMatchObject({
    name: 'E2E Testbruger',
    email: 'sedrumm@gmail.com',
    message: 'Dette er en automatisk test af kontaktformularen.',
    language: 'da'
  });
});

test('den rigtige mailservice kan modtage formularen', async ({ page }) => {
  test.skip(process.env.RUN_REAL_MAIL_E2E !== 'true', 'Sender en rigtig mail og køres derfor kun efter behov');

  await openAndFillForm(page);
  await page.getByRole('button', { name: 'Send besked' }).last().click();
  await expect(page.getByRole('status')).toContainText('Tak. Din besked er sendt');
});
