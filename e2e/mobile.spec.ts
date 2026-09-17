import { test, expect } from '@playwright/test';

test.describe('Mobile-First Responsive UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local dev server
    await page.goto('/');
    // Wait for the tree canvas and root person cards to render
    await page.waitForSelector('main');
  });

  test('no horizontal scrollbar or window overflow on mobile viewport', async ({ page }) => {
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });

  test('responsive mobile top navbar handles search overlay and menu drawer', async ({ page, isMobile }) => {
    if (!isMobile) return;

    // Desktop nav items should be hidden
    const desktopBar = page.locator('div.hidden.sm\\:flex');
    await expect(desktopBar.first()).toBeHidden();

    // Mobile search button should be visible
    const searchBtn = page.getByRole('button', { name: /search relatives/i });
    await expect(searchBtn).toBeVisible();

    // Open mobile search overlay
    await searchBtn.click();
    const searchInput = page.getByPlaceholder('Search relative by name...');
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Eleanor');
    await page.waitForTimeout(150);

    // Close search overlay
    const closeSearchBtn = page.getByRole('button', { name: 'Cancel' });
    await closeSearchBtn.click();
    await expect(searchInput).toBeHidden();

    // Open mobile menu drawer
    const menuBtn = page.getByRole('button', { name: 'Open menu' });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Check that mobile action drawer opened
    await expect(page.getByRole('button', { name: 'Switch & Manage Trees' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cloud & Collaboration' })).toBeVisible();

    // Close mobile menu drawer
    const closeMenuBtn = page.getByRole('button', { name: 'Close menu' });
    await closeMenuBtn.click();
    await expect(page.getByRole('button', { name: 'Switch & Manage Trees' })).toBeHidden();
  });

  test('person inspector renders as mobile bottom sheet with peek and minimize mode', async ({ page, isMobile }) => {
    if (!isMobile) return;

    // Click first person card in the canvas
    const personCard = page.getByTestId('person-card').first();
    await expect(personCard).toBeVisible();
    await personCard.click();

    // Inspector should open as bottom sheet
    const inspector = page.getByTestId('person-inspector');
    await expect(inspector).toBeVisible();

    // Check that it is anchored at bottom on mobile
    const box = await inspector.boundingBox();
    expect(box).not.toBeNull();
    const viewportSize = page.viewportSize();
    if (box && viewportSize) {
      // Bottom of the inspector should be at or near the bottom of viewport
      expect(box.y + box.height).toBeGreaterThanOrEqual(viewportSize.height - 10);
    }

    // Test minimize / peek mode
    const minimizeBtn = page.getByRole('button', { name: 'Minimize inspector' });
    if (await minimizeBtn.isVisible()) {
      await minimizeBtn.click();
      // Should now show expand button
      const expandBtn = page.getByRole('button', { name: 'Expand inspector' });
      await expect(expandBtn).toBeVisible();

      // Expand back up
      await expandBtn.click();
      await expect(minimizeBtn).toBeVisible();
    }

    // Close inspector
    const closeInspectorBtn = page.getByRole('button', { name: 'Close inspector' });
    await closeInspectorBtn.click();
    await expect(inspector).toBeHidden();
  });

  test('mobile floating controls provide thumb cluster and View & Layout popover', async ({ page, isMobile }) => {
    if (!isMobile) return;

    // Layers / View popover toggle button
    const layersBtn = page.getByRole('button', { name: /view & layout options/i });
    await expect(layersBtn).toBeVisible();

    // Open View & Layout popover
    await layersBtn.click();
    await expect(page.getByText('View & Layout')).toBeVisible();
    await expect(page.getByText('MiniMap Radar')).toBeVisible();

    // Toggle minimap from popover
    const minimapBtn = page.getByRole('button', { name: /minimap radar/i });
    await minimapBtn.click();

    // Close popover
    await layersBtn.click();
    await expect(page.getByText('View & Layout')).toBeHidden();
  });
});
