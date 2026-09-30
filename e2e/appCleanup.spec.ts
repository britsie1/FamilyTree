import { test, expect, type Page } from '@playwright/test';

async function openActions(page: Page, isMobile: boolean) {
  await page.getByRole('button', { name: isMobile ? 'Open menu' : 'More', exact: true }).click();
}

async function openDetails(page: Page, isMobile: boolean) {
  await openActions(page, isMobile);
  await page.getByRole(isMobile ? 'button' : 'menuitem', { name: 'Tree details', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('person-card')).toHaveCount(1);
});

test('uses MyFamTree branding and the same SVG for logo and favicon', async ({ page }) => {
  await expect(page).toHaveTitle('MyFamTree — Your Family, Connected');
  const logo = page.getByRole('img', { name: 'MyFamTree', exact: true });
  await expect(logo).toBeVisible();
  const source = await logo.getAttribute('src');
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toBe(source);
  expect((await page.request.get(source!)).ok()).toBeTruthy();
  expect(await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('removes presets from menus, management, and the help guide', async ({ page, isMobile }) => {
  await openActions(page, isMobile);
  await expect(page.getByText('Preset Examples', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Load Preset Example...', { exact: true })).toHaveCount(0);
  await page.getByRole(isMobile ? 'button' : 'menuitem', { name: 'Switch & Manage Trees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Family Trees' })).toBeVisible();
  await expect(page.getByText('Add Sample:', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create New Local Tree', exact: true }).click();
  await expect(page.getByTestId('person-card')).toHaveCount(1);
  await expect(page.getByTestId('person-inspector')).toBeHidden();
  await openActions(page, isMobile);
  await page.getByRole(isMobile ? 'button' : 'menuitem', { name: 'Edge Cases & Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Complex Genealogy & Edge Cases' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load Double In-Law Demo Tree' })).toHaveCount(0);
});

test('edits and persists tree descriptions, supports clearing and cancellation', async ({ page, isMobile }) => {
  await openDetails(page, isMobile);
  const dialog = page.getByRole('dialog', { name: 'Tree details' });
  await dialog.getByLabel('Tree name', { exact: true }).fill('Our family story');
  await dialog.getByLabel('Description', { exact: true }).fill('Research from three generations.');
  await dialog.getByRole('button', { name: 'Save details' }).click();
  await page.reload();
  await openDetails(page, isMobile);
  await expect(dialog.getByLabel('Tree name', { exact: true })).toHaveValue('Our family story');
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('Research from three generations.');
  await dialog.getByLabel('Description', { exact: true }).fill('Discard this');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openDetails(page, isMobile);
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('Research from three generations.');
  await dialog.getByLabel('Description', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Save details' }).click();
  await openDetails(page, isMobile);
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('');
});

test('viewers can read but cannot edit tree details', async ({ page, isMobile }) => {
  await page.evaluate(async () => {
    const path = '/src/stores/useCollabStore.ts';
    const { useCollabStore } = await import(/* @vite-ignore */ path);
    useCollabStore.getState().setUserPermission('viewer');
  });
  await openDetails(page, isMobile);
  const dialog = page.getByRole('dialog', { name: 'Tree details' });
  await expect(dialog.getByLabel('Tree name', { exact: true })).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveAttribute('readonly', '');
  await expect(dialog.getByRole('button', { name: 'Save details' })).toHaveCount(0);
});

test('More menu supports keyboard navigation, Escape, and outside clicks', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop dropdown keyboard behavior');
  const more = page.getByRole('button', { name: 'More', exact: true });
  await more.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Tree details', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Switch & Manage Trees', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('img', { name: 'MyFamTree', exact: true }).click();
  await expect(page.getByRole('menu')).toBeHidden();
});

test('navigation remains inside the viewport at tablet and desktop widths', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop navigation widths');
  for (const width of [640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.getByRole('button', { name: 'More', exact: true }).boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.x).toBeGreaterThan(0);
    const outside = await page.locator('header button:visible, header input:visible, header img:visible').evaluateAll((elements) => elements.some((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left < 0 || rect.right > window.innerWidth;
    }));
    expect(outside).toBe(false);
  }
});