import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { useTreeStore } from '../src/stores/useTreeStore.ts';
import { useCanvasStore } from '../src/stores/useCanvasStore.ts';
import { useTemporalStore } from '../src/stores/useTemporalStore.ts';
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

describe('Centralized Zustand Stores', () => {
  beforeEach(() => {
    // @ts-ignore
    globalThis.localStorage = new MemoryStorage();
    const preset = createDoubleInLawPreset();
    useTreeStore.getState().resetHistory(preset);
    useCanvasStore.getState().clearSelection();
  });

  describe('useTreeStore', () => {
    it('initializes with a valid tree structure', () => {
      const tree = useTreeStore.getState().tree;
      assert.ok(tree);
      assert.ok(tree.people);
      assert.ok(tree.unions);
      assert.strictEqual(useTreeStore.getState().canUndo, false);
      assert.strictEqual(useTreeStore.getState().canRedo, false);
    });

    it('records undo and redo history on mutation', () => {
      const initialName = useTreeStore.getState().tree.name;
      useTreeStore.getState().updateTreeName('Modified Name');

      assert.strictEqual(useTreeStore.getState().tree.name, 'Modified Name');
      assert.strictEqual(useTreeStore.getState().canUndo, true);

      // Undo
      useTreeStore.getState().undo();
      assert.strictEqual(useTreeStore.getState().tree.name, initialName);
      assert.strictEqual(useTreeStore.getState().canRedo, true);

      // Redo
      useTreeStore.getState().redo();
      assert.strictEqual(useTreeStore.getState().tree.name, 'Modified Name');
    });

    it('adds a person and updates canonical tree', () => {
      const initialCount = Object.keys(useTreeStore.getState().tree.people).length;
      const newPerson = useTreeStore.getState().addPerson({
        firstName: 'New',
        lastName: 'Relative',
      });

      assert.ok(newPerson.id);
      const updatedCount = Object.keys(useTreeStore.getState().tree.people).length;
      assert.strictEqual(updatedCount, initialCount + 1);
      assert.strictEqual(useTreeStore.getState().tree.people[newPerson.id]?.firstName, 'New');
    });

    it('creates a copy of the current tree with a new id', () => {
      const original = useTreeStore.getState().tree;
      const copy = useTreeStore.getState().makeCopy();

      assert.notStrictEqual(copy.id, original.id);
      assert.strictEqual(copy.name, `${original.name} (Copy)`);
      assert.strictEqual(useTreeStore.getState().tree.id, copy.id);
    });
  });

  describe('useCanvasStore', () => {
    it('manages zoom and pan transforms', () => {
      const store = useCanvasStore.getState();
      store.setZoom(1.2);
      store.setPan({ x: 100, y: 200 });

      assert.strictEqual(useCanvasStore.getState().zoom, 1.2);
      assert.deepStrictEqual(useCanvasStore.getState().pan, { x: 100, y: 200 });
    });

    it('manages selection and comparison mode', () => {
      const store = useCanvasStore.getState();
      store.selectPerson('person_1');
      assert.strictEqual(useCanvasStore.getState().selectedPersonId, 'person_1');
      assert.strictEqual(useCanvasStore.getState().comparisonPersonId, null);

      store.setComparisonPersonId('person_2');
      assert.strictEqual(useCanvasStore.getState().comparisonPersonId, 'person_2');

      store.swapComparison();
      assert.strictEqual(useCanvasStore.getState().selectedPersonId, 'person_2');
      assert.strictEqual(useCanvasStore.getState().comparisonPersonId, 'person_1');
    });

    it('supports transient drag without mutating tree', () => {
      const canvasStore = useCanvasStore.getState();
      const treeBefore = useTreeStore.getState().tree;

      canvasStore.setTransientDrag('person_1', { x: 45, y: 60 });
      assert.strictEqual(useCanvasStore.getState().draggingPersonId, 'person_1');
      assert.deepStrictEqual(useCanvasStore.getState().dragOffset, { x: 45, y: 60 });

      // Tree must remain unchanged during transient drag
      const treeAfter = useTreeStore.getState().tree;
      assert.strictEqual(treeBefore, treeAfter);

      canvasStore.setTransientDrag(null, null);
      assert.strictEqual(useCanvasStore.getState().draggingPersonId, null);
      assert.strictEqual(useCanvasStore.getState().dragOffset, null);
    });
  });

  describe('useTemporalStore', () => {
    it('manages timeline toggling and year scrub', () => {
      const temporal = useTemporalStore.getState();
      temporal.toggleTimeline(1944);
      assert.strictEqual(useTemporalStore.getState().isTimelineActive, true);
      assert.strictEqual(useTemporalStore.getState().temporalYear, 1944);

      temporal.jumpToYear(1969);
      assert.strictEqual(useTemporalStore.getState().temporalYear, 1969);

      temporal.closeTimeline();
      assert.strictEqual(useTemporalStore.getState().isTimelineActive, false);
    });
  });
});
