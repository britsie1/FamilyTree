import { test, expect } from '@playwright/test';
import { createBlankTree, STORAGE_KEY } from '../src/services/storage';

test.beforeEach(async ({ page }) => {
  const tree = createBlankTree();
  tree.people[tree.rootPersonId!].firstName = 'Archive';
  tree.people[tree.rootPersonId!].documents = [
    { id: 'doc1', name: 'Record.pdf', driveFileId: 'file1', uploadedAt: '2026-01-01', description: 'Original scan' },
    { id: 'doc2', name: 'Letter.pdf', driveFileId: 'file2', uploadedAt: '2026-01-01' },
  ];
  await page.addInitScript(({ key, data }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORAGE_KEY, data: tree });
  await page.route('https://drive.google.com/**', (route) => route.fulfill({ body: '<html>Scan</html>', contentType: 'text/html' }));
  await page.goto('/');
  await page.getByTestId('person-card').click();
});

test('edit, persist, preview, cancel and clear typed attachment details', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit details for Record.pdf', exact: true }).click();
  await expect(page.getByLabel('Description / notes')).toHaveValue('Original scan');
  await page.getByLabel('Document type', { exact: true }).fill('Birth register');
  await page.getByLabel('Document date', { exact: true }).fill('circa 1890');
  await page.getByLabel('Place', { exact: true }).fill('Cape Town');
  await page.getByLabel('Source / reference').fill('Register 4, page 12');
  const text = 'John Smith\nBorn 12 March 1890\nMother: [illegible] <script>alert(1)</script>';
  await page.getByLabel('Transcription / typed details').fill(text);
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByTestId('person-card').click();
  await page.getByRole('button', { name: 'Details for Record.pdf', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit details for Record.pdf', exact: true }).click();
  await page.getByLabel('Transcription / typed details').fill('Discard this');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Document Preview' });
  await expect(dialog.getByText(text, { exact: true })).toBeVisible();
  await expect(dialog.getByText('circa 1890', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close preview' }).click();
  await page.getByRole('button', { name: 'Edit details for Record.pdf', exact: true }).click();
  await page.getByLabel('Transcription / typed details').fill('');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Details for Letter.pdf', exact: true }).click();
  await expect(page.getByText('No typed details added yet.')).toBeVisible();
});

test('viewers can read details but cannot edit attachments', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/stores/useCollabStore.ts';
    const { useCollabStore } = await import(/* @vite-ignore */ path);
    useCollabStore.getState().setUserPermission('viewer');
  });
  await page.getByRole('button', { name: 'Details for Record.pdf', exact: true }).click();
  await expect(page.getByText('Original scan', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit details for/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete this document' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Document Preview' });
  await expect(dialog.getByText('Original scan', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
});

test('preview edits save immediately, persist, cancel, clear and leave other attachments unchanged', async ({ page }) => {
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Document Preview' });
  // Editing must target the previewed attachment even if canvas selection changes.
  await page.evaluate(async () => {
    const path = '/src/stores/useCanvasStore.ts';
    const { useCanvasStore } = await import(/* @vite-ignore */ path);
    useCanvasStore.getState().clearSelection();
  });
  await dialog.getByRole('button', { name: 'Edit details', exact: true }).click();
  await expect(dialog.getByLabel('Description / notes')).toHaveValue('Original scan');
  const values = [
    ['Description / notes', 'Updated scan notes'],
    ['Document type', 'Birth register'],
    ['Document date', 'circa 1890'],
    ['Place', 'Cape Town'],
    ['Source / reference', 'Register 4, page 12'],
    ['Transcription / typed details', 'John Smith\nMother: [illegible]'],
  ];
  for (const [label, value] of values) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByText('John Smith\nMother: [illegible]', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit details', exact: true }).click();
  await dialog.getByLabel('Transcription / typed details').fill('Discard this');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByText('John Smith\nMother: [illegible]', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit details', exact: true }).click();
  await dialog.getByLabel('Document date', { exact: true }).fill('Unsaved date');
  await dialog.getByRole('button', { name: 'Close preview' }).click();
  await page.reload();
  await page.getByTestId('person-card').click();
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Edit details', exact: true }).click();
  for (const [label, value] of values) await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(value);
  await dialog.getByLabel('Transcription / typed details').fill('');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByText('John Smith\nMother: [illegible]', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close preview' }).click();
  await page.getByRole('button', { name: 'Details for Letter.pdf', exact: true }).click();
  await expect(page.getByText('No typed details added yet.')).toBeVisible();
});

test('new uploads retain typed details with the original file', async ({ page }) => {
  await page.evaluate(async () => {
    const treePath = '/src/stores/useTreeStore.ts';
    const drivePath = '/src/services/googleDriveService.ts';
    const { useTreeStore } = await import(/* @vite-ignore */ treePath);
    const { storeDriveToken } = await import(/* @vite-ignore */ drivePath);
    storeDriveToken('test-token');
    useTreeStore.getState().setTree((tree: any) => ({
      ...tree, googleDriveConfig: { folderId: 'folder1', folderName: 'Family records' },
    }));
  });
  await page.route('https://www.googleapis.com/upload/drive/v3/files**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ id: 'uploaded-file', mimeType: 'application/pdf', createdTime: '2026-10-02T12:00:00Z' }),
  }));
  await page.getByRole('button', { name: 'Attach', exact: true }).click();
  await page.locator('#attach-doc-file-input').setInputFiles({ name: 'New record.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test scan') });
  await page.getByLabel('Document date', { exact: true }).fill('1890');
  await page.getByLabel('Transcription / typed details').fill('Typed during upload\nSecond line');
  await page.getByRole('button', { name: 'Upload & Attach' }).click();
  await page.getByRole('button', { name: 'Details for New record.pdf', exact: true }).click();
  await expect(page.getByText('Typed during upload\nSecond line', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByTestId('person-card').click();
  await page.getByRole('button', { name: 'Edit details for New record.pdf', exact: true }).click();
  await expect(page.getByLabel('Document date', { exact: true })).toHaveValue('1890');
  await expect(page.getByLabel('Transcription / typed details')).toHaveValue('Typed during upload\nSecond line');
});