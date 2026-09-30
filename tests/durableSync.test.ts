import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncBridge, type SyncTransport } from '../src/services/cloudSyncBridge';
import { readSyncOutbox, SYNC_OUTBOX_PREFIX, applyPendingOperations } from '../src/services/syncOutbox';
import { useCollabStore } from '../src/stores/useCollabStore';
import { useNotificationStore } from '../src/stores/useNotificationStore';
import { saveCurrentTree, loadTreeById } from '../src/services/storage.ts';
import { createDoubleInLawPreset } from './fixtures/exampleTrees.ts';
import { cleanForFirestore } from '../src/services/firestoreService';
import { deleteField } from 'firebase/firestore';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  fail = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Storage quota exceeded');
    this.values.set(key, value);
  }
}

describe('Durable cloud sync', () => {
  let storage: MemoryStorage;
  const bridges: CloudSyncBridge[] = [];
  const transport: SyncTransport = {
    person: async () => ({ version: 2 }), union: async () => ({ version: 2 }),
    deletePerson: async () => {}, deleteUnion: async () => {}, metadata: async () => ({ version: 2 }),
  };
  const makeBridge = (custom: SyncTransport = transport) => {
    const bridge = new CloudSyncBridge(() => storage, custom);
    bridges.push(bridge);
    return bridge;
  };
  beforeEach(() => {
    storage = new MemoryStorage();
    useCollabStore.getState().resetCollab();
    useCollabStore.getState().setLocalSaveError(null);
    useNotificationStore.getState().clearNotifications();
  });
  afterEach(() => { for (const bridge of bridges.splice(0)) bridge.dispose(); });

  it('atomically saves edits, deletions, relationship cleanup and root metadata, then recovers after reload', async () => {
    const base = createDoubleInLawPreset();
    const local = structuredClone(base);
    local.people.dad.notes = 'Offline research';
    delete local.people.uncle;
    local.unions.u_aunt_uncle.partnerIds = ['aunt'];
    local.name = 'Offline family';
    local.layoutOverrides = { dad: { x: 42, y: 73 } };
    const first = makeBridge();
    assert.equal(first.queueBatchDiff(base.id, base, local), true);
    const saved = readSyncOutbox(base.id, storage)!;
    assert.deepEqual(saved.tree, local);
    assert.ok(saved.operations.some((op) => op.recordId === 'uncle' && op.isDelete));
    assert.ok(saved.operations.some((op) => op.kind === 'metadata'));
    first.dispose();

    const remote = structuredClone(base);
    remote.people.dad.birthPlace = 'Remote correction';
    remote.people.mom.notes = 'Another collaborator';
    const second = makeBridge();
    const recovered = second.reconcile(remote);
    assert.equal(recovered.people.dad.notes, 'Offline research');
    assert.equal(recovered.people.dad.birthPlace, 'Remote correction');
    assert.equal(recovered.people.mom.notes, 'Another collaborator');
    assert.equal(recovered.people.uncle, undefined);
    assert.deepEqual(recovered.unions.u_aunt_uncle.partnerIds, ['aunt']);
    assert.equal(recovered.name, 'Offline family');
    assert.deepEqual(recovered.layoutOverrides, local.layoutOverrides);
    await second.flushAll();
    assert.equal(second.getPendingCount(), 0);
    assert.equal(readSyncOutbox(base.id, storage)!.operations.length, 0);
    assert.equal(useCollabStore.getState().cloudSyncStatus, 'synced');
  });

  it('keeps work after upload failures and retries with the original timestamp', async () => {
    let fail = true;
    const timestamps: (string | undefined)[] = [];
    const bridge = makeBridge({ ...transport, person: async (_tree, _id, _updates, opts) => {
      timestamps.push(opts?.timestamp);
      if (fail) throw new Error('offline');
      return { version: 2 };
    } });
    bridge.queuePersonPatch('tree', 'p', { notes: 'Research' });
    await bridge.flushAll();
    assert.equal(readSyncOutbox('tree', storage)!.operations.length, 1);
    assert.equal(useCollabStore.getState().cloudSyncStatus, 'offline');
    fail = false;
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 0);
    assert.equal(timestamps[0], timestamps[1]);
  });

  it('does not acknowledge a newer edit when an older request completes', async () => {
    let release!: () => void;
    let started!: () => void;
    const start = new Promise<void>((resolve) => { started = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const bridge = makeBridge({ ...transport, person: async () => {
      if (++calls === 1) { started(); await hold; }
      return { version: calls + 1 };
    } });
    bridge.queuePersonPatch('tree', 'p', { notes: 'First' });
    const upload = bridge.flushAll();
    await start;
    bridge.queuePersonPatch('tree', 'p', { notes: 'Second' });
    release();
    await upload;
    assert.equal(bridge.getPendingCount(), 1);
    assert.equal(readSyncOutbox('tree', storage)!.operations[0].updates.notes, 'Second');
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 0);
  });

  it('serializes uploads and uses the acknowledged version for the next operation', async () => {
    const versions: (number | undefined)[] = [];
    let active = 0;
    const bridge = makeBridge({ ...transport, person: async (_tree, _id, _updates, opts) => {
      active++;
      assert.equal(active, 1);
      versions.push(opts?.baseVersion);
      await Promise.resolve();
      active--;
      return { version: (opts?.baseVersion || 1) + 1 };
    } });
    bridge.setBaseVersion(1);
    bridge.queuePersonPatch('tree', 'a', { notes: 'A' });
    bridge.queuePersonPatch('tree', 'b', { notes: 'B' });
    await Promise.all([bridge.flushAll(), bridge.flushAll()]);
    assert.deepEqual(versions, [1, 2]);
  });

  it('preserves explicit field removals across JSON persistence and reload', async () => {
    const bridge = makeBridge();
    bridge.queuePersonPatch('tree', 'p', { parentUnionId: undefined, notes: 'New' });
    bridge.dispose();
    const second = makeBridge({ ...transport, person: async (_tree, _id, _updates, opts) => {
      assert.deepEqual(opts?.removedFields, ['parentUnionId']);
      return { version: 2 };
    } });
    second.restore('tree');
    const tree = { ...createDoubleInLawPreset(), id: 'tree' };
    tree.people.p = { id: 'p', unionIds: [], parentUnionId: 'old' };
    const recovered = second.reconcile(tree);
    assert.equal(recovered.people.p.parentUnionId, undefined);
    await second.flushAll();
  });

  it('retains deletions and metadata when storage writes fail and refuses to upload unsaved work', async () => {
    let uploaded = false;
    const bridge = makeBridge({ ...transport, person: async () => {
      uploaded = true; return { version: 2 };
    } });
    storage.fail = true;
    bridge.queuePersonPatch('tree', 'p', { notes: 'Do not lose' });
    await bridge.flushAll();
    assert.equal(uploaded, false);
    assert.equal(bridge.getPendingCount(), 1);
    assert.match(useCollabStore.getState().localSaveError!, /export a JSON backup/);
    assert.equal(useNotificationStore.getState().notifications.length, 1);
    storage.fail = false;
    await bridge.flushAll();
    assert.equal(uploaded, true);
    assert.equal(useCollabStore.getState().localSaveError, null);
  });

  it('blocks replay until loading completes and never uploads as a viewer', async () => {
    const bridge = makeBridge();
    bridge.setActiveTree('tree');
    bridge.queuePersonDelete('tree', 'p');
    useCollabStore.getState().setIsCloudTree(true);
    useCollabStore.getState().setCloudLoading(true);
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 1);
    useCollabStore.getState().setCloudLoading(false);
    useCollabStore.getState().setUserPermission('viewer');
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 1);
    useCollabStore.getState().setUserPermission('editor');
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 0);
  });

  it('replays only the requested tree and adopts the remote storage mode', async () => {
    const bridge = makeBridge({ ...transport, person: async (treeId, _id, _updates, opts) => {
      assert.equal(treeId, 'a'); assert.equal(opts?.isSubcollection, true);
      return { version: 2 };
    } });
    bridge.queuePersonPatch('a', 'p', { notes: 'A' });
    bridge.queuePersonPatch('b', 'p', { notes: 'B' });
    bridge.reconcile({ ...createDoubleInLawPreset(), id: 'a', storageMode: 'subcollections' });
    await bridge.flushAll('a');
    assert.equal(bridge.getPendingCount('a'), 0);
    assert.equal(bridge.getPendingCount('b'), 1);
  });

  it('reports local tree save failures, and loads the authoritative pending working copy', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    try {
      const base = createDoubleInLawPreset();
      assert.equal(saveCurrentTree(base), true);
      const local = structuredClone(base);
      local.name = 'Pending title';
      makeBridge().queueBatchDiff(base.id, base, local);
      assert.equal(loadTreeById(base.id)!.name, 'Pending title');
      storage.fail = true;
      assert.equal(saveCurrentTree(base), false);
      assert.ok(useCollabStore.getState().localSaveError);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('rejects corrupt outboxes without destroying the saved contents', () => {
    storage.setItem(SYNC_OUTBOX_PREFIX + 'tree', '{broken');
    assert.throws(() => makeBridge().restore('tree'));
    assert.equal(storage.getItem(SYNC_OUTBOX_PREFIX + 'tree'), '{broken');
  });

  it('keeps the operation pending when persisting its acknowledgment fails', async () => {
    const bridge = makeBridge({ ...transport, person: async () => {
      storage.fail = true;
      return { version: 2 };
    } });
    bridge.queuePersonPatch('tree', 'p', { notes: 'Research' });
    await bridge.flushAll();
    assert.equal(bridge.getPendingCount(), 1);
    assert.equal(readSyncOutbox('tree', storage)!.operations.length, 1);
    assert.notEqual(useCollabStore.getState().cloudSyncStatus, 'synced');
  });

  it('undoes an offline deletion without leaving a pending tombstone', () => {
    const base = createDoubleInLawPreset();
    const deleted = structuredClone(base);
    delete deleted.people.uncle;
    const bridge = makeBridge();
    bridge.queueBatchDiff(base.id, base, deleted);
    bridge.queueBatchDiff(base.id, deleted, base);
    const op = readSyncOutbox(base.id, storage)!.operations.find((item) => item.recordId === 'uncle')!;
    assert.equal(op.isDelete, false);
    assert.equal(op.updates.firstName, base.people.uncle.firstName);
    bridge.dispose();
    const remote = structuredClone(base);
    delete remote.people.uncle;
    assert.deepEqual(makeBridge().reconcile(remote).people.uncle, { ...base.people.uncle, deleted: false });
  });

  it('preserves Firestore delete sentinels through cleaning', () => {
    const sentinel = deleteField();
    assert.equal(cleanForFirestore({ removed: sentinel }).removed, sentinel);
  });

  it('does not allow pending metadata to replace remote ownership or sharing', () => {
    const bridge = makeBridge();
    const base = createDoubleInLawPreset();
    const next = { ...base, name: 'New title' };
    bridge.queueBatchDiff(base.id, base, next);
    const remote = { ...base, ownerId: 'owner', isPublic: false };
    const recovered = applyPendingOperations(remote, readSyncOutbox(base.id, storage)!.operations);
    assert.equal((recovered as typeof remote).ownerId, 'owner');
    assert.equal((recovered as typeof remote).isPublic, false);
  });
});