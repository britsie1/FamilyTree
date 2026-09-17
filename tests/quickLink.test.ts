import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { useTreeStore } from '../src/stores/useTreeStore.ts';
import { useCanvasStore } from '../src/stores/useCanvasStore.ts';
import { createBlankTree } from '../src/services/storage.ts';

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

describe('Interactive Authoring: Quick Link & Quick Spawn', () => {
  beforeEach(() => {
    // @ts-ignore
    globalThis.localStorage = new MemoryStorage();
    const blank = createBlankTree();
    useTreeStore.getState().resetHistory(blank);
    useCanvasStore.getState().clearSelection();
  });

  describe('Quick Link Existing Individuals', () => {
    it('links target as a child of source without modal interruptions', () => {
      const store = useTreeStore.getState();
      const parent = store.addPerson({ firstName: 'Parent', lastName: 'Test' });
      const child = store.addPerson({ firstName: 'Child', lastName: 'Test' });

      // Action: Drag child cable from parent to child
      store.linkChild(parent.id, child.id);

      const updated = useTreeStore.getState().tree;
      const updatedChild = updated.people[child.id];
      assert.ok(updatedChild.parentUnionId, 'Child must have a parent union');
      const parentUnion = updated.unions[updatedChild.parentUnionId];
      assert.ok(parentUnion, 'Parent union must exist in tree');
      assert.ok(parentUnion.partnerIds.includes(parent.id), 'Parent union must contain source parent');
      assert.ok(parentUnion.childrenIds.includes(child.id), 'Parent union must contain target child');
    });

    it('links target as a parent of source', () => {
      const store = useTreeStore.getState();
      const child = store.addPerson({ firstName: 'Child', lastName: 'Test' });
      const parent = store.addPerson({ firstName: 'Parent', lastName: 'Test' });

      // Action: Drag parent cable from child to parent
      store.linkParent(child.id, parent.id);

      const updated = useTreeStore.getState().tree;
      const updatedChild = updated.people[child.id];
      assert.ok(updatedChild.parentUnionId, 'Child must have parent union');
      const parentUnion = updated.unions[updatedChild.parentUnionId];
      assert.ok(parentUnion.partnerIds.includes(parent.id), 'Parent must be in parent union');
      assert.ok(parentUnion.childrenIds.includes(child.id), 'Child must be in parent union');
    });

    it('links target as spouse/partner of source', () => {
      const store = useTreeStore.getState();
      const personA = store.addPerson({ firstName: 'PartnerA', lastName: 'Test' });
      const personB = store.addPerson({ firstName: 'PartnerB', lastName: 'Test' });

      // Action: Drag partner cable from A to B
      store.linkPartner(personA.id, personB.id);

      const updated = useTreeStore.getState().tree;
      const updatedA = updated.people[personA.id];
      const updatedB = updated.people[personB.id];
      const sharedUnionId = updatedA.unionIds.find((uId) => updatedB.unionIds.includes(uId));
      assert.ok(sharedUnionId, 'Both partners must share a union');
      const union = updated.unions[sharedUnionId];
      assert.ok(union.partnerIds.includes(personA.id));
      assert.ok(union.partnerIds.includes(personB.id));
    });

    it('links target as sibling of source', () => {
      const store = useTreeStore.getState();
      const siblingA = store.addPerson({ firstName: 'SibA', lastName: 'Test' });
      const siblingB = store.addPerson({ firstName: 'SibB', lastName: 'Test' });

      // Action: Drag sibling cable from A to B
      store.linkSibling(siblingA.id, siblingB.id);

      const updated = useTreeStore.getState().tree;
      const updatedA = updated.people[siblingA.id];
      const updatedB = updated.people[siblingB.id];
      assert.ok(updatedA.parentUnionId, 'SibA must have a parent union');
      assert.strictEqual(updatedA.parentUnionId, updatedB.parentUnionId, 'Both siblings must share parent union');
    });
  });

  describe('Quick Spawn Relatives on Canvas Drop', () => {
    it('spawns and positions a new child at drop world coordinates', () => {
      const store = useTreeStore.getState();
      const parent = store.addPerson({ firstName: 'Parent', lastName: 'Test' });

      // Drop on empty canvas at (500, 350)
      const newChildId = store.addChild(parent.id);
      assert.ok(newChildId);
      store.updatePersonPosition(newChildId, 500, 350, 'vertical');

      const updated = useTreeStore.getState().tree;
      const child = updated.people[newChildId];
      assert.ok(child);
      assert.strictEqual(updated.layoutOverrides?.[newChildId]?.x, 500);
      assert.strictEqual(updated.layoutOverrides?.[newChildId]?.y, 350);
      assert.strictEqual((child as any).x, undefined);
      assert.strictEqual((child as any).y, undefined);

      // Verify connected to parent
      const parentUnion = updated.unions[child.parentUnionId!];
      assert.ok(parentUnion.partnerIds.includes(parent.id));
      assert.ok(parentUnion.childrenIds.includes(newChildId));
    });

    it('spawns and positions a new partner at drop world coordinates', () => {
      const store = useTreeStore.getState();
      const person = store.addPerson({ firstName: 'Alex', lastName: 'Test' });

      const newPartnerId = store.addPartner(person.id);
      assert.ok(newPartnerId);
      store.updatePersonPosition(newPartnerId, 700, 200, 'vertical');

      const updated = useTreeStore.getState().tree;
      const partner = updated.people[newPartnerId];
      assert.strictEqual(updated.layoutOverrides?.[newPartnerId]?.x, 700);
      assert.strictEqual(updated.layoutOverrides?.[newPartnerId]?.y, 200);
      assert.strictEqual((partner as any).x, undefined);
      assert.strictEqual((partner as any).y, undefined);

      const sharedUnion = Object.values(updated.unions).find(
        (u) => u.partnerIds.includes(person.id) && u.partnerIds.includes(newPartnerId)
      );
      assert.ok(sharedUnion);
    });
  });

  describe('Canvas Store: MiniMap Controls', () => {
    it('initializes with MiniMap open and toggles state cleanly', () => {
      const canvasStore = useCanvasStore.getState();
      assert.strictEqual(canvasStore.isMiniMapOpen, true);

      canvasStore.toggleMiniMap();
      assert.strictEqual(useCanvasStore.getState().isMiniMapOpen, false);

      canvasStore.toggleMiniMap();
      assert.strictEqual(useCanvasStore.getState().isMiniMapOpen, true);

      canvasStore.setIsMiniMapOpen(false);
      assert.strictEqual(useCanvasStore.getState().isMiniMapOpen, false);
    });
  });
});
