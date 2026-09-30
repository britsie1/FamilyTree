import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('person-card').first()).toBeVisible();
  // Allow the initial fit-to-screen to finish before measuring movement.
  await page.waitForTimeout(250);
});

test('opens with no person selected or inspector displayed', async ({ page }) => {
  await expect(page.getByTestId('person-inspector')).toBeHidden();
  await expect(page.getByTitle('Selected', { exact: true })).toHaveCount(0);
});

test('navigation drag pans over cards, coasts, and leaves node positions unchanged', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse momentum is tested on desktop');
  await page.getByRole('button', { name: 'Navigate', exact: true }).click();
  const card = page.getByTestId('person-card').first();
  const plane = page.locator('#tree-capture-plane');
  const before = await card.boundingBox();
  const localTransform = await card.evaluate((el) => (el as HTMLElement).style.transform);
  const start = await plane.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
  const x = before!.x + before!.width / 2;
  const y = before!.y + before!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + i * 12, y + i * 5);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const released = await plane.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
  expect(released).toBeGreaterThan(start + 65);
  await expect.poll(() => plane.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e)).toBeGreaterThan(released + 10);
  await page.keyboard.press('Escape');
  const stopped = await plane.getAttribute('style');
  await page.waitForTimeout(100);
  expect(await plane.getAttribute('style')).toBe(stopped);
  expect(await card.evaluate((el) => (el as HTMLElement).style.transform)).toBe(localTransform);
  await expect(page.getByTestId('person-inspector')).toBeHidden();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await card.click();
  await expect(page.getByTestId('person-inspector')).toBeVisible();
});

test('touch navigation pans rather than dragging a card', async ({ page }) => {
  await page.getByRole('button', { name: 'Navigate', exact: true }).click();
  const card = page.getByTestId('person-card').first();
  const localTransform = await card.evaluate((el) => (el as HTMLElement).style.transform);
  const plane = page.locator('#tree-capture-plane');
  const start = await plane.getAttribute('style');
  await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const dispatch = (type: string, dx: number, end = false) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touch = { clientX: rect.x + rect.width / 2 + dx, clientY: rect.y + rect.height / 2 };
      Object.defineProperties(event, { touches: { value: end ? [] : [touch] }, changedTouches: { value: [touch] } });
      element.dispatchEvent(event);
    };
    dispatch('touchstart', 0);
    dispatch('touchmove', 70);
    dispatch('touchend', 70, true);
  });
  await expect(plane).not.toHaveAttribute('style', start!);
  expect(await card.evaluate((el) => (el as HTMLElement).style.transform)).toBe(localTransform);
  await expect(page.getByTestId('person-inspector')).toBeHidden();
});

test('day entry does not pad the first digit and saves on blur for birth and death', async ({ page }) => {
  await page.getByTestId('person-card').first().click();
  const inspector = page.getByTestId('person-inspector');
  await inspector.getByLabel('Deceased', { exact: true }).check();
  for (const kind of ['Birth', 'Death']) {
    const year = inspector.getByPlaceholder(`${kind} Year (YYYY)`);
    await year.fill('2000');
    const group = year.locator('../..');
    await group.locator('select').selectOption('02');
    const day = group.getByPlaceholder('Day', { exact: true });
    await day.fill('');
    await day.pressSequentially('2');
    await expect(day).toHaveValue('2');
    await day.pressSequentially('9');
    await expect(day).toHaveValue('29');
    await day.press('Tab');
    await expect(day).toHaveValue('29');
    await day.fill('1');
    await expect(day).toHaveValue('1');
    await day.press('Tab');
    await expect(day).toHaveValue('01');
  }
  await page.reload();
  await page.getByTestId('person-card').first().click();
  for (const day of await page.getByTestId('person-inspector').getByPlaceholder('Day', { exact: true }).all()) {
    await expect(day).toHaveValue('01');
  }
});

test('canvas cursors use outlined assets in both themes', async ({ page }) => {
  const canvas = page.getByTestId('tree-canvas');
  for (const dark of [false, true]) {
    await page.evaluate((enabled) => document.documentElement.classList.toggle('dark', enabled), dark);
    await expect(canvas).toHaveCSS('cursor', /cursors\/grab\.svg/);
    await expect(page.getByTestId('person-card').first()).toHaveCSS('cursor', /cursors\/pointer\.svg/);
  }
  for (const name of ['grab', 'grabbing', 'pointer']) {
    const response = await page.request.get(`/cursors/${name}.svg`);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain('stroke="#0f172a"');
  }
});