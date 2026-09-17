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

    it('captures delta patches in pastPatches and futurePatches rather than full tree clones', () => {
      const initialName = useTreeStore.getState().tree.name;
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 0);
      assert.strictEqual(useTreeStore.getState().futurePatches.length, 0);

      useTreeStore.getState().updateTreeName('Patched Name');

      const pastPatches = useTreeStore.getState().pastPatches;
      assert.strictEqual(pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().futurePatches.length, 0);

      // Verify the patch contains only the delta, not the full tree
      const firstStepPatches = pastPatches[0];
      assert.ok(Array.isArray(firstStepPatches));
      assert.ok(firstStepPatches.length > 0);
      assert.strictEqual(firstStepPatches[0].op, 'replace');
      assert.deepStrictEqual(firstStepPatches[0].path, ['name']);
      assert.strictEqual(firstStepPatches[0].value, 'Patched Name');

      // Undo
      useTreeStore.getState().undo();
      assert.strictEqual(useTreeStore.getState().tree.name, initialName);
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 0);
      assert.strictEqual(useTreeStore.getState().futurePatches.length, 1);

      // Redo
      useTreeStore.getState().redo();
      assert.strictEqual(useTreeStore.getState().tree.name, 'Patched Name');
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().futurePatches.length, 0);
    });

    it('scales memory with delta O(depth * delta) instead of tree size O(depth * |Tree|)', () => {
      const largeTree = createDoubleInLawPreset();
      for (let i = 0; i < 100; i++) {
        const id = `extra_person_${i}`;
        largeTree.people[id] = {
          id,
          firstName: `Person_${i}`,
          lastName: 'ScaleTest',
          unionIds: [],
          notes: 'Detailed notes creating memory footprint in the tree snapshot',
        };
      }
      useTreeStore.getState().resetHistory(largeTree);
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 0);

      const totalTreeJsonLength = JSON.stringify(useTreeStore.getState().tree).length;

      // Perform 50 small mutations on distinct entities
      for (let i = 0; i < 50; i++) {
        useTreeStore.getState().updatePerson(`extra_person_${i}`, {
          firstName: `Updated_${i}`,
        });
      }

      const pastPatches = useTreeStore.getState().pastPatches;
      assert.strictEqual(pastPatches.length, 50);

      const totalPatchHistoryJsonLength = JSON.stringify(pastPatches).length;
      const fullSnapshotHistorySize = 50 * totalTreeJsonLength;

      // Patch history size should be a tiny fraction (< 5%) of full snapshot history
      const ratio = totalPatchHistoryJsonLength / fullSnapshotHistorySize;
      assert.ok(
        ratio < 0.05,
        `Patch history (${totalPatchHistoryJsonLength}b) should be < 5% of full clones (${fullSnapshotHistorySize}b), got ${(ratio * 100).toFixed(2)}%`
      );

      // Undo all 50 steps
      for (let i = 0; i < 50; i++) {
        useTreeStore.getState().undo();
      }
      assert.strictEqual(useTreeStore.getState().canUndo, false);
      assert.strictEqual(useTreeStore.getState().canRedo, true);
      assert.strictEqual(useTreeStore.getState().tree.people['extra_person_0']?.firstName, 'Person_0');
      assert.strictEqual(useTreeStore.getState().tree.people['extra_person_49']?.firstName, 'Person_49');

      // Redo all 50 steps
      for (let i = 0; i < 50; i++) {
        useTreeStore.getState().redo();
      }
      assert.strictEqual(useTreeStore.getState().canUndo, true);
      assert.strictEqual(useTreeStore.getState().canRedo, false);
      assert.strictEqual(useTreeStore.getState().tree.people['extra_person_0']?.firstName, 'Updated_0');
      assert.strictEqual(useTreeStore.getState().tree.people['extra_person_49']?.firstName, 'Updated_49');
    });

    it('groups rapid consecutive keystrokes into a single undo step', () => {
      const personId = Object.keys(useTreeStore.getState().tree.people)[0];
      const initialFirstName = useTreeStore.getState().tree.people[personId].firstName;

      // Simulate typing keystrokes in an input field
      useTreeStore.getState().updatePerson(personId, { firstName: 'J' });
      useTreeStore.getState().updatePerson(personId, { firstName: 'Jo' });
      useTreeStore.getState().updatePerson(personId, { firstName: 'Joh' });
      useTreeStore.getState().updatePerson(personId, { firstName: 'John' });

      // Should be debounced/squashed into 1 single history entry
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, 'John');

      // Undo once should restore all the way back to initialFirstName
      useTreeStore.getState().undo();
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, initialFirstName);
      assert.strictEqual(useTreeStore.getState().canUndo, false);
      assert.strictEqual(useTreeStore.getState().canRedo, true);

      // Redo should restore to the final typed state
      useTreeStore.getState().redo();
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, 'John');
    });

    it('groups rapid position dragging updates on the same person into a single undo step', () => {
      const personId = Object.keys(useTreeStore.getState().tree.people)[0];
      const initialX = useTreeStore.getState().tree.people[personId].x;
      const initialY = useTreeStore.getState().tree.people[personId].y;

      // Drag sequence
      useTreeStore.getState().updatePersonPosition(personId, 100, 150, 'vertical');
      useTreeStore.getState().updatePersonPosition(personId, 120, 160, 'vertical');
      useTreeStore.getState().updatePersonPosition(personId, 150, 200, 'vertical');

      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].x, 150);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].y, 200);

      useTreeStore.getState().undo();
      assert.strictEqual(useTreeStore.getState().tree.people[personId].x, initialX);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].y, initialY);

      useTreeStore.getState().redo();
      assert.strictEqual(useTreeStore.getState().tree.people[personId].x, 150);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].y, 200);
    });

    it('supports transaction batching via beginTransaction and commitTransaction', () => {
      const initialName = useTreeStore.getState().tree.name;
      const personId = Object.keys(useTreeStore.getState().tree.people)[0];
      const initialFirstName = useTreeStore.getState().tree.people[personId].firstName;

      useTreeStore.getState().beginTransaction();

      useTreeStore.getState().updateTreeName('Transaction Tree');
      useTreeStore.getState().updatePerson(personId, { firstName: 'BatchedAlice' });
      const newPerson = useTreeStore.getState().addPerson({ firstName: 'BatchedBob' });

      // During active transaction, pastPatches are not committed yet
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 0);

      useTreeStore.getState().commitTransaction();

      // Exactly 1 consolidated history step
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().tree.name, 'Transaction Tree');
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, 'BatchedAlice');
      assert.ok(useTreeStore.getState().tree.people[newPerson.id]);

      // Undo reverts all 3 operations at once
      useTreeStore.getState().undo();
      assert.strictEqual(useTreeStore.getState().tree.name, initialName);
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, initialFirstName);
      assert.strictEqual(useTreeStore.getState().tree.people[newPerson.id], undefined);

      // Redo restores all 3 operations at once
      useTreeStore.getState().redo();
      assert.strictEqual(useTreeStore.getState().tree.name, 'Transaction Tree');
      assert.strictEqual(useTreeStore.getState().tree.people[personId].firstName, 'BatchedAlice');
      assert.ok(useTreeStore.getState().tree.people[newPerson.id]);
    });

    it('supports transaction batching via batch() helper and abortTransaction()', () => {
      // Successful batch
      useTreeStore.getState().batch(() => {
        useTreeStore.getState().updateTreeName('Batch Helper Tree');
      });

      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
      assert.strictEqual(useTreeStore.getState().tree.name, 'Batch Helper Tree');

      // Abort transaction
      useTreeStore.getState().beginTransaction();
      useTreeStore.getState().updateTreeName('Aborted Tree');
      assert.strictEqual(useTreeStore.getState().tree.name, 'Aborted Tree');
      useTreeStore.getState().abortTransaction();

      assert.strictEqual(useTreeStore.getState().tree.name, 'Batch Helper Tree');
      assert.strictEqual(useTreeStore.getState().pastPatches.length, 1);
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
