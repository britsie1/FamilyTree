import { test, expect } from '@playwright/test';
import { createBlankTree, STORAGE_KEY } from '../src/services/storage';

for (const relation of ['parent', 'sibling'] as const) {
  test(`${relation} remains on the canvas after creation and later edits`, async ({ page }) => {
    const tree = createBlankTree();
    await page.addInitScript(({ key, data }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    }, { key: STORAGE_KEY, data: tree });
    await page.goto('/');
    const root = page.locator(`[data-person-id="${tree.rootPersonId}"]`);
    await expect(root).toBeVisible();
    await root.click();
    const inspector = page.getByRole('region', { name: 'Person Inspector' });
    await inspector.getByText(relation === 'parent' ? 'Parents' : 'Siblings', { exact: true }).locator('..').getByRole('button', { name: 'Add / Link' }).click();
    await page.getByRole('button', { name: 'Add New', exact: true }).click();
    await expect(page.getByTestId('person-card')).toHaveCount(relation === 'parent' ? 2 : 3);
    await page.getByPlaceholder('Optional', { exact: true }).first().fill('Created Relative');
    await expect(page.getByTestId('person-card').filter({ hasText: 'Created Relative' })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('person-card')).toHaveCount(relation === 'parent' ? 2 : 3);
    await expect(page.getByTestId('person-card').filter({ hasText: 'Created Relative' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('person-card')).toHaveCount(relation === 'parent' ? 2 : 3);
    await expect(page.getByTestId('person-card').filter({ hasText: 'Created Relative' })).toBeVisible();
  });
}

test('new relatives remain rendered after cloud write acknowledgments and subsequent snapshots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('person-card').first()).toBeVisible();
  const result = await page.evaluate(async () => {
    const storePath = '/src/stores/useTreeStore.ts';
    const collabPath = '/src/stores/useCollabStore.ts';
    const snapshotsPath = '/src/services/cloudTreeSnapshots.ts';
    const storagePath = '/src/services/storage.ts';
    const bridgePath = '/src/services/cloudSyncBridge.ts';
    const outboxPath = '/src/services/syncOutbox.ts';
    const { useTreeStore } = await import(/* @vite-ignore */ storePath);
    const { useCollabStore } = await import(/* @vite-ignore */ collabPath);
    const { CloudCollectionSnapshots } = await import(/* @vite-ignore */ snapshotsPath);
    const { createBlankTree } = await import(/* @vite-ignore */ storagePath);
    const { CloudSyncBridge } = await import(/* @vite-ignore */ bridgePath);
    const { applyPendingOperations, readSyncOutbox } = await import(/* @vite-ignore */ outboxPath);
    let server = createBlankTree();
    server.storageMode = 'subcollections';
    useTreeStore.getState().resetHistory(server);
    const cache = new CloudCollectionSnapshots();
    const docs = (records: Record<string, any>) => Object.entries(records).map(([id, record]) => ({ id, data: () => record }));
    cache.acceptPeople(docs(server.people), false);
    cache.acceptUnions(docs(server.unions), false);
    const parentId = useTreeStore.getState().addParent(server.rootPersonId);
    const siblingId = useTreeStore.getState().addSibling(server.rootPersonId);
    const local = useTreeStore.getState().tree;
    const collab = useCollabStore.getState();
    collab.setIsCloudTree(true);
    collab.setUserPermission('owner');
    collab.setCloudLoading(false);
    const apply = (kind: string, id: string, updates: object, options: any) => {
      server = applyPendingOperations(server, [{ treeId: server.id, kind, recordId: id, updates, removedFields: options?.removedFields || [], isDelete: false }]);
      cache.acceptPeople(docs(server.people), true);
      cache.acceptUnions(docs(server.unions), true);
      cache.acceptPeople(docs(server.people), false);
      cache.acceptUnions(docs(server.unions), false);
      // Deliver the remote snapshot after the transport ACK, as a listener can do.
      return { version: 2 };
    };
    const bridge = new CloudSyncBridge(() => localStorage, {
      person: async (_tree: string, id: string, updates: object, opts: any) => apply('person', id, updates, opts),
      union: async (_tree: string, id: string, updates: object, opts: any) => apply('union', id, updates, opts),
      deletePerson: async () => {}, deleteUnion: async () => {}, metadata: async () => ({ version: 2 }),
    });
    bridge.setActiveTree(server.id);
    bridge.queueBatchDiff(server.id, server, local);
    await bridge.flushAll();
    const remote = { ...server, people: cache.people, unions: cache.unions };
    useTreeStore.getState().setTree(bridge.reconcile(remote), false);
    useTreeStore.getState().setTree(bridge.reconcile(remote), false);
    const pending = readSyncOutbox(server.id).operations.length;
    bridge.dispose();
    return { parentId, siblingId, pending };
  });
  expect(result.pending).toBe(0);
  await expect(page.getByTestId('person-card')).toHaveCount(3);
  await expect(page.locator(`[data-person-id="${result.parentId}"]`)).toBeAttached();
  await expect(page.locator(`[data-person-id="${result.siblingId}"]`)).toBeAttached();
});