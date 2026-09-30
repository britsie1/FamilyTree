import { test, expect } from '@playwright/test';

test.describe('Node dragging', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse interactions are desktop-specific');
    await page.goto('/');
    await expect(page.getByTestId('person-card').first()).toBeVisible();
  });

  test('moves a selection together, preserves it on drop, and supports undo', async ({ page }) => {
    const cards = page.getByTestId('person-card');
    await cards.nth(0).click({ modifiers: ['Shift'] });
    await cards.nth(1).click({ modifiers: ['Shift'] });
    const first = cards.nth(0);
    const second = cards.nth(1);
    const start = await first.boundingBox();
    const other = await second.boundingBox();
    expect(start).not.toBeNull();
    expect(other).not.toBeNull();
    const id = await first.getAttribute('data-person-id');
    const secondId = await second.getAttribute('data-person-id');
    const x = start!.x + start!.width / 2;
    const y = start!.y + start!.height / 2;
    await page.keyboard.down('Alt');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 57, y + 43, { steps: 10 });
    await expect.poll(async () => (await first.boundingBox())!.x - start!.x).toBeCloseTo(57, 0);
    await expect.poll(async () => (await second.boundingBox())!.y - other!.y).toBeCloseTo(43, 0);
    await page.mouse.up();
    await page.keyboard.up('Alt');
    const moved = page.locator(`[data-person-id="${id}"]`);
    const movedOther = page.locator(`[data-person-id="${secondId}"]`);
    await expect.poll(async () => (await moved.boundingBox())!.x - start!.x).toBeCloseTo(57, 0);
    await expect(moved.getByTitle('Selected', { exact: true })).toBeVisible();
    await expect(movedOther.getByTitle('Selected', { exact: true })).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await moved.boundingBox())!.x).toBeCloseTo(start!.x, 0);
    await expect.poll(async () => (await movedOther.boundingBox())!.y).toBeCloseTo(other!.y, 0);
  });

  test('has no position transition and Escape cancels a preview', async ({ page }) => {
    const card = page.getByTestId('person-card').first();
    expect(await card.evaluate((el) => getComputedStyle(el).transitionProperty)).not.toMatch(/all|transform/);
    const before = await card.boundingBox();
    const x = before!.x + before!.width / 2;
    const y = before!.y + before!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 55, { steps: 5 });
    await expect.poll(async () => (await card.boundingBox())!.x).not.toBe(before!.x);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before!.x, 0);
    await expect(page.getByTestId('drag-guide-x')).toBeHidden();
    await expect(page.getByTestId('drag-guide-y')).toBeHidden();
  });

  test('snaps to the grid with guides and Alt releases the snap', async ({ page }) => {
    const card = page.getByTestId('person-card').first();
    const before = await card.boundingBox();
    const plane = page.locator('#tree-capture-plane');
    const geometry = await plane.evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      const container = element.parentElement!.getBoundingClientRect();
      return { zoom: matrix.a, x: matrix.e + container.x, y: matrix.f + container.y };
    });
    const worldX = (before!.x - geometry.x) / geometry.zoom;
    const worldY = (before!.y - geometry.y) / geometry.zoom;
    const dx = (Math.round((worldX + 80) / 32) * 32 + 1 - worldX) * geometry.zoom;
    const dy = (Math.round((worldY + 60) / 32) * 32 + 1 - worldY) * geometry.zoom;
    const x = before!.x + before!.width / 2;
    const y = before!.y + before!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    // SVG lines have a zero-width/height bounding box, so check their display state.
    await expect(page.getByTestId('drag-guide-x')).not.toHaveCSS('display', 'none');
    await expect(page.getByTestId('drag-guide-y')).not.toHaveCSS('display', 'none');
    await page.keyboard.down('Alt');
    await page.mouse.move(x + dx + 0.5, y + dy + 0.5);
    await expect(page.getByTestId('drag-guide-x')).toBeHidden();
    await expect(page.getByTestId('drag-guide-y')).toBeHidden();
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect.poll(async () => (await card.boundingBox())!.x - before!.x).toBeCloseTo(dx + 0.5, 0);
  });
});

test('touch dragging previews immediately and touchcancel restores the card', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('person-card').first();
  await expect(card).toBeVisible();
  const before = await card.boundingBox();
  await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    // WebKit does not expose a constructible Touch; dispatch portable touch-shaped events.
    const dispatch = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 1, target: element, clientX, clientY };
      Object.defineProperties(event, { touches: { value: [touch] }, changedTouches: { value: [touch] } });
      element.dispatchEvent(event);
    };
    dispatch('touchstart', rect.x + rect.width / 2, rect.y + rect.height / 2);
    dispatch('touchmove', rect.x + rect.width / 2 + 75, rect.y + rect.height / 2 + 50);
  });
  await expect.poll(async () => (await card.boundingBox())!.x).toBeGreaterThan(before!.x + 60);
  await card.evaluate((element) => element.dispatchEvent(new Event('touchcancel', { bubbles: true })));
  await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before!.x, 0);
});