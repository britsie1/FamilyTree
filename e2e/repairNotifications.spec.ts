import { test, expect } from '@playwright/test';

test('reports a repair once, not after each node addition or reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('person-card')).toHaveCount(1);

  await page.evaluate(async () => {
    const storePath = '/src/stores/useTreeStore.ts';
    const { useTreeStore } = await import(/* @vite-ignore */ storePath);
    const tree = structuredClone(useTreeStore.getState().tree);
    tree.people[tree.rootPersonId].unionIds.push('missing_union');
    useTreeStore.getState().resetHistory(tree);
  });
  const warning = page.getByText('Data Inconsistencies Repaired', { exact: true });
  await expect(warning).toHaveCount(1);

  await page.evaluate(async () => {
    const storePath = '/src/stores/useTreeStore.ts';
    const { useTreeStore } = await import(/* @vite-ignore */ storePath);
    for (let i = 0; i < 5; i++) useTreeStore.getState().addPerson();
    useTreeStore.getState().undo();
    useTreeStore.getState().redo();
  });
  await expect(warning).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('person-card')).toHaveCount(6);
  await expect(warning).toHaveCount(0);
});