import { test, expect } from '@playwright/test';
import { createBlankTree, STORAGE_KEY } from '../src/services/storage';

test.describe('Marriage Node Documents and Comments', () => {
  test.beforeEach(async ({ page }) => {
    const tree = createBlankTree();
    const rootId = tree.rootPersonId!;
    tree.people[rootId].firstName = 'George';
    tree.people[rootId].lastName = 'Washington';

    // Add spouse and union
    const spouseId = 'spouse_martha';
    const unionId = 'u_george_martha';
    tree.people[spouseId] = {
      id: spouseId,
      firstName: 'Martha',
      lastName: 'Dandridge',
      gender: 'female',
      unionIds: [unionId],
    };
    tree.people[rootId].unionIds = [unionId];
    tree.unions[unionId] = {
      id: unionId,
      partnerIds: [rootId, spouseId],
      childrenIds: [],
      type: 'married',
      marriageDate: '1759-01-06',
      notes: 'Married at White House plantation.',
      comments: 'Married at White House plantation.',
      documents: [
        {
          id: 'doc_marr_cert',
          name: 'MarriageBond.pdf',
          driveFileId: 'drive_file_marr_1',
          uploadedAt: '2026-01-01',
          description: 'Official marriage bond copy',
          documentType: 'Marriage Certificate',
          documentDate: '6 Jan 1759',
          documentPlace: 'New Kent County, Virginia',
          sourceReference: 'Virginia Historical Society',
          transcription: 'George Washington & Martha Custis',
        },
      ],
    };

    await page.addInitScript(
      ({ key, data }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: tree }
    );
    await page.route('https://drive.google.com/**', (route) =>
      route.fulfill({ body: '<html>Certificate Scan</html>', contentType: 'text/html' })
    );
    await page.goto('/');
  });

  test('marriage circle shows document badge and opens modal with comments and documents', async ({ page }) => {
    // Canvas marriage node circle
    const unionNode = page.getByTestId('union-node-u_george_martha');
    await expect(unionNode).toBeVisible();

    // Verify document badge indicator shows "1" on the union node
    const badge = unionNode.getByTestId('union-document-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // Click the marriage node circle to open EditUnionModal
    await unionNode.click();

    // Verify modal header shows George Washington & Martha Dandridge
    await expect(page.getByRole('heading', { name: 'George Washington & Martha Dandridge' })).toBeVisible();

    // Verify comments textarea is present and displays the existing comment
    const commentsInput = page.getByLabel('Comments');
    await expect(commentsInput).toBeVisible();
    await expect(commentsInput).toHaveValue('Married at White House plantation.');

    // Edit comments
    await commentsInput.fill('Updated notes: Ceremony was private with close family.');

    // Verify attached document is displayed in the list
    await expect(page.getByText('MarriageBond.pdf')).toBeVisible();

    // Expand details to view supporting meta info
    await page.getByRole('button', { name: 'Details for MarriageBond.pdf', exact: true }).click();
    await expect(page.getByText('Marriage Certificate', { exact: true })).toBeVisible();
    await expect(page.getByText('6 Jan 1759', { exact: true })).toBeVisible();
    await expect(page.getByText('New Kent County, Virginia', { exact: true })).toBeVisible();
    await expect(page.getByText('Virginia Historical Society', { exact: true })).toBeVisible();
    await expect(page.getByText('George Washington & Martha Custis', { exact: true })).toBeVisible();

    // Edit supporting meta info inline
    await page.getByRole('button', { name: 'Edit details for MarriageBond.pdf', exact: true }).click();
    await page.getByLabel('Place', { exact: true }).fill('White House Plantation, VA');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();

    // Verify updated place
    await expect(page.getByText('White House Plantation, VA', { exact: true })).toBeVisible();

    // Click Done to close modal
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // Reload page to verify persistence
    await page.reload();

    // Reopen marriage modal
    await page.getByTestId('union-node-u_george_martha').click();
    await expect(page.getByLabel('Comments')).toHaveValue(
      'Updated notes: Ceremony was private with close family.'
    );
    await page.getByRole('button', { name: 'Details for MarriageBond.pdf', exact: true }).click();
    await expect(page.getByText('White House Plantation, VA', { exact: true })).toBeVisible();

    // View document preview modal
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Document Preview' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('White House Plantation, VA', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close preview' }).click();
  });
});
