import { test, expect } from '@playwright/test';
import { createBlankTree, STORAGE_KEY } from '../src/services/storage';
import { getPersonSilhouetteUrl } from '../src/services/personPortrait';

test.beforeEach(async ({ page }) => {
  const tree = createBlankTree();
  const person = tree.people[tree.rootPersonId!];
  Object.assign(person, {
    firstName: 'Visual', lastName: 'Test', birthDate: '1880',
    documents: [{ id: 'doc1', name: 'Record.pdf', driveFileId: 'file1', uploadedAt: '2026-01-01' }],
  });
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: tree });
  await page.goto('/');
  await expect(page.getByTestId('person-card')).toBeVisible();
});

test('unspecified cards are yellow, have one counted attachment icon, and put age below years', async ({ page }) => {
  const card = page.getByTestId('person-card');
  await expect(card).toHaveClass(/border-l-yellow-500/);
  await expect(card).toHaveCSS('border-left-color', /oklch\(0\.795 0\.184 86\.04/);
  await expect(card.getByTestId('person-card-attachment-badge')).toHaveText('1');
  await expect(card.getByTestId('person-card-attachment-icon')).toHaveCount(0);
  const years = card.getByTestId('person-card-years');
  const age = card.getByTestId('person-card-age');
  await expect(years).toHaveText('b. 1880');
  await expect(age).toHaveText(/\(age \d+\)/);
  const yearsBox = (await years.boundingBox())!;
  const ageBox = (await age.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(ageBox.y).toBeGreaterThan(yearsBox.y);
  expect(ageBox.y + ageBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  await card.click();
  await expect(page.getByRole('button', { name: /^other$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^unspecified$/i })).toBeVisible();
});

test('warning descriptions open on hover and click or tap without moving the node', async ({ page, isMobile }) => {
  const card = page.getByTestId('person-card');
  const warning = card.getByTestId('person-card-warning');
  const tooltip = page.getByRole('tooltip');
  const before = await card.evaluate((element) => element.style.transform);
  await expect(warning).toBeVisible();
  if (!isMobile) {
    await warning.hover();
    await expect(tooltip).toContainText('Unusually high living age');
    await page.mouse.move(5, 100);
    await expect(tooltip).toHaveCount(0);
  }
  if (isMobile) await warning.tap();
  else await warning.click();
  await expect(tooltip).toContainText('1880');
  expect(await card.evaluate((element) => element.style.transform)).toEqual(before);
  if (isMobile) await page.touchscreen.tap(5, 100);
  else await page.mouse.click(5, 100);
  await expect(tooltip).toHaveCount(0);
});

test('warning descriptions support keyboard focus and Escape', async ({ page }) => {
  const warning = page.getByTestId('person-card-warning');
  await warning.focus();
  await expect(page.getByRole('tooltip')).toContainText('1880');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('portrait spans the card above a larger name, dates, and age', async ({ page }) => {
  const card = page.getByTestId('person-card');
  const portrait = card.getByTestId('person-card-portrait');
  const name = card.getByTestId('person-card-name');
  await expect(name).toHaveCSS('font-size', '22px');
  const nameLines = name.getByTestId('person-card-name-line');
  await expect(nameLines).toHaveText(['Visual', 'Test']);
  const firstLineBox = (await nameLines.nth(0).boundingBox())!;
  const surnameBox = (await nameLines.nth(1).boundingBox())!;
  expect(surnameBox.y).toBeGreaterThanOrEqual(firstLineBox.y + firstLineBox.height);
  await expect(card.getByTestId('person-card-silhouette')).toHaveAttribute('src', getPersonSilhouetteUrl());
  await expect(card).not.toContainText('VT');
  const cardBox = (await card.boundingBox())!;
  const portraitBox = (await portrait.boundingBox())!;
  const nameBox = (await name.boundingBox())!;
  const yearsBox = (await card.getByTestId('person-card-years').boundingBox())!;
  const ageBox = (await card.getByTestId('person-card-age').boundingBox())!;
  expect(portraitBox.width / cardBox.width).toBeGreaterThan(0.95);
  expect(nameBox.y).toBeGreaterThanOrEqual(portraitBox.y + portraitBox.height);
  expect(yearsBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height);
  expect(ageBox.y).toBeGreaterThanOrEqual(yearsBox.y + yearsBox.height);
});

test('missing portraits follow gender and failed photos reveal the silhouette', async ({ page }) => {
  const card = page.getByTestId('person-card');
  await card.click();
  const inspector = page.getByTestId('person-inspector');
  for (const gender of ['male', 'female', 'unspecified'] as const) {
    await inspector.getByRole('button', { name: gender, exact: true }).click();
    await expect(card.getByTestId('person-card-silhouette')).toHaveAttribute('src', getPersonSilhouetteUrl(gender));
  }
  await page.evaluate(async () => {
    const { useTreeStore } = await import('/src/stores/useTreeStore.ts');
    const { tree, updatePerson } = useTreeStore.getState();
    updatePerson(tree.rootPersonId!, { avatarUrl: '/missing-portrait.jpg' });
  });
  await expect(card.getByTestId('person-card-photo')).toBeHidden();
  await expect(card.getByTestId('person-card-silhouette')).toBeVisible();
});