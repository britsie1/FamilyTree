import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('serves social metadata and its PNG without running the app', async ({ page, request }) => {
  const response = await page.goto('/?tree=example');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'MyFamTree — Your Family, Connected');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(imageUrl).toMatch(/^https?:\/\//);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl!);
  const image = await request.get(imageUrl!);
  expect(image.ok()).toBeTruthy();
  expect(image.headers()['content-type']).toContain('image/png');
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
});