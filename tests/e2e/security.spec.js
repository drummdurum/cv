const { test, expect } = require('@playwright/test');
const WebSocket = require('ws');

test('sikkerhedsheaders beskytter siden uden at stoppe dens scripts', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self' 'nonce-");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-powered-by']).toBeUndefined();
  await page.getByRole('button', { name: 'Send besked' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('eventformularen afviser POST uden CSRF-token', async ({ page }) => {
  await page.goto('/event/fredagsbar');
  const status = await page.evaluate(async () => {
    const response = await fetch('/event/api/participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'fredagsbar', name: 'Test', email: 'test@example.test' })
    });
    return response.status;
  });
  expect(status).toBe(403);
});

test('WebSocket afviser en fremmed origin', async () => {
  const status = await new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:3010/event/ws?event=fredagsbar', { origin: 'https://evil.example' });
    socket.on('unexpected-response', (_request, response) => resolve(response.statusCode));
    socket.on('open', () => reject(new Error('Fremmed origin fik adgang')));
    socket.on('error', reject);
  });
  expect(status).toBe(403);
});
