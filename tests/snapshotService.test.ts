import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { TreeData } from '../src/types/tree';
import {
  calculateSnapshotIdsToPrune,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  clearSnapshots,
  resetSnapshotMemoryStore,
} from '../src/services/snapshotService';
import {
  useNotificationStore,
} from '../src/stores/useNotificationStore';
import {
  processTreeIngress,
  registerIngressRepairListener,
} from '../src/services/schema';
import { createDoubleInLawPreset } from '../src/services/storage';

describe('Phase 4: Automatic Local Snapshots and Restore Option', () => {
  beforeEach(() => {
    resetSnapshotMemoryStore();
    useNotificationStore.getState().clearNotifications();
    registerIngressRepairListener(null);
  });

  describe('Retention Policy Algorithm (calculateSnapshotIdsToPrune)', () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const baseNow = new Date('2026-09-29T12:00:00Z').getTime();

    it('returns empty array when snapshot count is <= maxRecentSnapshots (20)', () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `snap_${i}`,
        timestamp: baseNow - i * 1000,
      }));

      const pruneList = calculateSnapshotIdsToPrune(items, baseNow, {
        maxRecentSnapshots: 20,
        maxRetentionDays: 14,
      });

      assert.deepEqual(pruneList, []);
    });

    it('always protects the most recent 20 snapshots unconditionally', () => {
      // 20 very old snapshots (e.g. 50 days old)
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `snap_recent_${i}`,
        timestamp: baseNow - (50 * ONE_DAY_MS + i * 1000),
      }));

      const pruneList = calculateSnapshotIdsToPrune(items, baseNow, {
        maxRecentSnapshots: 20,
        maxRetentionDays: 14,
      });

      assert.equal(pruneList.length, 0, 'Recent 20 must never be pruned regardless of age');
    });

    it('prunes snapshots older than 14 days when beyond the recent 20', () => {
      const items: Array<{ id: string; timestamp: number }> = [];

      // 20 recent snapshots within last 2 days
      for (let i = 0; i < 20; i++) {
        items.push({ id: `recent_${i}`, timestamp: baseNow - i * 3600 * 1000 });
      }

      // 5 snapshots that are 15, 20, 25, 30, 40 days old
      items.push({ id: 'old_15d', timestamp: baseNow - 15 * ONE_DAY_MS });
      items.push({ id: 'old_20d', timestamp: baseNow - 20 * ONE_DAY_MS });
      items.push({ id: 'old_25d', timestamp: baseNow - 25 * ONE_DAY_MS });
      items.push({ id: 'old_30d', timestamp: baseNow - 30 * ONE_DAY_MS });
      items.push({ id: 'old_40d', timestamp: baseNow - 40 * ONE_DAY_MS });

      const pruneList = calculateSnapshotIdsToPrune(items, baseNow, {
        maxRecentSnapshots: 20,
        maxRetentionDays: 14,
      });

      assert.equal(pruneList.length, 5);
      assert.ok(pruneList.includes('old_15d'));
      assert.ok(pruneList.includes('old_20d'));
      assert.ok(pruneList.includes('old_25d'));
      assert.ok(pruneList.includes('old_30d'));
      assert.ok(pruneList.includes('old_40d'));
    });

    it('compacts multiple snapshots on the same day down to 1 per day beyond the recent 20', () => {
      const items: Array<{ id: string; timestamp: number }> = [];

      // 20 recent snapshots
      for (let i = 0; i < 20; i++) {
        items.push({ id: `recent_${i}`, timestamp: baseNow - i * 60 * 1000 });
      }

      // Beyond the 20: 3 snapshots on day -3
      const day3Base = baseNow - 3 * ONE_DAY_MS;
      items.push({ id: 'day3_newest', timestamp: day3Base });
      items.push({ id: 'day3_mid', timestamp: day3Base - 3600 * 1000 });
      items.push({ id: 'day3_oldest', timestamp: day3Base - 7200 * 1000 });

      // 2 snapshots on day -5
      const day5Base = baseNow - 5 * ONE_DAY_MS;
      items.push({ id: 'day5_newest', timestamp: day5Base });
      items.push({ id: 'day5_oldest', timestamp: day5Base - 3600 * 1000 });

      const pruneList = calculateSnapshotIdsToPrune(items, baseNow, {
        maxRecentSnapshots: 20,
        maxRetentionDays: 14,
      });

      // day3_mid, day3_oldest, and day5_oldest should be pruned
      assert.equal(pruneList.length, 3);
      assert.ok(pruneList.includes('day3_mid'));
      assert.ok(pruneList.includes('day3_oldest'));
      assert.ok(pruneList.includes('day5_oldest'));
      assert.ok(!pruneList.includes('day3_newest'), 'Newest snapshot on day 3 must be kept');
      assert.ok(!pruneList.includes('day5_newest'), 'Newest snapshot on day 5 must be kept');
    });
  });

  describe('Snapshot CRUD Operations', () => {
    it('creates and lists snapshots for a tree in descending timestamp order', async () => {
      const tree = createDoubleInLawPreset();
      tree.id = 'test_tree_crud';

      const snap1 = await createSnapshot(tree, 'pre-json-import', 'First test import');
      assert.ok(snap1.id.startsWith('snap_test_tree_crud_'));
      assert.equal(snap1.treeId, 'test_tree_crud');
      assert.equal(snap1.reason, 'pre-json-import');
      assert.equal(snap1.personCount, Object.keys(tree.people).length);
      assert.equal(snap1.unionCount, Object.keys(tree.unions).length);

      // Create a second snapshot with slight delay
      const snap2 = await createSnapshot(tree, 'manual', 'Manual checkpoint');

      const summaries = await listSnapshots('test_tree_crud');
      assert.equal(summaries.length, 2);
      assert.equal(summaries[0].id, snap2.id, 'Newest snapshot should be first');
      assert.equal(summaries[1].id, snap1.id);
    });

    it('retrieves full snapshot tree data via getSnapshot', async () => {
      const tree = createDoubleInLawPreset();
      tree.id = 'test_tree_get';

      const created = await createSnapshot(tree, 'pre-gedcom-import', 'Full data test');
      const retrieved = await getSnapshot(created.id);

      assert.ok(retrieved);
      assert.equal(retrieved.id, created.id);
      assert.deepEqual(retrieved.treeData.people, tree.people);
      assert.deepEqual(retrieved.treeData.unions, tree.unions);
    });

    it('returns null when getting a non-existent snapshot ID', async () => {
      const result = await getSnapshot('non_existent_snap_id');
      assert.equal(result, null);
    });

    it('deletes an individual snapshot by ID', async () => {
      const tree = createDoubleInLawPreset();
      tree.id = 'test_tree_del';

      const snap = await createSnapshot(tree, 'manual');
      let list = await listSnapshots('test_tree_del');
      assert.equal(list.length, 1);

      const deleted = await deleteSnapshot(snap.id);
      assert.equal(deleted, true);

      list = await listSnapshots('test_tree_del');
      assert.equal(list.length, 0);
    });

    it('clears snapshots for a specific tree or globally', async () => {
      const treeA = { ...createDoubleInLawPreset(), id: 'tree_a' };
      const treeB = { ...createDoubleInLawPreset(), id: 'tree_b' };

      await createSnapshot(treeA, 'manual');
      await createSnapshot(treeA, 'periodic');
      await createSnapshot(treeB, 'manual');

      // Clear treeA only
      await clearSnapshots('tree_a');
      assert.equal((await listSnapshots('tree_a')).length, 0);
      assert.equal((await listSnapshots('tree_b')).length, 1);

      // Clear globally
      await clearSnapshots();
      assert.equal((await listSnapshots('tree_b')).length, 0);
    });
  });

  describe('Restore Mechanism with Safety Undo Guarantee', () => {
    it('restores snapshot and creates an automatic pre-restore safety snapshot', async () => {
      const originalTree = createDoubleInLawPreset();
      originalTree.id = 'test_tree_restore';

      // 1. Take snapshot of original tree (8 people)
      const initialSnapshot = await createSnapshot(originalTree, 'manual', 'Original state');

      // 2. Simulate user making extensive modifications
      const modifiedTree: TreeData = {
        ...originalTree,
        people: {
          ...originalTree.people,
          new_person_1: {
            id: 'new_person_1',
            firstName: 'Extra',
            lastName: 'Relative',
            gender: 'female',
            unionIds: [],
          },
        },
      };

      // 3. Restore to original snapshot
      const { restoredTree, safetySnapshot } = await restoreSnapshot(
        initialSnapshot.id,
        modifiedTree
      );

      // Verify restored tree matches original state
      assert.equal(Object.keys(restoredTree.people).length, Object.keys(originalTree.people).length);
      assert.ok(!restoredTree.people['new_person_1'], 'Extra relative was rolled back');

      // Verify safety undo snapshot was automatically created
      assert.ok(safetySnapshot);
      assert.equal(safetySnapshot.reason, 'pre-restore');
      assert.ok(safetySnapshot.treeData.people['new_person_1'], 'Safety snapshot holds modified state');

      // Check snapshot list now includes initial snapshot + safety undo snapshot
      const snapshots = await listSnapshots('test_tree_restore');
      assert.equal(snapshots.length, 2);
      assert.equal(snapshots[0].reason, 'pre-restore');
      assert.equal(snapshots[1].reason, 'manual');
    });

    it('throws an error if attempting to restore a non-existent snapshot', async () => {
      const tree = createDoubleInLawPreset();
      await assert.rejects(
        () => restoreSnapshot('non_existent_id', tree),
        /Snapshot with ID "non_existent_id" was not found/
      );
    });
  });

  describe('Non-blocking UI Feedback & Notification Store', () => {
    it('adds, retrieves, and dismisses notifications', () => {
      const id = useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Test Notification',
        message: 'A test message',
      });

      assert.equal(useNotificationStore.getState().notifications.length, 1);
      assert.equal(useNotificationStore.getState().notifications[0].id, id);
      assert.equal(useNotificationStore.getState().notifications[0].title, 'Test Notification');

      useNotificationStore.getState().dismissNotification(id);
      assert.equal(useNotificationStore.getState().notifications.length, 0);
    });

    it('caps notifications to prevent unbounded growth', () => {
      for (let i = 0; i < 10; i++) {
        useNotificationStore.getState().addNotification({
          type: 'info',
          title: `Toast ${i}`,
        });
      }

      // Should keep at most 5 items
      assert.equal(useNotificationStore.getState().notifications.length, 5);
    });

    it('invokes registered ingress repair listener on data boundary repairs', () => {
      let repairNoticeCount = 0;
      let repairTitle = '';

      registerIngressRepairListener((report) => {
        repairNoticeCount = report.changes.length;
        repairTitle = `Repaired ${report.changes.length} issues`;
      });

      // Construct a tree with an intentional dangling partner reference
      const dirtyTree = createDoubleInLawPreset();
      dirtyTree.unions['u_parents'].partnerIds.push('dangling_partner_xyz');

      const result = processTreeIngress(dirtyTree);

      assert.ok(result.repaired);
      assert.ok(repairNoticeCount > 0);
      assert.ok(repairTitle.startsWith('Repaired'));
      assert.ok(!result.tree.unions['u_parents'].partnerIds.includes('dangling_partner_xyz'));
    });
  });
});
