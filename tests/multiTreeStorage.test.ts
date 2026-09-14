import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  listStoredTrees,
  loadTreeById,
  deleteStoredTree,
  duplicateTree,
  createAndSaveNewTree,
  loadCurrentTree,
  STORAGE_KEY,
} from '../src/services/storage.ts';
import { createDoubleInLawPreset } from '../src/services/storage.ts';

// In-memory mock for localStorage in node test environment
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('Multi-Tree Storage and Migration', () => {
  beforeEach(() => {
    // @ts-ignore
    globalThis.localStorage = new MemoryStorage();
  });

  it('automatically migrates legacy single-tree storage to multi-tree store', () => {
    const legacy = createDoubleInLawPreset();
    legacy.name = 'Legacy Family Tree';
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadCurrentTree();
    assert.strictEqual(loaded.name, 'Legacy Family Tree');

    const list = listStoredTrees();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, legacy.id);
    assert.strictEqual(list[0].name, 'Legacy Family Tree');
  });

  it('supports creating, saving, and listing multiple distinct trees', () => {
    const tree1 = createAndSaveNewTree('Tree One');
    const tree2 = createAndSaveNewTree('Tree Two');

    const list = listStoredTrees();
    assert.strictEqual(list.length, 2);

    const loaded1 = loadTreeById(tree1.id);
    const loaded2 = loadTreeById(tree2.id);
    assert.ok(loaded1);
    assert.ok(loaded2);
    assert.strictEqual(loaded1.name, 'Tree One');
    assert.strictEqual(loaded2.name, 'Tree Two');
  });

  it('supports duplicating an existing tree', () => {
    const original = createAndSaveNewTree('Original Tree');
    const copy = duplicateTree(original.id);

    assert.ok(copy);
    assert.notStrictEqual(copy.id, original.id);
    assert.strictEqual(copy.name, 'Original Tree (Copy)');

    const list = listStoredTrees();
    assert.strictEqual(list.length, 2);
  });

  it('deletes a tree and updates the active tree safely', () => {
    const tree1 = createAndSaveNewTree('To Keep');
    const tree2 = createAndSaveNewTree('To Delete');

    const res = deleteStoredTree(tree2.id);
    assert.strictEqual(res.remaining.length, 1);
    assert.strictEqual(res.remaining[0].name, 'To Keep');
    assert.strictEqual(res.newActiveTree.id, tree1.id);

    const loadedDeleted = loadTreeById(tree2.id);
    assert.strictEqual(loadedDeleted, null);
  });
});
