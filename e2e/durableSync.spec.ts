import { test, expect } from '@playwright/test';

test('offline edits and deletions survive page reload and replay into a second working copy', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForSelector('main');
  // Load the modules before going offline; no service worker is required.
  await page.evaluate(async () => {
    const bridgePath = '/src/services/cloudSyncBridge.ts';
    const storagePath = '/tests/fixtures/exampleTrees.ts';
    const { CloudSyncBridge } = await import(/* @vite-ignore */ bridgePath);
    const { createDoubleInLawPreset } = await import(/* @vite-ignore */ storagePath);
    const base = createDoubleInLawPreset();
    base.id = 'browser_sync_test';
    localStorage.setItem('browser_sync_base', JSON.stringify(base));
    const bridge = new CloudSyncBridge();
    (window as unknown as Record<string, unknown>).testBridge = bridge;
  });
  await context.setOffline(true);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('browser_sync_base')!);
    const local = structuredClone(base);
    local.people.dad.notes = 'Browser offline research';
    delete local.people.uncle;
    local.unions.u_aunt_uncle.partnerIds = ['aunt'];
    local.name = 'Browser offline title';
    const bridge = (window as unknown as Record<string, any>).testBridge;
    bridge.queueBatchDiff(base.id, base, local);
    bridge.dispose();
  });
  await context.setOffline(false);
  await page.reload();
  await page.waitForSelector('main');
  const result = await page.evaluate(async () => {
    const bridgePath = '/src/services/cloudSyncBridge.ts';
    const outboxPath = '/src/services/syncOutbox.ts';
    const collabPath = '/src/stores/useCollabStore.ts';
    const { CloudSyncBridge } = await import(/* @vite-ignore */ bridgePath);
    const { readSyncOutbox, applyPendingOperations } = await import(/* @vite-ignore */ outboxPath);
    const { useCollabStore } = await import(/* @vite-ignore */ collabPath);
    let server = JSON.parse(localStorage.getItem('browser_sync_base')!);
    server.people.mom.notes = 'Another device edited this';
    const sent: string[] = [];
    const apply = (kind: string, id: string, updates: object, options: any, isDelete = false) => {
      sent.push(`${kind}:${id}`);
      server = applyPendingOperations(server, [{
        treeId: server.id, key: 'test', kind, recordId: id, updates,
        removedFields: options?.removedFields || [], isDelete,
      }]);
    };
    const bridge = new CloudSyncBridge(() => localStorage, {
      person: async (_tree: string, id: string, updates: object, opts: any) => {
        apply('person', id, updates, opts); return { version: 2 };
      },
      union: async (_tree: string, id: string, updates: object, opts: any) => {
        apply('union', id, updates, opts); return { version: 2 };
      },
      deletePerson: async (_tree: string, id: string, opts: any) => { apply('person', id, {}, opts, true); },
      deleteUnion: async (_tree: string, id: string, opts: any) => { apply('union', id, {}, opts, true); },
      metadata: async (_tree: string, updates: object, removedFields: string[]) => {
        apply('metadata', 'root', updates, { removedFields }); return { version: 2 };
      },
    });
    useCollabStore.getState().setIsCloudTree(true);
    useCollabStore.getState().setUserPermission('owner');
    useCollabStore.getState().setCloudLoading(false);
    bridge.setActiveTree(server.id);
    const recovered = bridge.reconcile(server);
    const countBefore = bridge.getPendingCount();
    await bridge.flushAll();
    const pending = readSyncOutbox(server.id)!.operations.length;
    bridge.dispose();
    return { recovered, server, pending, sent, countBefore };
  });
  expect(result.countBefore).toBeGreaterThan(0);
  expect(result.recovered.people.dad.notes).toBe('Browser offline research');
  expect(result.server.people.dad.notes).toBe('Browser offline research');
  expect(result.server.people.mom.notes).toBe('Another device edited this');
  expect(result.server.people.uncle).toBeUndefined();
  expect(result.server.unions.u_aunt_uncle.partnerIds).toEqual(['aunt']);
  expect(result.server.name).toBe('Browser offline title');
  expect(result.pending).toBe(0);
});

test('storage quota failures show a persistent warning instead of successful autosave', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('main');
  await page.evaluate(async () => {
    const storePath = '/src/stores/useTreeStore.ts';
    const { useTreeStore } = await import(/* @vite-ignore */ storePath);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    try { useTreeStore.getState().updateTreeName('Unsaved work'); }
    finally { Storage.prototype.setItem = original; }
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Your changes are not safely saved' })).toBeVisible();
  await expect(page.getByText('Keep this tab open and export a JSON backup.', { exact: false })).toBeVisible();
});