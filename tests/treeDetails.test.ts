import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { useTreeStore } from '../src/stores/useTreeStore';
import { useCollabStore } from '../src/stores/useCollabStore';
import { createBlankTree, loadTreeById } from '../src/services/storage';
import { cloudSyncBridge } from '../src/services/cloudSyncBridge';

describe('Tree details', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } });
    useCollabStore.getState().setIsCloudTree(false);
    useCollabStore.getState().setUserPermission('owner');
    cloudSyncBridge.clear();
    useTreeStore.getState().resetHistory(createBlankTree());
  });

  it('saves name and description together and supports undo/redo', () => {
    const original = useTreeStore.getState().tree;
    useTreeStore.getState().updateTreeDetails({ name: '  Our family  ', description: '  Research from three generations.  ' });
    assert.equal(useTreeStore.getState().tree.name, 'Our family');
    assert.equal(loadTreeById(original.id)?.description, 'Research from three generations.');
    useTreeStore.getState().undo();
    assert.equal(useTreeStore.getState().tree.name, original.name);
    assert.equal(useTreeStore.getState().tree.description, original.description);
    useTreeStore.getState().redo();
    assert.equal(useTreeStore.getState().tree.description, 'Research from three generations.');
  });

  it('allows clearing the description but rejects an empty name', () => {
    useTreeStore.getState().updateTreeDetails({ name: 'Family', description: '' });
    assert.equal(useTreeStore.getState().tree.description, '');
    const previous = useTreeStore.getState().tree;
    useTreeStore.getState().updateTreeDetails({ name: ' ', description: 'Not saved' });
    assert.equal(useTreeStore.getState().tree, previous);
  });

  it('blocks view-only edits', () => {
    const previous = useTreeStore.getState().tree;
    useCollabStore.getState().setUserPermission('viewer');
    useTreeStore.getState().updateTreeDetails({ name: 'Forbidden', description: 'Forbidden' });
    assert.equal(useTreeStore.getState().tree, previous);
  });

  it('queues description edits for cloud synchronization', () => {
    const tree = useTreeStore.getState().tree;
    useCollabStore.getState().setIsCloudTree(true);
    useTreeStore.getState().updateTreeDetails({ name: tree.name, description: 'Cloud research' });
    assert.ok(cloudSyncBridge.hasPendingPatches(tree.id));
    cloudSyncBridge.clear();
  });
});