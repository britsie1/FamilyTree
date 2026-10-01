import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Regenerate the crawler-friendly PNG after editing the SVG artwork.
const svg = await readFile(new URL('../public/social-preview.svg', import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0"><img width="1200" height="630" src="data:image/svg+xml;base64,${svg.toString('base64')}" /></body>`);
  await page.locator('img').evaluate((image) => image.decode());
  await page.screenshot({ path: fileURLToPath(new URL('../public/social-preview.png', import.meta.url)) });
} finally {
  await browser.close();
}