const { test, expect } = require('@playwright/test');

test('quizzerne kan åbnes direkte fra /event', async ({ page }) => {
  await page.goto('/event');
  const cards = page.locator('.quiz-overview-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute('href', '/event/quiz/rpa');
  await expect(cards.nth(1)).toHaveAttribute('href', '/event/quiz/systemintegration');
  await expect(cards.nth(2)).toHaveAttribute('href', '/event/quiz/large-systems');
  await cards.nth(0).click();
  await expect(page).toHaveURL(/\/event\/quiz\/rpa$/);
  await expect(page.locator('.quiz-start')).toBeDisabled();
});
