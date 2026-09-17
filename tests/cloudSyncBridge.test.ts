import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncBridge } from '../src/services/cloudSyncBridge';
import { useCollabStore } from '../src/stores/useCollabStore';

describe('CloudSyncBridge Granular Synchronizer', () => {
  let bridge: CloudSyncBridge;

  beforeEach(() => {
    bridge = new CloudSyncBridge();
    useCollabStore.getState().resetCollab();
  });

  afterEach(() => {
    bridge.clear();
  });

  it('tracks base version for optimistic concurrency control', () => {
    assert.equal(bridge.getBaseVersion(), undefined);
    bridge.setBaseVersion(42);
    assert.equal(bridge.getBaseVersion(), 42);
  });

  it('queues a person patch and coalesces rapid updates to the same person', () => {
    assert.equal(bridge.hasPendingPatches(), false);
    assert.equal(bridge.getPendingCount(), 0);

    // First edit: notes
    bridge.queuePersonPatch('tree_test', 'p1', { notes: 'Note 1' });
    assert.equal(bridge.hasPendingPatches(), true);
    assert.equal(bridge.getPendingCount(), 1);
    assert.equal(useCollabStore.getState().cloudSyncStatus, 'saving');

    // Second rapid edit: birthDate on the same person
    bridge.queuePersonPatch('tree_test', 'p1', { birthDate: '1970-01-01' });
    // Still 1 coalesced pending person patch
    assert.equal(bridge.getPendingCount(), 1);

    // Edit on a different person
    bridge.queuePersonPatch('tree_test', 'p2', { firstName: 'Bob' });
    assert.equal(bridge.getPendingCount(), 2);
  });

  it('queues a union patch and coalesces rapid updates to the same union', () => {
    bridge.queueUnionPatch('tree_test', 'u1', { type: 'married' });
    assert.equal(bridge.hasPendingPatches(), true);
    assert.equal(bridge.getPendingCount(), 1);
    assert.equal(useCollabStore.getState().cloudSyncStatus, 'saving');

    bridge.queueUnionPatch('tree_test', 'u1', { marriageDate: '2000-06-15' });
    assert.equal(bridge.getPendingCount(), 1);
  });

  it('clear() cancels all pending debounce timers and clears queues', () => {
    bridge.queuePersonPatch('tree_test', 'p1', { notes: 'Draft note' });
    bridge.queueUnionPatch('tree_test', 'u1', { type: 'separated' });
    assert.equal(bridge.getPendingCount(), 2);

    bridge.clear();
    assert.equal(bridge.getPendingCount(), 0);
    assert.equal(bridge.hasPendingPatches(), false);
  });

  it('sets cloudSyncStatus to error or offline when network transmission fails without firebase config', async () => {
    bridge.queuePersonPatch('tree_test', 'p1', { notes: 'Test note' });
    // Send immediately
    const success = await bridge.sendPersonPatch('tree_test:person:p1');

    assert.equal(success, false);
    const status = useCollabStore.getState().cloudSyncStatus;
    assert.ok(status === 'error' || status === 'offline');
    assert.ok(useCollabStore.getState().cloudSyncError);
  });
});
